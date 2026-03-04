/**
 * Tool for recommending next actions based on project state.
 * Use proactively when user asks "what should I do next?" or seems stuck.
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { getProjectResearchContext } from "../../features/research-links/db";
import {
	determineProjectStage,
	generateRecommendations,
	type ProjectStage,
	type Recommendation,
	type RecommendationHistoryEntry,
} from "../../features/research-links/utils/recommendation-rules";
import {
	buildRecommendationStateSignature,
	createRecommendationBatchAnnotations,
	fetchRecommendationHistory,
} from "../../features/research-links/utils/recommendation-memory.server";
import { buildProgressRailData } from "../../lib/gen-ui/phase-detection";
import { buildSingleComponentSurface, withA2UI } from "../../lib/gen-ui/tool-helpers";
import { supabaseAdmin } from "../../lib/supabase/client.server";
import type { Database } from "../../types";
import { createRouteDefinitions } from "../../utils/route-definitions";

function buildProjectPath(accountId: string, projectId: string) {
	return `/a/${accountId}/${projectId}`;
}

function resolveNavigateTo(projectPath: string, navigateTo?: string, focusThemeId?: string): string | undefined {
	if (!navigateTo) return undefined;
	const routes = createRouteDefinitions(projectPath);

	if (navigateTo === "/setup") return routes.projects.setup();
	if (navigateTo === "/ask/new") return routes.ask.new();
	if (navigateTo === "/themes") return routes.themes.index();
	if (navigateTo === "/people") return routes.people.index();

	if (navigateTo.startsWith("/themes/")) {
		const themeId = navigateTo.split("/")[2] || focusThemeId;
		if (themeId) return routes.themes.detail(themeId);
	}

	return navigateTo.startsWith(projectPath) ? navigateTo : undefined;
}

function hasProgressSinceAcceptance(historyEntry: RecommendationHistoryEntry, context: Awaited<ReturnType<typeof getProjectResearchContext>>) {
	if (historyEntry.actionType === "setup") {
		return context.hasGoals && !historyEntry.projectState.hasGoals;
	}
	if (historyEntry.actionType === "interview") {
		return context.interviewCount > historyEntry.projectState.interviewCount;
	}
	if (historyEntry.actionType === "survey" || historyEntry.actionType === "validate") {
		return context.surveyCount > historyEntry.projectState.surveyCount;
	}
	if (historyEntry.actionType === "analyze" || historyEntry.actionType === "deep_dive" || historyEntry.actionType === "decide") {
		return context.themes.length > historyEntry.projectState.themeCount;
	}
	return false;
}

function buildFollowUpRecommendation(
	history: RecommendationHistoryEntry[],
	context: Awaited<ReturnType<typeof getProjectResearchContext>>
): Recommendation | null {
	const latestAccepted = history.find((entry) => entry.response === "accepted" && entry.actionType);
	if (!latestAccepted || !latestAccepted.actionType) return null;
	if (hasProgressSinceAcceptance(latestAccepted, context)) return null;

	const followUpTitle = latestAccepted.title ?? "Follow through on your selected action";
	return {
		id: `follow-up-${latestAccepted.recommendationId}`,
		priority: 1,
		title: `Follow through: ${followUpTitle}`,
		description: "You previously selected this action, but project metrics have not changed yet.",
		reasoning: "Closing this loop helps turn accepted recommendations into measurable project progress.",
		actionType: latestAccepted.actionType,
		navigateTo: latestAccepted.navigateTo ?? undefined,
		metadata: {
			sourceRecommendationId: latestAccepted.recommendationId,
			recommendationFollowUp: true,
		},
	};
}

const RecommendationSchema = z.object({
	id: z.string(),
	priority: z.number(),
	title: z.string(),
	description: z.string(),
	reasoning: z.string(),
	actionType: z.enum(["setup", "interview", "survey", "validate", "deep_dive", "analyze", "decide", "data_quality"]),
	navigateTo: z.string().nullish().describe("Relative path to navigate user to (e.g., /setup, /ask/new)"),
	focusTheme: z
		.object({
			id: z.string(),
			name: z.string(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
});

const ProjectStateSchema = z.object({
	stage: z.enum(["setup", "discovery", "gathering", "validation", "synthesis"]),
	interviewCount: z.number(),
	surveyCount: z.number(),
	themeCount: z.number(),
	hasGoals: z.boolean(),
	dataQuality: z
		.object({
			peopleNeedingSegments: z.number(),
			totalPeople: z.number(),
			peopleWithoutTitles: z.number(),
		})
		.optional(),
});

export const recommendNextActionsTool = createTool({
	id: "recommend-next-actions",
	description: `Get personalized recommendations for what the user should do next in their research project.
Returns 1-3 actionable suggestions based on current project state (themes, evidence, interviews, surveys).

Use this tool proactively when:
- User asks "what should I do next?" or "what's the next step?"
- User seems unsure how to proceed
- User asks for guidance or recommendations
- Starting a conversation to orient the user

The recommendations are based on:
- Whether project goals are set
- Number of interviews and surveys completed
- Theme evidence levels (low = needs validation, high = ready for deep dive)
- Pricing themes (special handling)
- Recency of surveys (NPS check if stale)`,
	inputSchema: z.object({
		projectId: z
			.string()
			.nullish()
			.describe("Project ID to get recommendations for. If not provided, uses runtime context."),
		reason: z.string().nullish().describe("Why you are fetching recommendations (for logging)"),
	}),
	outputSchema: withA2UI(
		z.object({
			success: z.boolean(),
			message: z.string(),
			recommendations: z.array(RecommendationSchema),
			projectState: ProjectStateSchema,
				historySummary: z
					.object({
						totalTracked: z.number(),
						accepted: z.number(),
						declined: z.number(),
						deferred: z.number(),
					})
					.optional(),
		})
	),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		// Prefer explicit input, fall back to runtime context
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const projectId = input.projectId ?? runtimeProjectId;
		const accountId = context?.requestContext?.get?.("account_id");
		const userId = context?.requestContext?.get?.("user_id");
		const threadId = context?.requestContext?.get?.("thread_id");

		consola.debug("recommend-next-actions: execute start", {
			inputProjectId: input.projectId,
			runtimeProjectId,
			resolvedProjectId: projectId,
			accountId,
			userId,
			threadId,
			reason: input.reason,
		});

		if (!projectId) {
			consola.warn("recommend-next-actions: missing projectId", {
				hasContext: !!context,
				hasRequestContext: !!context?.requestContext,
			});
			return {
				success: false,
				message: "Missing projectId. Pass projectId parameter or ensure runtime context sets project_id.",
				recommendations: [],
				projectState: {
					stage: "setup" as ProjectStage,
					interviewCount: 0,
					surveyCount: 0,
					themeCount: 0,
					hasGoals: false,
				},
			};
		}

		try {
			// Fetch comprehensive project context
			const projectContext = await getProjectResearchContext({
				supabase,
				projectId,
			});
			const stage = determineProjectStage(projectContext);
			const stateSignature = buildRecommendationStateSignature(projectContext);
			const history = await fetchRecommendationHistory({ supabase, projectId });

			// Generate recommendations using rule engine + response history
			const baseRecommendations = generateRecommendations(projectContext, {
				history,
				stateSignature,
			});
			const followUpRecommendation = buildFollowUpRecommendation(history, projectContext);
			const mergedRecommendations = followUpRecommendation
				? [followUpRecommendation, ...baseRecommendations.filter((rec) => rec.id !== followUpRecommendation.id)]
				: baseRecommendations;
			const recommendations = mergedRecommendations.slice(0, 3);

			const projectPath = accountId && projectId ? buildProjectPath(accountId, projectId) : null;
			const resolvedRecommendations = projectPath
				? recommendations.map((rec) => ({
						...rec,
						navigateTo: resolveNavigateTo(projectPath, rec.navigateTo, rec.focusTheme?.id),
					}))
				: recommendations;

			const batchId = `next-actions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const annotationIdsByRecommendationId = await createRecommendationBatchAnnotations({
				supabase,
				accountId: projectContext.accountId || accountId || "",
				projectId,
				userId: typeof userId === "string" ? userId : null,
				threadId: typeof threadId === "string" ? threadId : null,
				stage,
				stateSignature,
				batchId,
				recommendations: resolvedRecommendations,
				context: projectContext,
			});

			const trackedRecommendations = resolvedRecommendations.map((rec) => ({
				...rec,
				metadata: {
					...(rec.metadata ?? {}),
					recommendationAnnotationId: annotationIdsByRecommendationId.get(rec.id) ?? null,
					recommendationBatchId: batchId,
					recommendationStateSignature: stateSignature,
				},
			}));

			const historySummary = history.reduce(
				(summary, entry) => {
					if (entry.response === "accepted") summary.accepted += 1;
					else if (entry.response === "declined") summary.declined += 1;
					else if (entry.response === "deferred") summary.deferred += 1;
					return summary;
				},
				{
					totalTracked: history.length,
					accepted: 0,
					declined: 0,
					deferred: 0,
				}
			);

			consola.debug("recommend-next-actions: generated recommendations", {
				projectId,
				stage,
				recommendationCount: recommendations.length,
				recommendationIds: recommendations.map((r) => r.id),
				historyTracked: history.length,
			});

			// Map recommendations to DecisionSupport actions
			const effortMap: Record<string, "low" | "medium" | "high"> = {
				setup: "low",
				analyze: "low",
				data_quality: "low",
				interview: "medium",
				survey: "medium",
				validate: "medium",
				deep_dive: "high",
				decide: "high",
			};
			const impactMap: Record<number, "low" | "medium" | "high"> = {
				1: "high",
				2: "medium",
				3: "low",
			};

			const decisionActions = trackedRecommendations.map((rec) => {
				const annotationId =
					typeof rec.metadata?.recommendationAnnotationId === "string" ? rec.metadata.recommendationAnnotationId : null;
				return {
					id: rec.id,
					action: rec.title,
					reasoning: rec.reasoning,
					effort: effortMap[rec.actionType] ?? "medium",
					impact: impactMap[rec.priority] ?? "medium",
					evidenceUrl: rec.navigateTo ?? undefined,
					annotationId: annotationId ?? undefined,
					owner: null,
					dueDate: null,
				};
			});

			const stageLabels: Record<string, string> = {
				setup: "setting up",
				discovery: "early discovery",
				gathering: "actively gathering data",
				validation: "validating themes",
				synthesis: "synthesizing insights",
			};

			const surfaceId = accountId ?? projectId;
			const reason = (input.reason ?? "").toLowerCase();
			const wantsProgressRail =
				reason.includes("progress") ||
				reason.includes("status") ||
				reason.includes("project state") ||
				reason.includes("where am i") ||
				reason.includes("phase");

			const a2ui = wantsProgressRail
				? (() => {
						const progressData = buildProgressRailData({
							stage,
							interviewCount: projectContext.interviewCount,
							surveyCount: projectContext.surveyCount,
							themeCount: projectContext.themes.length,
							hasGoals: projectContext.hasGoals,
						});

						const topRecommendation = trackedRecommendations[0];
						if (topRecommendation?.title) {
							progressData.nextAction = topRecommendation.title;
						}
						if (topRecommendation?.navigateTo) {
							progressData.nextActionUrl = topRecommendation.navigateTo;
						}

						return buildSingleComponentSurface({
							surfaceId,
							componentType: "ProgressRail",
							data: progressData as Record<string, unknown>,
						});
					})()
				: trackedRecommendations.length > 0
					? buildSingleComponentSurface({
							surfaceId,
							componentType: "DecisionSupport",
							data: {
								projectId,
								headline: `${projectContext.interviewCount} interviews, ${projectContext.themes.length} themes — ${stageLabels[stage] ?? stage}`,
								decisionContext: `Your project is in the ${stage} stage with ${projectContext.surveyCount} surveys completed.`,
								actions: decisionActions,
							},
						})
					: undefined;

			return {
				success: true,
				message: `Found ${recommendations.length} recommendations for your project.`,
				recommendations: trackedRecommendations,
				projectState: {
					stage,
					interviewCount: projectContext.interviewCount,
					surveyCount: projectContext.surveyCount,
					themeCount: projectContext.themes.length,
					hasGoals: projectContext.hasGoals,
					dataQuality: projectContext.dataQuality,
				},
				historySummary,
				a2ui,
			};
		} catch (error) {
			consola.error("recommend-next-actions: unexpected error", error);
			return {
				success: false,
				message: "Unexpected error generating recommendations.",
				recommendations: [],
				projectState: {
					stage: "setup" as ProjectStage,
					interviewCount: 0,
					surveyCount: 0,
					themeCount: 0,
					hasGoals: false,
				},
			};
		}
	},
});
