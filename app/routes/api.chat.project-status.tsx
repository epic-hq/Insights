import { handleChatStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
import type { MastraDBMessage } from "@mastra/core/memory";
import { createUIMessageStream, createUIMessageStreamResponse, generateObject } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import {
	buildHowtoContractPatchText,
	buildHowtoFallbackResponse,
	evaluateHowtoResponseContract,
} from "~/features/project-chat/howto-contract";
import { detectHowtoPromptMode } from "~/features/project-chat/howto-routing";
import {
	buildShortThreadTitle,
	findProjectStatusThread,
	getPrimaryProjectStatusResourceId,
} from "~/features/project-chat/project-status-threads.server";
import {
	clearActiveBillingContext,
	estimateOpenAICost,
	openai as instrumentedOpenai,
	setActiveBillingContext,
	userBillingContext,
} from "~/lib/billing/instrumented-openai.server";
import { recordUsageOnly } from "~/lib/billing/usage.server";
import { buildSingleComponentSurface } from "~/lib/gen-ui/tool-helpers";
import { UI_EVENT_DISPATCH_TEXT, type UiEvent, uiEventBatchSchema } from "~/lib/gen-ui/ui-events";
import { getLangfuseClient } from "~/lib/langfuse.server";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { mastra } from "~/mastra";
import { memory } from "~/mastra/memory";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { createSurveyTool } from "~/mastra/tools/create-survey";
import { navigateToPageTool } from "~/mastra/tools/navigate-to-page";
import { switchAgentTool } from "~/mastra/tools/switch-agent";
import { userContext } from "~/server/user-context";
import { createRouteDefinitions } from "~/utils/route-definitions";

function getLastUserText(messages: Array<{ role?: string; content?: unknown; parts?: unknown[] }>): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== "user") continue;
		if (typeof message.content === "string") return message.content;
		if (Array.isArray(message.parts)) {
			const textPart = message.parts.find((part) => (part as { type?: string })?.type === "text") as
				| { text?: unknown }
				| undefined;
			if (textPart && typeof textPart.text === "string") return textPart.text;
		}
	}
	return "";
}

function summarizeUiEventsForPrompt(uiEvents: UiEvent[]): string {
	const first = uiEvents[0];
	if (!first) return "";
	if (first.type === "canvas_action") {
		return `Canvas action: ${first.componentType}.${first.actionName}`;
	}
	const suffix = first.selectedIds.length ? ` (${first.selectedIds.join(", ")})` : "";
	return `User input: ${first.prompt}${suffix}`;
}

const routingTargetAgents = [
	"projectStatusAgent",
	"chiefOfStaffAgent",
	"researchAgent",
	"feedbackAgent",
	"projectSetupAgent",
	"howtoAgent",
	"surveyAgent",
] as const;
type RoutingTargetAgent = (typeof routingTargetAgents)[number];
type RoutingResponseMode =
	| "normal"
	| "fast_standardized"
	| "theme_people_snapshot"
	| "survey_quick_create"
	| "ux_research_mode"
	| "gtm_mode";

const intentRoutingSchema = z.object({
	targetAgentId: z.enum(routingTargetAgents),
	confidence: z.number().min(0).max(1),
	responseMode: z
		.enum([
			"normal",
			"fast_standardized",
			"theme_people_snapshot",
			"survey_quick_create",
			"ux_research_mode",
			"gtm_mode",
		])
		.default("normal" satisfies RoutingResponseMode),
	rationale: z.string().max(240).optional(),
});

const ROUTING_CONFIDENCE_THRESHOLD = 0.68;
const FAST_STANDARDIZED_MAX_STEPS = 2;
const FAST_STANDARDIZED_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_SYSTEM_CONTEXT_CHARS = 3000;
const MAX_FAST_SYSTEM_CONTEXT_CHARS = 800;
const MAX_RESEARCH_SYSTEM_CONTEXT_CHARS = 1200;
const ROUTING_CLASSIFIER_MAX_PROMPT_CHARS = 700;
const ROUTING_CLASSIFIER_INSTRUCTIONS = `Route the user message to one agent and mode.

Agents:
- projectSetupAgent: onboarding, setup, research goals, company context.
- chiefOfStaffAgent: strategic prioritization, next actions, "what should I do", "what now", "what next", "where should I start". Always use mode="normal" for this agent.
- researchAgent: interview prompts, interview operations (NOT surveys, NOT analysis/gaps/coverage questions).
- surveyAgent: survey editing, question review/rephrase/reorder/hide, survey settings, response analysis. NOT survey creation (that uses researchAgent fast path via survey_quick_create mode).
- feedbackAgent: classify feedback/bug/feature requests and submit to PostHog.
- howtoAgent: procedural guidance ("how do I [specific task]", "best way to [do X]", "teach me"). NOT for "where should I start" or "what should I do" — those go to chiefOfStaffAgent.
- projectStatusAgent: factual status/data lookup (themes, ICP, people, evidence, interviews, research gaps, coverage analysis, what's missing). Also handles people management: add, remove, delete, merge, edit people or organizations.

Modes:
- fast_standardized: DEPRECATED, do not use. Always use normal mode.
- theme_people_snapshot: top/common themes + who has them.
- survey_quick_create: explicit create/build/generate survey/waitlist requests. Route to researchAgent.
- gtm_mode: howtoAgent prompts about positioning, launch, distribution, sales.
- ux_research_mode: howtoAgent prompts about UX or product research/how-to.
- normal: everything else.

Rule: For people comparisons ("what do X and Y have in common", "compare these people"), use mode="normal", not theme_people_snapshot.
Rule: If system context indicates interview detail and the prompt is about open questions/prep/follow-up, route to researchAgent with mode="normal".
Rule: If user asks to edit/review/rephrase/evaluate/reorder/hide survey questions, route to surveyAgent with mode="normal".`;
const DEBUG_PREFIX_REGEX = /^\s*\/debug\b[:\s-]*/i;
const FALLBACK_EMPTY_RESPONSE_TEXT = "Sorry, I couldn't answer that just now. Please try again.";

function buildStreamInitFailureMessage(errorMessage: string, targetAgentId: RoutingTargetAgent): string {
	const normalized = errorMessage.toLowerCase();
	const isRateLimit =
		normalized.includes("rate limit") ||
		normalized.includes("rate_limit") ||
		normalized.includes("429") ||
		normalized.includes("too many requests");
	if (isRateLimit) {
		const agentLabel = targetAgentId === "surveyAgent" ? "survey assistant" : "assistant";
		return `I hit a model rate limit before I could finish that request in the ${agentLabel}. I did not complete the action. Please retry in about a minute.`;
	}
	return FALLBACK_EMPTY_RESPONSE_TEXT;
}
const MARKDOWN_LINK_REGEX = /\[[^\]]+\]\((?:\/|https?:\/\/|#|mailto:)[^)]+\)/;
const SURVEY_QUESTION_TYPE_VALUES = [
	"auto",
	"short_text",
	"long_text",
	"single_select",
	"multi_select",
	"likert",
	"matrix",
	"image_select",
] as const;
const surveyBranchConditionDraftSchema = z.discriminatedUnion("sourceType", [
	z.object({
		sourceType: z.literal("question"),
		questionId: z.string().min(1),
		operator: z.enum([
			"equals",
			"not_equals",
			"contains",
			"not_contains",
			"selected",
			"not_selected",
			"answered",
			"not_answered",
		]),
		value: z.union([z.string(), z.array(z.string())]).optional(),
	}),
	z.object({
		sourceType: z.literal("person_attribute"),
		attributeKey: z.string().min(1),
		operator: z.enum([
			"equals",
			"not_equals",
			"contains",
			"not_contains",
			"selected",
			"not_selected",
			"answered",
			"not_answered",
		]),
		value: z.union([z.string(), z.array(z.string())]).optional(),
	}),
]);
const surveyBranchRuleDraftSchema = z.object({
	id: z.string().min(1).nullish(),
	conditions: z.object({
		logic: z.enum(["and", "or"]),
		conditions: z.array(surveyBranchConditionDraftSchema).min(1),
	}),
	action: z.enum(["skip_to", "end_survey"]),
	targetQuestionId: z.string().min(1).nullish(),
	targetSectionId: z.string().min(1).nullish(),
	label: z.string().nullish(),
	naturalLanguage: z.string().nullish(),
	summary: z.string().nullish(),
	guidance: z.string().nullish(),
	source: z.enum(["user_ui", "user_voice", "ai_generated"]).nullish(),
	confidence: z.enum(["high", "medium", "low"]).nullish(),
	createdAt: z.string().nullish(),
});
const surveyQuestionBranchingDraftSchema = z.object({
	rules: z.array(surveyBranchRuleDraftSchema),
	defaultNext: z.string().min(1).nullish(),
});
const surveyJourneyRouteDraftSchema = z.object({
	label: z.string().nullish(),
	matchValues: z.array(z.string().min(1)).min(1),
	targetSectionId: z.string().min(1),
});
const surveyJourneyDraftSchema = z.object({
	decisionQuestionId: z.string().min(1),
	routes: z.array(surveyJourneyRouteDraftSchema).min(1),
	sharedClosingSectionIds: z.array(z.string().min(1)).nullish(),
});
const surveyQuestionDraftSchema = z
	.object({
		id: z.string().min(1).nullish(),
		prompt: z.string().min(1),
		type: z.enum(SURVEY_QUESTION_TYPE_VALUES).nullish(),
		required: z.boolean().nullish(),
		helperText: z.string().nullish(),
		allowOther: z.boolean().nullish(),
		options: z.array(z.string()).nullish(),
		likertScale: z.number().int().min(3).max(10).nullish(),
		likertLabels: z
			.object({
				low: z.string().nullish(),
				high: z.string().nullish(),
			})
			.nullish(),
		matrixRows: z
			.array(
				z.object({
					id: z.string().min(1).nullish(),
					label: z.string().min(1),
				})
			)
			.nullish(),
		sectionId: z.string().min(1).nullish(),
		sectionTitle: z.string().min(1).nullish(),
		branching: surveyQuestionBranchingDraftSchema.nullish(),
	})
	.passthrough();
const surveyQuickCreateDraftSchema = z.object({
	name: z.string().min(2),
	description: z.string().nullish(),
	questions: z.array(surveyQuestionDraftSchema).min(3).max(24),
	journey: surveyJourneyDraftSchema.nullish(),
});

function slugifySurveyToken(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

function dedupeBranchRules(
	rules: Array<{
		id?: string | null;
		conditions: {
			logic: "and" | "or";
			conditions: Array<{ questionId: string; operator: string; value?: string | string[] }>;
		};
		action: "skip_to" | "end_survey";
		targetQuestionId?: string | null;
		targetSectionId?: string | null;
		label?: string | null;
		naturalLanguage?: string | null;
		summary?: string | null;
		guidance?: string | null;
		source?: "user_ui" | "user_voice" | "ai_generated" | null;
		confidence?: "high" | "medium" | "low" | null;
		createdAt?: string | null;
	}>
) {
	const seen = new Set<string>();
	return rules.filter((rule) => {
		const key = JSON.stringify({
			action: rule.action,
			targetQuestionId: rule.targetQuestionId ?? null,
			targetSectionId: rule.targetSectionId ?? null,
			conditions: rule.conditions,
		});
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function applyJourneyArchitectureToDraft(
	draft: z.infer<typeof surveyQuickCreateDraftSchema>
): z.infer<typeof surveyQuickCreateDraftSchema> {
	if (!draft.journey) return draft;

	const questions = draft.questions.map((question) => ({
		...question,
		branching: question.branching
			? {
					...question.branching,
					rules: [...question.branching.rules],
				}
			: null,
	}));
	const questionById = new Map(questions.map((question) => [question.id ?? "", question] as const));
	const decisionQuestion = questionById.get(draft.journey.decisionQuestionId);
	const decisionQuestionId = decisionQuestion?.id;
	if (!decisionQuestionId) {
		return draft;
	}

	const sectionQuestionIds = new Map<string, string[]>();
	for (const question of questions) {
		const sectionId = question.sectionId?.trim();
		const questionId = question.id?.trim();
		if (!sectionId || !questionId) continue;
		const existing = sectionQuestionIds.get(sectionId) ?? [];
		existing.push(questionId);
		sectionQuestionIds.set(sectionId, existing);
	}

	const routeRules = draft.journey.routes
		.filter((route) => sectionQuestionIds.has(route.targetSectionId))
		.map((route, index) => ({
			id: `journey-route-${slugifySurveyToken(route.label ?? route.targetSectionId)}-${index + 1}`,
			conditions: {
				logic: "or" as const,
				conditions: route.matchValues.map((value) => ({
					questionId: decisionQuestionId,
					operator: decisionQuestion.type === "multi_select" ? ("selected" as const) : ("equals" as const),
					value,
				})),
			},
			action: "skip_to" as const,
			targetSectionId: route.targetSectionId,
			label: route.label ?? `Route to ${route.targetSectionId}`,
			summary: route.label ?? `Route to ${route.targetSectionId}`,
			source: "ai_generated" as const,
			confidence: "high" as const,
		}));

	if (routeRules.length > 0) {
		decisionQuestion.branching = {
			...(decisionQuestion.branching ?? {}),
			rules: dedupeBranchRules([...(decisionQuestion.branching?.rules ?? []), ...routeRules]),
		};
	}

	const firstSharedClosingSectionId = draft.journey.sharedClosingSectionIds?.[0];
	if (!firstSharedClosingSectionId || !sectionQuestionIds.has(firstSharedClosingSectionId)) {
		return {
			...draft,
			questions,
		};
	}

	const routedSectionIds = Array.from(new Set(draft.journey.routes.map((route) => route.targetSectionId))).filter(
		(sectionId) => sectionId !== firstSharedClosingSectionId && sectionQuestionIds.has(sectionId)
	);

	for (const sectionId of routedSectionIds) {
		const questionIds = sectionQuestionIds.get(sectionId) ?? [];
		const lastQuestionId = questionIds.at(-1);
		if (!lastQuestionId) continue;
		const lastQuestion = questionById.get(lastQuestionId);
		if (!lastQuestion?.id) continue;

		const rejoinRule = {
			id: `journey-rejoin-${slugifySurveyToken(sectionId)}-to-${slugifySurveyToken(firstSharedClosingSectionId)}`,
			conditions: {
				logic: "and" as const,
				conditions: [{ sourceType: "question" as const, questionId: lastQuestion.id, operator: "answered" as const }],
			},
			action: "skip_to" as const,
			targetSectionId: firstSharedClosingSectionId,
			label: `Continue to ${firstSharedClosingSectionId}`,
			summary: `Continue to ${firstSharedClosingSectionId}`,
			source: "ai_generated" as const,
			confidence: "high" as const,
		};

		lastQuestion.branching = {
			...(lastQuestion.branching ?? {}),
			rules: dedupeBranchRules([...(lastQuestion.branching?.rules ?? []), rejoinRule]),
		};
	}

	return {
		...draft,
		questions,
	};
}

function mapUsageToLangfuse(usage?: { inputTokens?: number; outputTokens?: number }) {
	if (!usage) return { usage: undefined, usageDetails: undefined };
	const inputTokens = usage.inputTokens;
	const outputTokens = usage.outputTokens;
	const totalTokens =
		typeof inputTokens === "number" || typeof outputTokens === "number"
			? (inputTokens ?? 0) + (outputTokens ?? 0)
			: undefined;

	const usagePayload: Record<string, number> = {};
	if (typeof inputTokens === "number") usagePayload.input = inputTokens;
	if (typeof outputTokens === "number") usagePayload.output = outputTokens;
	if (typeof totalTokens === "number") usagePayload.total = totalTokens;

	const usageDetailsPayload: Record<string, number> = {};
	if (typeof inputTokens === "number") usageDetailsPayload.input = inputTokens;
	if (typeof outputTokens === "number") usageDetailsPayload.output = outputTokens;
	if (typeof totalTokens === "number") usageDetailsPayload.total = totalTokens;

	return {
		usage: Object.keys(usagePayload).length > 0 ? usagePayload : undefined,
		usageDetails: Object.keys(usageDetailsPayload).length > 0 ? usageDetailsPayload : undefined,
	};
}

function mapCostDetailsToLangfuse(totalCostUsd: number | null | undefined) {
	if (typeof totalCostUsd !== "number" || !Number.isFinite(totalCostUsd)) return undefined;
	return { total: totalCostUsd };
}

const MAX_STEPS_BY_AGENT: Record<RoutingTargetAgent, number> = {
	projectStatusAgent: 6,
	chiefOfStaffAgent: 6,
	researchAgent: 4,
	feedbackAgent: 3,
	projectSetupAgent: 5,
	howtoAgent: 4,
	surveyAgent: 8,
};

const BILLING_MODEL_BY_AGENT: Record<RoutingTargetAgent, string> = {
	projectStatusAgent: "gpt-4.1",
	chiefOfStaffAgent: "gpt-4o",
	researchAgent: "gpt-4o",
	feedbackAgent: "gpt-4o-mini",
	projectSetupAgent: "gpt-5.1",
	howtoAgent: "gpt-4o-mini",
	surveyAgent: "gpt-4o-mini",
};

type FastGuidanceCacheEntry = {
	text: string;
	expiresAt: number;
};

type CsvListContract = {
	requestedRows: number;
};

type WebResearchStructuredResult = {
	title: string;
	url: string;
	summary: string;
	relevanceScore?: number | null;
	publishedDate?: string | null;
	author?: string | null;
};

const fastGuidanceCache = new Map<string, FastGuidanceCacheEntry>();

/**
 * Sticky routing: remembers the last agent routed per resource so follow-up
 * messages in an ongoing conversation stay with the same agent (e.g., a user
 * answering a projectSetupAgent question doesn't get re-routed to chiefOfStaff).
 */
type StickyRoutingEntry = { agentId: RoutingTargetAgent; timestamp: number };
const lastRoutedAgentMap = new Map<string, StickyRoutingEntry>();
const STICKY_ROUTING_TTL_MS = 10 * 60 * 1000; // 10 minutes
type RoutingSource = "deterministic" | "classifier" | "fallback";

function hashString(input: string): string {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

function detectCsvListContract(prompt: string): CsvListContract | null {
	const normalized = prompt.trim();
	if (!normalized) return null;
	if (!/\bcsv\b/i.test(normalized)) return null;

	const countMatch =
		normalized.match(/\btop\s+(\d{1,2})\b/i) ??
		normalized.match(/\blist\s+of\s+(\d{1,2})\b/i) ??
		normalized.match(/\b(\d{1,2})\s+items?\b/i);
	if (!countMatch?.[1]) return null;

	const parsed = Number.parseInt(countMatch[1], 10);
	if (!Number.isFinite(parsed) || parsed < 1) return null;

	return { requestedRows: Math.min(parsed, 20) };
}

function escapeCsvCell(value: string): string {
	const normalized = value.replace(/\r?\n+/g, " ").trim();
	if (!normalized.includes(",") && !normalized.includes('"')) {
		return normalized;
	}
	return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsvFromWebResearchResults(results: WebResearchStructuredResult[], requestedRows: number): string | null {
	if (!Array.isArray(results) || results.length === 0) return null;
	if (!Number.isFinite(requestedRows) || requestedRows < 1) return null;

	const deduped: WebResearchStructuredResult[] = [];
	const seenKeys = new Set<string>();

	for (const result of results) {
		if (!result?.title || !result?.url) continue;
		const key = `${result.title.toLowerCase()}::${result.url.toLowerCase()}`;
		if (seenKeys.has(key)) continue;
		seenKeys.add(key);
		deduped.push(result);
	}

	if (deduped.length < requestedRows) return null;

	const rows = deduped.slice(0, requestedRows).map((result) => {
		const name = escapeCsvCell(result.title);
		const description = escapeCsvCell(result.summary || "No summary available");
		const website = escapeCsvCell(result.url);
		return `${name},${description},${website}`;
	});

	return ["name,description,website", ...rows].join("\n");
}

function extractWebResearchResultsFromPayload(payload: unknown): WebResearchStructuredResult[] {
	if (!payload || typeof payload !== "object") return [];
	const candidate = (payload as { results?: unknown }).results;
	if (!Array.isArray(candidate)) return [];

	return candidate
		.map((row) => {
			if (!row || typeof row !== "object") return null;
			const candidateRow = row as Record<string, unknown>;
			if (typeof candidateRow.title !== "string") return null;
			if (typeof candidateRow.url !== "string") return null;

			return {
				title: candidateRow.title,
				url: candidateRow.url,
				summary: typeof candidateRow.summary === "string" ? candidateRow.summary : "No summary available",
				relevanceScore: typeof candidateRow.relevanceScore === "number" ? candidateRow.relevanceScore : null,
				publishedDate: typeof candidateRow.publishedDate === "string" ? candidateRow.publishedDate : null,
				author: typeof candidateRow.author === "string" ? candidateRow.author : null,
			} satisfies WebResearchStructuredResult;
		})
		.filter((row): row is WebResearchStructuredResult => Boolean(row));
}

function extractCsvLines(text: string): string[] {
	const normalized = text
		.replace(/```csv/gi, "")
		.replace(/```/g, "")
		.trim();
	if (!normalized) return [];

	const lines = normalized
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	return lines.filter((line) => line.includes(","));
}

function responseSatisfiesCsvContract(responseText: string, contract: CsvListContract): boolean {
	const csvLines = extractCsvLines(responseText);
	if (csvLines.length < 2) return false;
	if (!csvLines[0].includes(",")) return false;
	return csvLines.length - 1 === contract.requestedRows;
}

function streamPlainAssistantText(text: string) {
	return createUIMessageStream({
		execute: async ({ writer }) => {
			const messageChunkId = `cached-${Date.now().toString(36)}`;
			writer.write({ type: "start" });
			writer.write({ type: "start-step" });
			writer.write({ type: "text-start", id: messageChunkId });
			writer.write({ type: "text-delta", id: messageChunkId, delta: text });
			writer.write({ type: "text-end", id: messageChunkId });
			writer.write({ type: "finish-step" });
			writer.write({ type: "finish", finishReason: "stop" });
		},
	});
}

function streamSurveyQuickCreateResult(options: {
	text: string;
	navigatePath?: string;
	a2uiMessages?: Array<Record<string, unknown>>;
}) {
	return createUIMessageStream({
		execute: async ({ writer }) => {
			const messageChunkId = `survey-${Date.now().toString(36)}`;
			writer.write({ type: "start" });
			writer.write({ type: "start-step" });
			writer.write({ type: "text-start", id: messageChunkId });
			writer.write({
				type: "text-delta",
				id: messageChunkId,
				delta: options.text,
			});
			writer.write({ type: "text-end", id: messageChunkId });

			// NOTE: Do NOT emit a synthetic tool-input-available here.
			// That causes the client to call addToolResult() → sendAutomatically re-triggers
			// the server request → matches survey_quick_create again → infinite loop.
			// Instead, emit a typed custom data part the client can handle directly.
			if (options.a2uiMessages?.length) {
				writer.write({
					type: "data-a2ui",
					data: { messages: options.a2uiMessages },
				});
			}
			if (options.navigatePath) {
				writer.write({
					type: "data-navigate",
					data: { path: options.navigatePath },
				});
			}

			writer.write({ type: "finish-step" });
			writer.write({ type: "finish", finishReason: "stop" });
		},
	});
}

type StreamChunk = Record<string, unknown>;

function ensureSurveyEditPath(path: string): string {
	const normalizedInput = (() => {
		if (!path || path.startsWith("/")) return path;
		try {
			const parsed = new URL(path);
			return `${parsed.pathname}${parsed.search}${parsed.hash}`;
		} catch {
			return path;
		}
	})();

	const [beforeHash, hashFragment] = normalizedInput.split("#", 2);
	const [pathnameRaw, searchRaw] = beforeHash.split("?", 2);
	const pathname = pathnameRaw.replace(/\/+$/, "");
	const askMatch = pathname.match(/^(.*\/ask\/[^/]+)(\/edit)?$/);
	if (!askMatch) return normalizedInput;
	const normalizedPathname = `${askMatch[1]}/edit`;
	const search = typeof searchRaw === "string" && searchRaw.length > 0 ? `?${searchRaw}` : "";
	const hash = typeof hashFragment === "string" && hashFragment.length > 0 ? `#${hashFragment}` : "";
	return `${normalizedPathname}${search}${hash}`;
}

async function persistQuickCreateTurn(options: {
	threadId: string;
	threadResourceId: string;
	userText: string;
	assistantText: string;
}) {
	const now = new Date();
	const baseTimestamp = now.getTime();
	const messages: MastraDBMessage[] = [
		{
			id: `quick-user-${baseTimestamp.toString(36)}`,
			role: "user",
			createdAt: now,
			threadId: options.threadId,
			resourceId: options.threadResourceId,
			content: {
				format: 2,
				parts: [{ type: "text", text: options.userText }],
			},
		},
		{
			id: `quick-assistant-${(baseTimestamp + 1).toString(36)}`,
			role: "assistant",
			createdAt: new Date(baseTimestamp + 1),
			threadId: options.threadId,
			resourceId: options.threadResourceId,
			content: {
				format: 2,
				parts: [{ type: "text", text: options.assistantText }],
			},
		},
	];

	await memory.saveMessages({ messages });
}

function convertLegacyDataPayloadToTypedChunks(payload: unknown, inheritedId?: string): StreamChunk[] {
	if (!payload) return [];

	const toChunk = (type: string, data: unknown): StreamChunk | null => {
		if (!type.startsWith("data-")) return null;
		const normalized: StreamChunk = { type, data };
		if (typeof inheritedId === "string" && inheritedId.length > 0) {
			normalized.id = inheritedId;
		}
		return normalized;
	};

	const fromObject = (value: Record<string, unknown>): StreamChunk[] => {
		const nestedType = typeof value.type === "string" ? value.type : null;

		if (nestedType?.startsWith("data-")) {
			const normalized = toChunk(nestedType, "data" in value ? value.data : value);
			return normalized ? [normalized] : [];
		}

		if (nestedType === "navigate" && typeof value.path === "string") {
			const normalized = toChunk("data-navigate", { path: value.path });
			return normalized ? [normalized] : [];
		}

		if (nestedType === "a2ui" && Array.isArray(value.messages)) {
			const normalized = toChunk("data-a2ui", { messages: value.messages });
			return normalized ? [normalized] : [];
		}

		// Common legacy progress payload shape from writer.custom().
		if ("tool" in value || "status" in value || "progress" in value || "message" in value) {
			const normalized = toChunk("data-tool-progress", value);
			return normalized ? [normalized] : [];
		}

		return [];
	};

	if (Array.isArray(payload)) {
		return payload.flatMap((entry) => {
			if (!entry || typeof entry !== "object") return [];
			return fromObject(entry as Record<string, unknown>);
		});
	}

	if (typeof payload === "object") {
		return fromObject(payload as Record<string, unknown>);
	}

	return [];
}

function normalizeStreamChunk(chunk: StreamChunk): StreamChunk[] {
	if (chunk?.type !== "data") return [chunk];
	return convertLegacyDataPayloadToTypedChunks(chunk.data, typeof chunk.id === "string" ? chunk.id : undefined);
}

function stripDebugPrefix(prompt: string): string {
	const stripped = prompt.replace(DEBUG_PREFIX_REGEX, "").trim();
	return stripped.length > 0 ? stripped : "what should I do next";
}

function extractInterviewIdFromSystemContext(systemContext: string): string | null {
	if (!systemContext) return null;

	// Match only valid UUIDs from interview routes and view context
	const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
	const routeMatch = systemContext.match(new RegExp(`/interviews/(${UUID_PATTERN})\\b`, "i"));
	if (routeMatch?.[1]) return routeMatch[1];

	const viewMatch = systemContext.match(new RegExp(`View:\\s*Interview detail \\(id=(${UUID_PATTERN})\\)`, "i"));
	if (viewMatch?.[1]) return viewMatch[1];

	return null;
}

function extractSurveyIdFromSystemContext(systemContext: string): string | null {
	if (!systemContext) return null;

	const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

	// Match: /ask/<uuid>
	const routeMatch = systemContext.match(new RegExp(`/ask/(${UUID_PATTERN})\\b`, "i"));
	if (routeMatch?.[1]) return routeMatch[1];

	// Match: "View: Survey editor (surveyId=<uuid>..."
	const viewMatch = systemContext.match(new RegExp(`surveyId=(${UUID_PATTERN})`, "i"));
	if (viewMatch?.[1]) return viewMatch[1];

	return null;
}

function normalizeMessagesForExecution(
	messages: Array<{ role?: string; content?: unknown; parts?: unknown[] }>,
	debugRequested: boolean
) {
	if (!debugRequested) return messages;

	let cleanedFirstUserMessage = false;
	return messages.map((message) => {
		if (!message || message.role !== "user" || cleanedFirstUserMessage) return message;

		if (typeof message.content === "string") {
			cleanedFirstUserMessage = true;
			return {
				...message,
				content: stripDebugPrefix(message.content),
			};
		}

		if (Array.isArray(message.parts)) {
			const parts = message.parts.map((part) => {
				if (!part || typeof part !== "object") return part;
				if ((part as { type?: string }).type !== "text") return part;
				const text = (part as { text?: unknown }).text;
				if (typeof text !== "string") return part;
				if (cleanedFirstUserMessage) return part;
				cleanedFirstUserMessage = true;
				return {
					...part,
					text: stripDebugPrefix(text),
				};
			});

			return {
				...message,
				parts,
			};
		}

		return message;
	});
}

export function buildQuickLinksMarkdown(options: {
	accountId: string;
	projectId: string;
	lastUserText: string;
	targetAgentId: RoutingTargetAgent;
}) {
	const { accountId, projectId, lastUserText, targetAgentId } = options;
	if (!accountId || !projectId) return "";

	const projectPath = `/a/${accountId}/${projectId}`;
	const routes = createRouteDefinitions(projectPath);
	const normalizedPrompt = lastUserText.toLowerCase();
	const mentionsPeople = /\b(people|person|contact|contacts|icp)\b/.test(normalizedPrompt);
	const mentionsSurvey = /\b(survey|ask link|ask|questionnaire|responses?)\b/.test(normalizedPrompt);
	const mentionsThemes = /\b(theme|insight|insights|evidence)\b/.test(normalizedPrompt);
	const mentionsLens = /\b(lens|lenses|jtbd|jobs.to.be.done|bant|empathy.map|customer.discovery|analysis)\b/.test(
		normalizedPrompt
	);

	const links: string[] = [];
	if (mentionsPeople) links.push(`[People](${routes.people.index()})`);
	if (mentionsSurvey || targetAgentId === "researchAgent") links.push(`[Ask](${routes.ask.index()})`);
	if (mentionsLens) {
		// Link to specific lens if we can detect which one
		if (/\b(jtbd|jobs.to.be.done)\b/.test(normalizedPrompt)) {
			links.push(`[JTBD Lens](${routes.lenses.jtbdConversationPipeline()})`);
		} else if (/\b(bant)\b/.test(normalizedPrompt)) {
			links.push(`[Sales BANT](${routes.lenses.salesBant()})`);
		} else if (/\b(customer.discovery)\b/.test(normalizedPrompt)) {
			links.push(`[Customer Discovery](${routes.lenses.customerDiscovery()})`);
		} else {
			links.push(`[Lenses](${routes.lenses.library()})`);
		}
	}
	if (mentionsThemes || targetAgentId === "projectStatusAgent") links.push(`[Insights](${routes.insights.table()})`);

	if (links.length === 0) {
		links.push(`[Insights](${routes.insights.table()})`);
		links.push(`[People](${routes.people.index()})`);
	}

	return `Quick links: ${links.join(" · ")}`;
}

function responseHasExplicitNextActionPrompt(text: string): boolean {
	const normalized = text.toLowerCase();
	return (
		normalized.includes("would you like me to:") ||
		normalized.includes("please confirm your preference") ||
		normalized.includes("choose one of these options") ||
		normalized.includes("pick one of these options") ||
		normalized.includes("select one of these options") ||
		normalized.includes("reply with your choice")
	);
}

type StreamLike = ReadableStream<Record<string, unknown>>;

function augmentStreamForReliability(
	stream: Awaited<ReturnType<typeof handleChatStream>>,
	options: {
		debugRequested: boolean;
		targetAgentId: RoutingTargetAgent;
		targetMaxSteps: number;
		responseMode: RoutingResponseMode;
		accountId: string;
		projectId: string;
		lastUserText: string;
		routingSource: RoutingSource;
		routingConfidence: number | null;
		userId: string;
		threadId: string;
		csvListContract: CsvListContract | null;
	}
) {
	if (!stream || typeof (stream as { pipeThrough?: unknown }).pipeThrough !== "function") {
		return stream;
	}

	const toolCalls: string[] = [];
	let sawTextDelta = false;
	let injectedSafetyMessage = false;
	let appendedDebugTrace = false;
	let appendedQuickLinks = false;
	let appendedCsvCorrection = false;
	let sawFinishChunk = false;
	let appendedHowtoContractPatch = false;
	let accumulatedAssistantText = "";
	let loggedHowtoTelemetry = false;
	const capturedWebResearchResults: WebResearchStructuredResult[] = [];

	const enqueueAssistantText = (
		controller: TransformStreamDefaultController<Record<string, unknown>>,
		text: string,
		idPrefix: string
	) => {
		const clean = text.trim();
		if (!clean) return;
		const id = `${idPrefix}-${Date.now().toString(36)}`;
		controller.enqueue({ type: "start-step" });
		controller.enqueue({ type: "text-start", id });
		controller.enqueue({ type: "text-delta", id, delta: clean });
		controller.enqueue({ type: "text-end", id });
		controller.enqueue({ type: "finish-step" });
	};

	const maybeEnqueueSafetyMessage = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (!sawTextDelta && !injectedSafetyMessage) {
			const fallbackText =
				options.targetAgentId === "howtoAgent"
					? buildHowtoFallbackResponse(options.accountId, options.projectId)
					: FALLBACK_EMPTY_RESPONSE_TEXT;
			enqueueAssistantText(controller, fallbackText, "fallback");
			accumulatedAssistantText += `\n${fallbackText}`;
			injectedSafetyMessage = true;
		}
	};

	const maybeEnqueueHowtoContractPatch = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (options.targetAgentId !== "howtoAgent" || appendedHowtoContractPatch) return;
		const patchText = buildHowtoContractPatchText(accumulatedAssistantText, options.accountId, options.projectId);
		if (!patchText) return;
		enqueueAssistantText(controller, patchText, "howto-contract");
		accumulatedAssistantText += patchText;
		appendedHowtoContractPatch = true;
	};

	const maybeEnqueueDebugTrace = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (!options.debugRequested || appendedDebugTrace) return;
		const uniqueTools = Array.from(new Set(toolCalls));
		const debugText = [
			"",
			"Debug Trace:",
			`- routed_to: ${options.targetAgentId}`,
			`- response_mode: ${options.responseMode}`,
			`- max_steps: ${options.targetMaxSteps}`,
			`- tool_calls: ${uniqueTools.length > 0 ? uniqueTools.join(", ") : "none"}`,
		].join("\n");
		enqueueAssistantText(controller, debugText, "debug");
		appendedDebugTrace = true;
	};

	const maybeEnqueueQuickLinks = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (appendedQuickLinks) return;
		if (options.csvListContract) return;
		if (!sawTextDelta) return;
		if (MARKDOWN_LINK_REGEX.test(accumulatedAssistantText)) return;
		if (responseHasExplicitNextActionPrompt(accumulatedAssistantText)) return;
		const quickLinks = buildQuickLinksMarkdown({
			accountId: options.accountId,
			projectId: options.projectId,
			lastUserText: options.lastUserText,
			targetAgentId: options.targetAgentId,
		});
		if (!quickLinks) return;
		enqueueAssistantText(controller, quickLinks, "links");
		appendedQuickLinks = true;
	};

	const maybeEnqueueCsvCorrection = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		const contract = options.csvListContract;
		if (!contract || appendedCsvCorrection) return;
		if (responseSatisfiesCsvContract(accumulatedAssistantText, contract)) return;

		const correctedCsv = buildCsvFromWebResearchResults(capturedWebResearchResults, contract.requestedRows);
		if (!correctedCsv) return;

		enqueueAssistantText(controller, correctedCsv, "csv-correction");
		accumulatedAssistantText += `\n${correctedCsv}`;
		appendedCsvCorrection = true;
	};

	const maybeLogHowtoStreamTelemetry = () => {
		if (options.targetAgentId !== "howtoAgent" || loggedHowtoTelemetry) return;
		const quality = evaluateHowtoResponseContract(accumulatedAssistantText);
		consola.info("project-status: howto stream telemetry", {
			responseMode: options.responseMode,
			routingSource: options.routingSource,
			routingConfidence: options.routingConfidence,
			responseChars: accumulatedAssistantText.trim().length,
			contractPatched: appendedHowtoContractPatch,
			fallbackInjected: injectedSafetyMessage,
			contractPassed: quality.passes,
			missingSections: quality.missingSections,
			hasMarkdownLink: quality.hasMarkdownLink,
		});
		loggedHowtoTelemetry = true;
	};

	const transformed = (stream as StreamLike).pipeThrough(
		new TransformStream<Record<string, unknown>, Record<string, unknown>>({
			transform(chunk, controller) {
				const normalizedChunks = normalizeStreamChunk(chunk);
				for (const normalizedChunk of normalizedChunks) {
					if (
						normalizedChunk?.type === "text-delta" &&
						typeof normalizedChunk.delta === "string" &&
						normalizedChunk.delta.trim().length > 0
					) {
						sawTextDelta = true;
						accumulatedAssistantText += normalizedChunk.delta;
					}

					if (normalizedChunk?.type === "tool-input-available" && typeof normalizedChunk.toolName === "string") {
						toolCalls.push(normalizedChunk.toolName);
					}

					// A2UI tool results count as valid output — don't show "Sorry" fallback.
					// handleChatStream emits tool-result chunks; handleNetworkStream may emit tool-output-available.
					if (normalizedChunk?.type === "tool-output-available" || normalizedChunk?.type === "tool-result") {
						const payload = (normalizedChunk.output ?? normalizedChunk.result) as Record<string, unknown> | undefined;
						if (typeof payload === "object" && payload && "a2ui" in payload) {
							sawTextDelta = true;
						}

						const extractedResults = extractWebResearchResultsFromPayload(payload);
						if (extractedResults.length > 0) {
							const existing = new Set(
								capturedWebResearchResults.map((item) => `${item.title.toLowerCase()}::${item.url.toLowerCase()}`)
							);
							for (const result of extractedResults) {
								const key = `${result.title.toLowerCase()}::${result.url.toLowerCase()}`;
								if (existing.has(key)) continue;
								existing.add(key);
								capturedWebResearchResults.push(result);
							}
						}
					}

					if (normalizedChunk?.type === "error") {
						maybeEnqueueSafetyMessage(controller);
					}

					if (normalizedChunk?.type === "finish") {
						sawFinishChunk = true;
						maybeEnqueueSafetyMessage(controller);
						maybeEnqueueHowtoContractPatch(controller);
						maybeEnqueueCsvCorrection(controller);
						maybeEnqueueQuickLinks(controller);
						maybeEnqueueDebugTrace(controller);
						maybeLogHowtoStreamTelemetry();
					}

					controller.enqueue(normalizedChunk);
				}
			},
			flush(controller) {
				maybeEnqueueSafetyMessage(controller);
				maybeEnqueueHowtoContractPatch(controller);
				maybeEnqueueCsvCorrection(controller);
				maybeEnqueueQuickLinks(controller);
				maybeEnqueueDebugTrace(controller);
				maybeLogHowtoStreamTelemetry();
				if (!sawFinishChunk) {
					controller.enqueue({ type: "finish", finishReason: "stop" });
				}

				// Track agent message completion in PostHog
				if (options.userId && sawTextDelta) {
					const posthog = getPostHogServerClient();
					if (posthog) {
						const uniqueTools = Array.from(new Set(toolCalls));
						// Fire and forget - don't block stream completion
						try {
							posthog.capture({
								distinctId: options.userId,
								event: "agent_message_sent",
								properties: {
									agent_id: options.targetAgentId,
									agent_name: options.targetAgentId,
									account_id: options.accountId,
									project_id: options.projectId,
									thread_id: options.threadId,
									message_type: "assistant",
									response_mode: options.responseMode,
									tool_calls: uniqueTools.length,
									tools_used: uniqueTools,
									timestamp: new Date().toISOString(),
								},
							});
						} catch (error) {
							consola.error("[PostHog] Failed to track agent_message_sent", error);
						}
					}
				}
			},
		})
	);

	return transformed;
}

function routeByDeterministicPrompt(
	lastUserText: string,
	options?: { systemContext?: string }
): z.infer<typeof intentRoutingSchema> | null {
	const prompt = lastUserText.trim().toLowerCase();
	if (!prompt) return null;
	const hasAny = (...tokens: string[]) => tokens.some((token) => prompt.includes(token));
	const systemContext = options?.systemContext ?? "";
	const interviewIdFromContext = extractInterviewIdFromSystemContext(systemContext);
	const looksLikeFailureReport = hasAny(
		"did not",
		"didn't",
		"does not",
		"doesn't",
		"failed",
		"failure",
		"broken",
		"not working",
		"error",
		"crash",
		"bug",
		"issue"
	);
	// Capability / scope questions stay on projectStatusAgent (uses capabilityLookup tool)
	const asksForCapabilities =
		hasAny("what can you do", "what do you do", "what are your capabilities") ||
		(hasAny("can you", "are you able") && hasAny("help", "do"));
	if (asksForCapabilities) {
		return {
			targetAgentId: "projectStatusAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for capability/scope questions",
		};
	}

	// "where do i start" / "where should i start" are next-step guidance, not howto.
	// Let the LLM classifier handle those — it knows to route to chiefOfStaffAgent.
	const isNextStepIntent = hasAny("where should i start", "where do i start", "what should i do", "what do i do");
	const howtoRouting = detectHowtoPromptMode(prompt);
	if (howtoRouting.isHowto && !isNextStepIntent) {
		return {
			targetAgentId: "howtoAgent",
			confidence: 1,
			responseMode: howtoRouting.responseMode,
			rationale: "deterministic routing for how-to guidance prompts",
		};
	}

	const asksForTopThemesSnapshot =
		hasAny(
			"show top theme",
			"show top themes",
			"top theme",
			"top themes",
			"most common theme",
			"most common themes",
			"strongest theme",
			"strongest themes",
			"strongest signal"
		) ||
		(hasAny("theme", "themes") && hasAny("top", "most common", "strongest"));
	if (asksForTopThemesSnapshot) {
		return {
			targetAgentId: "projectStatusAgent",
			confidence: 1,
			responseMode: "theme_people_snapshot",
			rationale: "deterministic keyword routing for top-theme snapshot requests",
		};
	}

	const asksForIcpData =
		hasAny("icp", "ideal customer profile") ||
		(hasAny("match", "matches", "score", "scored", "scoring") && hasAny("person", "people", "who"));
	if (asksForIcpData) {
		return {
			targetAgentId: "projectStatusAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic keyword routing for ICP lookup",
		};
	}

	const asksForSurveyCreate =
		hasAny("survey", "waitlist", "ask link", "questionnaire") &&
		hasAny("create", "make", "build", "draft", "generate") &&
		!looksLikeFailureReport;
	if (asksForSurveyCreate) {
		return {
			targetAgentId: "researchAgent",
			confidence: 1,
			responseMode: "survey_quick_create",
			rationale: "deterministic routing for direct survey creation",
		};
	}

	// Survey editing/review → surveyAgent
	const surveyIdFromContext = extractSurveyIdFromSystemContext(systemContext);
	const asksForSurveyEdit =
		hasAny("survey", "ask link", "question", "questionnaire") &&
		hasAny(
			"edit",
			"rephrase",
			"rewrite",
			"update",
			"change",
			"hide",
			"unhide",
			"evaluate",
			"review",
			"bias",
			"improve",
			"shorten",
			"simplify",
			"reorder",
			"prioritize",
			"keep",
			"remove"
		);
	if (asksForSurveyEdit) {
		return {
			targetAgentId: "surveyAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for survey editing/review",
		};
	}

	// When user is on survey editor page and asks about "my questions" / "the questions"
	const onSurveyPage = surveyIdFromContext != null;
	const asksAboutQuestions = hasAny("question", "questions", "my survey", "this survey");
	if (onSurveyPage && asksAboutQuestions) {
		return {
			targetAgentId: "surveyAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing: user on survey page asking about questions",
		};
	}

	// Catch-all: user is on a survey page and no more-specific rule matched above.
	// Route to surveyAgent so the coordinator network doesn't consume maxSteps
	// bouncing between coordinator and sub-agent.
	if (onSurveyPage) {
		return {
			targetAgentId: "surveyAgent",
			confidence: 0.9,
			responseMode: "normal",
			rationale: "deterministic routing: user is on survey page (catch-all)",
		};
	}

	const asksForInterviewOps =
		hasAny("interview", "interviews") && hasAny("create", "draft", "generate", "write", "questions", "prompt");
	if (asksForInterviewOps) {
		return {
			targetAgentId: "researchAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for interview operations",
		};
	}

	const asksForInterviewOpenQuestionHelp =
		Boolean(interviewIdFromContext) &&
		hasAny("open question", "open questions", "next steps", "follow up", "follow-up", "prepare", "prep");
	if (asksForInterviewOpenQuestionHelp) {
		return {
			targetAgentId: "researchAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for interview detail open-question guidance",
		};
	}

	const asksForFeedbackTriage =
		(hasAny("feedback", "bug", "bug report", "feature request") &&
			hasAny("posthog", "log", "submit", "report", "track")) ||
		(hasAny("bug report", "feature request") && hasAny("submit", "log", "track"));
	if (asksForFeedbackTriage) {
		return {
			targetAgentId: "feedbackAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for feedback triage and PostHog submission",
		};
	}

	const asksForProjectSetup =
		hasAny("set up project", "setup project", "tell me about your company", "define research goals") ||
		(hasAny("project setup", "onboarding") && hasAny("help", "start", "begin"));
	if (asksForProjectSetup) {
		return {
			targetAgentId: "projectSetupAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for project setup/onboarding",
		};
	}

	const asksForResearchAnalysis =
		hasAny("gap", "gaps", "coverage", "blind spot", "blind spots") ||
		(hasAny("missing", "what am i missing", "what's missing") &&
			hasAny("research", "data", "evidence", "interview", "insight"));
	if (asksForResearchAnalysis) {
		return {
			targetAgentId: "projectStatusAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for research gap/coverage analysis",
		};
	}

	const asksForPeopleOrTaskOps =
		(hasAny("people", "person", "contacts") &&
			hasAny("missing", "update", "find", "show", "list", "remove", "delete", "merge", "add", "edit")) ||
		(hasAny("task", "tasks", "todo", "to-do") && hasAny("create", "add", "update", "complete", "done", "close"));
	if (asksForPeopleOrTaskOps) {
		return {
			targetAgentId: "projectStatusAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for people/task operations via project status network",
		};
	}

	return null;
}

async function routeAgentByIntent(
	lastUserText: string,
	resourceId?: string,
	options?: { systemContext?: string; uiEvents?: UiEvent[] }
): Promise<z.infer<typeof intentRoutingSchema> | null> {
	const prompt = lastUserText.trim();
	const hasTypedUiEvents = (options?.uiEvents?.length ?? 0) > 0;
	if (!prompt && !hasTypedUiEvents) return null;

	const promptLower = prompt.toLowerCase();
	const isStructuredUiEvent = promptLower.startsWith("[canvasaction]") || promptLower.startsWith("[userinput]");
	const promptLooksLikeFollowupFeedbackDetail = [
		"did not",
		"didn't",
		"does not",
		"doesn't",
		"failed",
		"failure",
		"broken",
		"not working",
		"error",
		"crash",
		"bug",
		"issue",
	].some((token) => promptLower.includes(token));

	// Sticky routing for feedback clarifications:
	// if we just routed to feedbackAgent and the next turn looks like issue detail,
	// keep routing to feedbackAgent so the user can complete the bug report flow.
	if (resourceId) {
		const sticky = lastRoutedAgentMap.get(resourceId);
		if (
			sticky &&
			sticky.agentId === "feedbackAgent" &&
			Date.now() - sticky.timestamp < STICKY_ROUTING_TTL_MS &&
			promptLooksLikeFollowupFeedbackDetail
		) {
			return {
				targetAgentId: "feedbackAgent",
				confidence: 0.95,
				responseMode: "normal",
				rationale: "sticky routing — continuing feedbackAgent clarification flow",
			};
		}
	}

	if (hasTypedUiEvents) {
		const sticky = resourceId ? lastRoutedAgentMap.get(resourceId) : null;
		const stickyIsFresh = !!sticky && Date.now() - sticky.timestamp < STICKY_ROUTING_TTL_MS;
		return {
			targetAgentId: stickyIsFresh ? sticky.agentId : "projectStatusAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for typed ui events",
		};
	}

	// Structured UI events should skip classifier routing.
	// Keep the active/sticky agent when available so requestUserInput flows continue.
	if (isStructuredUiEvent) {
		const sticky = resourceId ? lastRoutedAgentMap.get(resourceId) : null;
		const stickyIsFresh = !!sticky && Date.now() - sticky.timestamp < STICKY_ROUTING_TTL_MS;
		return {
			targetAgentId: stickyIsFresh ? sticky.agentId : "projectStatusAgent",
			confidence: 1,
			responseMode: "normal",
			rationale: "deterministic routing for structured ui event messages",
		};
	}

	const deterministicRoute = routeByDeterministicPrompt(prompt, options);
	if (deterministicRoute) return deterministicRoute;

	// Sticky routing: if the last routed agent was surveyAgent or projectSetupAgent
	// and no deterministic rule explicitly matched a different agent, keep routing
	// to the same agent. This prevents follow-up answers (e.g. "yes, tighten this
	// into 10 questions") from being misrouted through the coordinator network.
	if (resourceId) {
		const sticky = lastRoutedAgentMap.get(resourceId);
		if (
			sticky &&
			(sticky.agentId === "surveyAgent" || sticky.agentId === "projectSetupAgent") &&
			Date.now() - sticky.timestamp < STICKY_ROUTING_TTL_MS
		) {
			return {
				targetAgentId: sticky.agentId,
				confidence: 0.95,
				responseMode: "normal",
				rationale: `sticky routing — continuing ${sticky.agentId} conversation`,
			};
		}
	}

	try {
		const result = await generateObject({
			model: instrumentedOpenai("gpt-4o-mini"),
			schema: intentRoutingSchema,
			temperature: 0,
			prompt: `${ROUTING_CLASSIFIER_INSTRUCTIONS}
Message: """${prompt.slice(0, ROUTING_CLASSIFIER_MAX_PROMPT_CHARS)}"""`,
		});
		return result.object;
	} catch (error) {
		consola.warn("project-status: intent routing failed, falling back to projectStatusAgent", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

async function executeSurveyQuickCreate(options: {
	prompt: string;
	projectId: string;
	accountId: string;
	requestContext: RequestContext;
	systemContext: string;
}): Promise<{
	success: boolean;
	text: string;
	navigatePath?: string;
	a2uiMessages?: Array<Record<string, unknown>>;
	usage?: { inputTokens?: number; outputTokens?: number };
}> {
	const draft = await generateObject({
		model: instrumentedOpenai("gpt-4o"),
		schema: surveyQuickCreateDraftSchema,
		temperature: 0.1,
		prompt: `Create a ready-to-launch survey draft from the user request.

User request:
"""${options.prompt}"""

Project context:
${options.systemContext || "No extra context."}

	Requirements:
- If the user provides an explicit survey outline, numbered questions, sections, options, or branching, preserve that structure faithfully instead of summarizing it.
- Keep the total question count close to the user's explicit brief. Do not collapse a detailed 10-20 question survey into a short starter survey.
- Prefer a block journey architecture when segments diverge: shared intro -> conditional path blocks -> shared closing block.
- Use question types that match intent (auto, short_text, long_text, single_select, multi_select, likert, matrix).
- Only include options for select questions.
- Only include likertScale/likertLabels for likert questions.
- Use matrix when several rows share the exact same rating scale and should be answered together. For matrix, include matrixRows plus likertScale/likertLabels.
- Include sectionId and sectionTitle whenever the brief is organized into sections.
- Include branching whenever the brief specifies conditional paths. Prefer targetSectionId-based skip rules for screeners and branch exit points.
- When the brief implies block routing, include a journey object with decisionQuestionId, routes, and sharedClosingSectionIds so the survey can be post-processed into reliable section routing.
- Preserve provided answer options and required flags.
- Keep prompts concise and natural, but do not rewrite away the user's intent.
- Never add respondent-facing phrases like "Optional but encouraged".
- Survey must be immediately usable without follow-up.`,
	});

	const normalizedDraft = applyJourneyArchitectureToDraft(draft.object);

	const created = await createSurveyTool.execute(
		{
			projectId: options.projectId,
			name: normalizedDraft.name,
			description: normalizedDraft.description ?? null,
			questions: normalizedDraft.questions,
			isLive: true,
		},
		{ requestContext: options.requestContext }
	);

	if (!created.success || !created.editUrl) {
		return {
			success: false,
			text: created.message || "I couldn't create the survey yet. Please try again.",
			usage: draft.usage,
		};
	}

	const editPath = ensureSurveyEditPath(created.editUrl);
	const publicUrl = created.publicUrl ?? editPath;
	const surveyCardSurface = buildSingleComponentSurface({
		surfaceId: `survey-created-${created.surveyId ?? Date.now().toString(36)}`,
		componentType: "SurveyCreated",
		componentId: `survey-created-${created.surveyId ?? "new"}`,
		data: {
			surveyId: created.surveyId ?? "new-survey",
			name: normalizedDraft.name,
			questionCount: created.questionCount ?? normalizedDraft.questions.length,
			editUrl: editPath,
			publicUrl,
		},
	});

	return {
		success: true,
		text: `Created "${normalizedDraft.name}". Opening it in Edit mode now: [Open survey](${editPath})`,
		navigatePath: editPath,
		a2uiMessages: surveyCardSurface.messages,
		usage: draft.usage,
	};
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	// IMPORTANT: Resolve account_id from project, not URL params or session
	// This prevents data being created with wrong account when user has multiple accounts
	const fallbackAccountId = String(params.accountId || ctx?.account_id || "");
	const accountId = await resolveAccountIdFromProject(projectId, "api.chat.project-status", fallbackAccountId);
	const userId = ctx?.claims?.sub || "";

	if (!projectId) {
		consola.warn("project-status: missing projectId");
		return new Response(JSON.stringify({ error: "Missing projectId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const body = (await request.json().catch(() => ({}))) as {
		messages?: unknown[];
		system?: unknown;
		userTimezone?: unknown;
		threadId?: unknown;
		uiEvents?: unknown;
	};
	const messages = body.messages;
	const system = typeof body.system === "string" ? body.system : undefined;
	const userTimezone = typeof body.userTimezone === "string" ? body.userTimezone : undefined;
	const requestedThreadId = typeof body.threadId === "string" && body.threadId.trim() ? body.threadId.trim() : null;
	const parsedUiEvents = uiEventBatchSchema.safeParse(body.uiEvents ?? []);
	const typedUiEvents = parsedUiEvents.success ? parsedUiEvents.data : [];
	if (!parsedUiEvents.success && body.uiEvents !== undefined) {
		consola.warn("project-status: invalid uiEvents payload, ignoring", {
			errorCount: parsedUiEvents.error.issues.length,
		});
	}
	const sanitizedMessages = Array.isArray(messages)
		? messages.map((message) => {
				if (!message || typeof message !== "object") return message;
				const cloned = { ...message };
				if ("id" in cloned) {
					delete (cloned as Record<string, unknown>).id;
				}
				return cloned;
			})
		: [];

	// Validate that we have at least one user message
	const hasUserMessage = sanitizedMessages.some(
		(message: { role?: string }) => message && typeof message === "object" && message.role === "user"
	);

	if (!hasUserMessage) {
		consola.warn("project-status: missing user message");
		return new Response(JSON.stringify({ error: "Missing user prompt" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Only pass NEW messages to the agent - Mastra's memory handles historical context.
	// This prevents duplicate messages when both client history and memory are present.
	// We look for the last user message and include it (the new turn).
	const lastUserIndex = sanitizedMessages.findLastIndex((m: { role?: string }) => m?.role === "user");

	// If we have a user message, start from there. Otherwise use all messages.
	// This ensures we always send at least the new user message to the agent.
	const runtimeMessages = lastUserIndex >= 0 ? sanitizedMessages.slice(lastUserIndex) : sanitizedMessages;

	const lastUserTextRaw = getLastUserText(sanitizedMessages);
	const debugRequested = DEBUG_PREFIX_REGEX.test(lastUserTextRaw);
	const lastUserText = debugRequested ? stripDebugPrefix(lastUserTextRaw) : lastUserTextRaw;
	const lastUserTextForRouting =
		typedUiEvents.length > 0 && (!lastUserText || lastUserText === UI_EVENT_DISPATCH_TEXT)
			? summarizeUiEventsForPrompt(typedUiEvents)
			: lastUserText;
	const csvListContract = detectCsvListContract(lastUserTextForRouting);
	const threadTitleSeed = lastUserText === UI_EVENT_DISPATCH_TEXT ? lastUserTextForRouting : lastUserText;
	const runtimeMessagesForExecution = normalizeMessagesForExecution(runtimeMessages, debugRequested);
	const routingResourceId = `project-chat-${userId}-${projectId}`;
	const routeDecision = await routeAgentByIntent(lastUserTextForRouting, routingResourceId, {
		systemContext: typeof system === "string" ? system : "",
		uiEvents: typedUiEvents,
	});
	const resolvedResponseMode: RoutingResponseMode =
		(routeDecision?.responseMode as RoutingResponseMode | undefined) ?? "normal";
	const targetAgentId: RoutingTargetAgent =
		routeDecision && routeDecision.confidence >= ROUTING_CONFIDENCE_THRESHOLD
			? routeDecision.targetAgentId
			: "projectStatusAgent";
	const routingSource: RoutingSource = !routeDecision
		? "fallback"
		: routeDecision.rationale?.startsWith("deterministic")
			? "deterministic"
			: "classifier";
	const isFastStandardized = targetAgentId === "chiefOfStaffAgent" && resolvedResponseMode === "fast_standardized";
	const targetMaxSteps = isFastStandardized
		? Math.min(MAX_STEPS_BY_AGENT[targetAgentId], FAST_STANDARDIZED_MAX_STEPS)
		: MAX_STEPS_BY_AGENT[targetAgentId];
	const systemContextLimit = isFastStandardized
		? MAX_FAST_SYSTEM_CONTEXT_CHARS
		: targetAgentId === "researchAgent"
			? MAX_RESEARCH_SYSTEM_CONTEXT_CHARS
			: MAX_SYSTEM_CONTEXT_CHARS;
	const systemContext = typeof system === "string" ? system.slice(0, systemContextLimit) : "";
	const defaultThreadResourceId = getPrimaryProjectStatusResourceId(userId, projectId);
	let threadResourceId = defaultThreadResourceId;
	const langfuse = getLangfuseClient();
	const requestTrace = (langfuse as any).trace?.({
		name: "api.chat.project-status",
		userId: userId || undefined,
		sessionId: routingResourceId,
		input: {
			lastUserText: lastUserTextForRouting,
			systemContext,
			userTimezone: userTimezone || null,
		},
		metadata: {
			accountId,
			projectId,
			debugRequested,
		},
	});
	const requestGeneration = requestTrace?.generation?.({
		name: "api.chat.project-status.route",
		model: BILLING_MODEL_BY_AGENT[targetAgentId] || "gpt-4o",
		input: {
			lastUserText,
			lastUserTextForRouting,
			systemContext,
			userTimezone: userTimezone || null,
			targetAgentId,
			responseMode: resolvedResponseMode,
		},
		metadata: {
			accountId,
			projectId,
			debugRequested,
			routingSource,
		},
	});

	if (typeof system === "string" && system.length > systemContext.length) {
		consola.debug("project-status: truncated system context", {
			originalLength: system.length,
			truncatedLength: systemContext.length,
			isFastStandardized,
		});
	}

	// Store routing decision for sticky routing
	lastRoutedAgentMap.set(routingResourceId, {
		agentId: targetAgentId,
		timestamp: Date.now(),
	});

	consola.info("project-status: intent routing", {
		targetAgentId,
		targetMaxSteps,
		isFastStandardized,
		routingSource,
		routingConfidence: routeDecision?.confidence ?? null,
		responseMode: resolvedResponseMode,
		rawResponseMode: routeDecision?.responseMode ?? "normal",
		uiEventCount: typedUiEvents.length,
		rationale: routeDecision?.rationale ?? null,
	});
	requestTrace?.update?.({
		metadata: {
			accountId,
			projectId,
			debugRequested,
			targetAgentId,
			targetMaxSteps,
			routingSource,
			routingConfidence: routeDecision?.confidence ?? null,
			responseMode: resolvedResponseMode,
			rawResponseMode: routeDecision?.responseMode ?? "normal",
		},
	});

	if (targetAgentId === "howtoAgent") {
		consola.info("project-status: howto routing telemetry", {
			projectId,
			accountId,
			resourceId: threadResourceId,
			responseMode: resolvedResponseMode,
			routingSource,
			routingConfidence: routeDecision?.confidence ?? null,
		});
	}

	let threadId = "";
	if (requestedThreadId) {
		const existingThread = await findProjectStatusThread({
			memory,
			userId,
			projectId,
			threadId: requestedThreadId,
		});
		if (existingThread) {
			threadId = existingThread.id;
			threadResourceId = existingThread.resourceId || defaultThreadResourceId;
		}
	}

	if (!threadId) {
		const threads = await memory.listThreads({
			filter: { resourceId: defaultThreadResourceId },
			orderBy: { field: "createdAt", direction: "DESC" },
			page: 0,
			perPage: 1,
		});

		if (threads?.total && threads.total > 0) {
			threadId = threads.threads[0].id;
			// Update title if it's still the default (e.g., thread created by "New Chat" button)
			const existingTitle = threads.threads[0].title;
			if (!existingTitle || existingTitle === "New Chat" || existingTitle === "Chat Session") {
				const betterTitle = buildShortThreadTitle(threadTitleSeed);
				if (betterTitle !== "New Chat") {
					memory
						.updateThread({ id: threadId, title: betterTitle })
						.catch((err: unknown) => consola.warn("project-status: failed to update thread title", err));
				}
			}
		} else {
			const newThread = await memory.createThread({
				resourceId: defaultThreadResourceId,
				title: buildShortThreadTitle(threadTitleSeed),
				metadata: {
					user_id: userId,
					project_id: projectId,
					account_id: accountId,
					source: "chat_first_message",
				},
			});
			threadId = newThread.id;
		}

		threadResourceId = defaultThreadResourceId;
	}
	requestTrace?.update?.({
		metadata: {
			accountId,
			projectId,
			debugRequested,
			targetAgentId,
			targetMaxSteps,
			routingSource,
			routingConfidence: routeDecision?.confidence ?? null,
			responseMode: resolvedResponseMode,
			rawResponseMode: routeDecision?.responseMode ?? "normal",
			threadId,
			threadResourceId,
			requestedThreadId,
		},
	});

	const requestContext = new RequestContext();
	requestContext.set("user_id", userId);
	requestContext.set("account_id", accountId);
	requestContext.set("project_id", projectId);
	const interviewIdFromSystemContext = extractInterviewIdFromSystemContext(typeof system === "string" ? system : "");
	if (interviewIdFromSystemContext) {
		requestContext.set("interview_id", interviewIdFromSystemContext);
	}
	const surveyIdFromSystemContext = extractSurveyIdFromSystemContext(typeof system === "string" ? system : "");
	if (surveyIdFromSystemContext) {
		requestContext.set("survey_id", surveyIdFromSystemContext);
	}
	if (userTimezone) {
		requestContext.set("user_timezone", userTimezone);
	}
	requestContext.set("response_mode", resolvedResponseMode);
	requestContext.set("routing_source", routingSource);
	requestContext.set("thread_id", threadId);
	requestContext.set("thread_resource_id", threadResourceId);
	if (typedUiEvents.length > 0) {
		requestContext.set("ui_events", typedUiEvents);
	}
	if (debugRequested) {
		requestContext.set("debug_mode", true);
	}
	if (csvListContract) {
		requestContext.set("csv_requested_rows", csvListContract.requestedRows);
	}

	// Fetch user persona from onboarding for persona-aware greetings
	try {
		const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server");
		const adminSupabase = createSupabaseAdminClient();
		const { data: userSettings } = await adminSupabase
			.from("user_settings")
			.select("metadata")
			.eq("user_id", userId)
			.maybeSingle();

		const onboarding = (userSettings?.metadata as Record<string, unknown> | null)?.onboarding as
			| Record<string, string>
			| undefined;

		if (onboarding?.job_function) {
			requestContext.set("user_role", onboarding.job_function);
		}
		if (onboarding?.primary_use_case) {
			requestContext.set("user_use_cases", onboarding.primary_use_case);
		}
		if (onboarding?.company_size) {
			requestContext.set("user_company_size", onboarding.company_size);
		}
	} catch (err) {
		consola.warn("[persona] Failed to fetch user onboarding persona:", err);
	}

	if (targetAgentId === "researchAgent" && resolvedResponseMode === "survey_quick_create") {
		try {
			const quickCreate = await executeSurveyQuickCreate({
				prompt: lastUserText,
				projectId,
				accountId,
				requestContext,
				systemContext,
			});

			const quickCreateLangfuseUsage = mapUsageToLangfuse(quickCreate.usage);
			const quickCreateCost =
				quickCreate.usage && (quickCreate.usage.inputTokens || quickCreate.usage.outputTokens)
					? estimateOpenAICost(
							BILLING_MODEL_BY_AGENT.researchAgent || "gpt-4o",
							quickCreate.usage.inputTokens || 0,
							quickCreate.usage.outputTokens || 0
						)
					: null;
			const quickCreateCostDetails = mapCostDetailsToLangfuse(quickCreateCost);

			if (quickCreate.usage && (quickCreate.usage.inputTokens || quickCreate.usage.outputTokens)) {
				const inputTokens = quickCreate.usage.inputTokens || 0;
				const outputTokens = quickCreate.usage.outputTokens || 0;
				const model = BILLING_MODEL_BY_AGENT.researchAgent || "gpt-4o";
				const costUsd = quickCreateCost ?? estimateOpenAICost(model, inputTokens, outputTokens);
				const billingCtx = userBillingContext({
					accountId,
					userId,
					featureSource: "project_status_agent",
					projectId,
				});

				await recordUsageOnly(
					billingCtx,
					{
						provider: "openai",
						model,
						inputTokens,
						outputTokens,
						estimatedCostUsd: costUsd,
					},
					`agent:project-status:${userId}:${projectId}:survey-quick-create:${Date.now()}`
				).catch((err) => {
					consola.error("[billing] Failed to record survey quick-create usage:", err);
				});
			}

			requestGeneration?.end?.({
				output: {
					success: quickCreate.success,
					text: quickCreate.text,
					navigatePath: quickCreate.navigatePath ?? null,
				},
				usage: quickCreateLangfuseUsage.usage,
				usageDetails: quickCreateLangfuseUsage.usageDetails,
				costDetails: quickCreateCostDetails,
			});
			requestTrace?.update?.({
				output: {
					success: quickCreate.success,
					text: quickCreate.text,
					navigatePath: quickCreate.navigatePath ?? null,
				},
			});
			requestTrace?.end?.();
			await persistQuickCreateTurn({
				threadId,
				threadResourceId,
				userText: lastUserText,
				assistantText: quickCreate.text,
			}).catch((error) => {
				consola.warn("project-status: failed to persist survey quick-create turn", {
					error: error instanceof Error ? error.message : String(error),
					threadId,
				});
			});

			return createUIMessageStreamResponse({
				stream: streamSurveyQuickCreateResult({
					text: quickCreate.text,
					navigatePath: quickCreate.navigatePath,
					a2uiMessages: quickCreate.a2uiMessages,
				}),
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			consola.error("project-status: survey quick-create failed", {
				error: errorMessage,
				projectId,
			});
			requestTrace?.update?.({
				output: {
					success: false,
					error: errorMessage,
				},
			});
			requestGeneration?.end?.({
				level: "ERROR",
				statusMessage: errorMessage,
				output: {
					success: false,
					error: errorMessage,
				},
			});
			requestTrace?.end?.();
			const fallbackText = `I couldn't create the survey yet: ${errorMessage}`;
			await persistQuickCreateTurn({
				threadId,
				threadResourceId,
				userText: lastUserText,
				assistantText: fallbackText,
			}).catch((persistError) => {
				consola.warn("project-status: failed to persist survey quick-create failure", {
					error: persistError instanceof Error ? persistError.message : String(persistError),
					threadId,
				});
			});
			return createUIMessageStreamResponse({
				stream: streamPlainAssistantText(fallbackText),
			});
		}
	}

	const fastGuidanceCacheKey =
		isFastStandardized && !debugRequested
			? `${projectId}:${hashString(lastUserText.trim().toLowerCase())}:${hashString(systemContext)}`
			: null;

	if (fastGuidanceCacheKey) {
		const cached = fastGuidanceCache.get(fastGuidanceCacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			consola.info("project-status: fast standardized cache hit", {
				targetAgentId,
				projectId,
			});
			requestGeneration?.end?.({
				output: { text: cached.text, cached: true },
			});
			requestTrace?.update?.({ output: { text: cached.text, cached: true } });
			requestTrace?.end?.();
			return createUIMessageStreamResponse({
				stream: streamPlainAssistantText(cached.text),
			});
		}
		if (cached) {
			fastGuidanceCache.delete(fastGuidanceCacheKey);
		}
	}

	// Set up billing context for agent LLM calls
	const billingCtx = userBillingContext({
		accountId,
		userId,
		featureSource: "project_status_agent",
		projectId,
	});
	setActiveBillingContext(billingCtx, `agent:project-status:${userId}:${projectId}`);

	// Helper to handle corrupted thread recovery
	const handleCorruptedThread = async (corruptedThreadId: string, errorMessage: string) => {
		consola.warn("project-status: Corrupted thread detected, deleting and creating fresh", {
			corruptedThreadId,
			error: errorMessage,
		});

		// Delete the corrupted thread so it doesn't get picked up again
		try {
			await memory.deleteThread(corruptedThreadId);
		} catch (deleteError) {
			consola.error("project-status: failed to delete corrupted thread", {
				deleteError,
			});
		}

		// Create a fresh thread
		const freshThread = await memory.createThread({
			resourceId: threadResourceId,
			title: buildShortThreadTitle(threadTitleSeed),
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
				source: "chat_recovery",
			},
		});
		return freshThread.id;
	};

	const buildAgentParams = (useThreadId: string) => ({
		messages: runtimeMessagesForExecution,
		maxSteps: targetMaxSteps,
		clientTools: {
			navigateToPage: navigateToPageTool,
			switchAgent: switchAgentTool,
		},
		memory: {
			thread: useThreadId,
			resource: threadResourceId,
		},
		requestContext,
		context: [
			...(system
				? ([
						{
							role: "system" as const,
							content: `## Context from the client's UI:\n${systemContext}`,
						},
					] as const)
				: []),
			...(typedUiEvents.length > 0
				? ([
						{
							role: "system" as const,
							content: `## Typed UI events from client
${JSON.stringify(typedUiEvents, null, 2)}`,
						},
					] as const)
				: []),
			...(debugRequested
				? ([
						{
							role: "system" as const,
							content:
								'DEBUG MODE: Answer normally first. Then append a brief "Debug Trace" listing tools called and why.',
						},
					] as const)
				: []),
			...(csvListContract
				? ([
						{
							role: "system" as const,
							content: `## Output Contract (MANDATORY)
The user requested CSV output with exactly ${csvListContract.requestedRows} data rows.
- Return plain CSV only (no markdown table, no code fences, no prose).
- Include one header row, then exactly ${csvListContract.requestedRows} rows.
- If there are more candidates, keep only the top ${csvListContract.requestedRows}.`,
						},
					] as const)
				: []),
		],
		onFinish: async (data: {
			usage?: { inputTokens?: number; outputTokens?: number };
			finishReason?: string;
			toolCalls?: unknown[];
			text?: string;
			steps?: unknown[];
		}) => {
			if (isFastStandardized && !debugRequested && fastGuidanceCacheKey && data.text?.trim()) {
				fastGuidanceCache.set(fastGuidanceCacheKey, {
					text: data.text.trim(),
					expiresAt: Date.now() + FAST_STANDARDIZED_CACHE_TTL_MS,
				});
			}

			const usage = data.usage;
			const traceUsage = mapUsageToLangfuse(usage);
			const traceCostUsd =
				usage && (usage.inputTokens || usage.outputTokens)
					? estimateOpenAICost(
							BILLING_MODEL_BY_AGENT[targetAgentId] || "gpt-4o",
							usage.inputTokens || 0,
							usage.outputTokens || 0
						)
					: null;
			const traceCostDetails = mapCostDetailsToLangfuse(traceCostUsd);
			if (usage && (usage.inputTokens || usage.outputTokens) && billingCtx.accountId) {
				const model = BILLING_MODEL_BY_AGENT[targetAgentId] || "gpt-4o";
				const inputTokens = usage.inputTokens || 0;
				const outputTokens = usage.outputTokens || 0;
				const costUsd = traceCostUsd ?? estimateOpenAICost(model, inputTokens, outputTokens);

				consola.info("project-status: billing", {
					inputTokens,
					outputTokens,
					costUsd,
				});

				await recordUsageOnly(
					billingCtx,
					{
						provider: "openai",
						model,
						inputTokens,
						outputTokens,
						estimatedCostUsd: costUsd,
					},
					`agent:project-status:${userId}:${projectId}:${Date.now()}`
				).catch((err) => {
					consola.error("[billing] Failed to record agent usage:", err);
				});
			}

			if (targetAgentId === "howtoAgent") {
				const rawQuality = evaluateHowtoResponseContract(data.text ?? "");
				consola.info("project-status: howto model telemetry", {
					projectId,
					accountId,
					responseMode: resolvedResponseMode,
					routingSource,
					routingConfidence: routeDecision?.confidence ?? null,
					finishReason: data.finishReason ?? null,
					inputTokens: usage?.inputTokens ?? 0,
					outputTokens: usage?.outputTokens ?? 0,
					rawResponseChars: (data.text ?? "").trim().length,
					rawContractPassed: rawQuality.passes,
					rawMissingSections: rawQuality.missingSections,
					rawHasMarkdownLink: rawQuality.hasMarkdownLink,
				});
			}

			requestGeneration?.end?.({
				output: {
					text: data.text ?? "",
					finishReason: data.finishReason ?? null,
					toolCallCount: Array.isArray(data.toolCalls) ? data.toolCalls.length : 0,
					stepCount: data.steps?.length ?? 0,
				},
				usage: traceUsage.usage,
				usageDetails: traceUsage.usageDetails,
				costDetails: traceCostDetails,
			});
			requestTrace?.update?.({
				output: {
					text: data.text ?? "",
					finishReason: data.finishReason ?? null,
					toolCallCount: Array.isArray(data.toolCalls) ? data.toolCalls.length : 0,
					stepCount: data.steps?.length ?? 0,
				},
			});
			requestTrace?.end?.();

			clearActiveBillingContext();

			consola.debug("project-status: finished", {
				steps: data.steps?.length || 0,
			});
		},
	});

	// Use handleChatStream for ALL agents, including projectStatusAgent.
	// Previously projectStatusAgent used handleNetworkStream (agent.network()),
	// but that emits internal "Completion Check Results" text into the response stream.
	// handleChatStream still supports sub-agent delegation via the agents: {} config
	// on the agent definition — Mastra makes sub-agents available as callable tools.
	let stream: Awaited<ReturnType<typeof handleChatStream>> | undefined;
	try {
		stream = await handleChatStream({
			mastra,
			agentId: targetAgentId,
			params: buildAgentParams(threadId),
			sendReasoning: false,
			sendSources: !isFastStandardized,
		});
	} catch (error) {
		// Check if this is the "No tool call found" error from corrupted memory
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (
			errorMessage.includes("No tool call found") ||
			errorMessage.includes("function call output") ||
			errorMessage.includes("Duplicate item found")
		) {
			threadId = await handleCorruptedThread(threadId, errorMessage);
			stream = await handleChatStream({
				mastra,
				agentId: targetAgentId,
				params: buildAgentParams(threadId),
				sendReasoning: false,
				sendSources: !isFastStandardized,
			});
		} else {
			consola.error("project-status: failed to initialize stream", {
				error: errorMessage,
				targetAgentId,
				projectId,
			});
			requestTrace?.update?.({
				output: {
					error: errorMessage,
					targetAgentId,
					responseMode: resolvedResponseMode,
				},
			});
			requestGeneration?.end?.({
				level: "ERROR",
				statusMessage: errorMessage,
				output: {
					error: errorMessage,
					targetAgentId,
					responseMode: resolvedResponseMode,
				},
			});
			requestTrace?.end?.();
			const debugSuffix = debugRequested
				? `\n\nDebug Trace:\n- routed_to: ${targetAgentId}\n- response_mode: ${resolvedResponseMode}\n- max_steps: ${targetMaxSteps}\n- tool_calls: none (stream init failed)`
				: "";
			const failureText = buildStreamInitFailureMessage(errorMessage, targetAgentId);
			return createUIMessageStreamResponse({
				stream: streamPlainAssistantText(`${failureText}${debugSuffix}`),
			});
		}
	}

	const reliableStream = augmentStreamForReliability(stream, {
		debugRequested,
		targetAgentId,
		targetMaxSteps,
		responseMode: resolvedResponseMode,
		accountId,
		projectId,
		lastUserText,
		routingSource,
		routingConfidence: routeDecision?.confidence ?? null,
		userId,
		threadId,
		csvListContract,
	});

	return createUIMessageStreamResponse({ stream: reliableStream });
}
