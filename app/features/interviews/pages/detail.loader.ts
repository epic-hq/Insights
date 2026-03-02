/**
 * Interview Detail page — server loader and revalidation logic.
 * Extracted from detail.tsx for maintainability.
 */
import { convertMessages } from "@mastra/core/agent";
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import type { Database } from "~/../supabase/types";
import { getVoteCountsForEntities } from "~/features/annotations/db";
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db";
import {
	type LensAnalysisWithTemplate,
	type LensTemplate,
	loadLensAnalyses,
	loadLensTemplates,
} from "~/features/lenses/lib/loadLensAnalyses.server";
import { getPeopleOptions } from "~/features/people/db";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { userContext } from "~/server/user-context";
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server";
import type { EvidenceRecord } from "../lib/interviewDetailHelpers";
import { extractAnalysisFromInterview, matchTakeawaysToEvidence, parseFullName } from "../lib/interviewDetailHelpers";
import {
	CONVERSATION_OVERVIEW_TEMPLATE_KEY,
	parseConversationAnalysisLegacy,
	parseConversationOverviewLens,
} from "../lib/parseConversationAnalysis.server";
import { type EvidenceRow, processEmpathyMap } from "../lib/processEmpathyMap.server";

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId;
	const projectId = params.projectId;
	const interviewId = params.interviewId;

	if (!accountId || !projectId || !interviewId) {
		consola.error("❌ Missing required parameters:", {
			accountId,
			projectId,
			interviewId,
		});
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 });
	}

	try {
		consola.info("📊 Fetching interview data...");
		// Fetch interview data from database (includes notes now)
		const { data: interviewData, error: interviewError } = await getInterviewById({
			supabase,
			accountId,
			projectId,
			id: interviewId,
		});

		if (interviewError) {
			// If interview was deleted (0 rows), redirect to interviews list instead of error
			if (interviewError.code === "PGRST116") {
				consola.info("Interview deleted or not found, redirecting to list");
				throw redirect(`/a/${accountId}/${projectId}/interviews`);
			}
			consola.error("❌ Error fetching interview:", interviewError);
			throw new Response(`Error fetching interview: ${interviewError.message}`, { status: 500 });
		}

		if (!interviewData) {
			consola.info("Interview not found, redirecting to list");
			throw redirect(`/a/${accountId}/${projectId}/interviews`);
		}

		consola.info("✅ Interview data fetched successfully:", {
			interviewId: interviewData.id,
			title: interviewData.title,
			hasObservations: !!interviewData.observations_and_notes,
			observationsLength: interviewData.observations_and_notes?.length || 0,
			sourceType: interviewData.source_type,
		});

		// Fetch participant data separately to avoid junction table query issues
		let participants: Array<{
			id: number;
			role: string | null;
			transcript_key: string | null;
			display_name: string | null;
			cross_project?: boolean;
			people?: {
				id?: string;
				name?: string | null;
				segment?: string | null;
				company?: string | null;
				project_id?: string | null;
				people_personas?: Array<{
					personas?: { id?: string; name?: string | null } | null;
				}>;
			};
		}> = [];
		let primaryParticipant: {
			id?: string;
			name?: string | null;
			segment?: string | null;
			project_id?: string | null;
		} | null = null;

		try {
			const { data: participantData, error: participantError } = await getInterviewParticipants({
				supabase,
				projectId,
				interviewId: interviewId,
			});
			if (participantError) {
				throw new Error(participantError.message);
			}

			participants = (participantData || []).map((row) => {
				const person = row.people as
					| {
							id: string;
							name: string | null;
							segment: string | null;
							project_id: string | null;
							person_type?: string | null;
							people_personas?: Array<{
								personas?: { id?: string; name?: string | null } | null;
							}>;
							[key: string]: unknown;
					  }
					| undefined;
				const valid = !!person && person.project_id === projectId;
				const minimal = person
					? {
							id: person.id,
							name: person.name,
							segment: person.segment,
							company: (person as any).default_organization?.name ?? null,
							project_id: person.project_id,
							person_type: person.person_type ?? null,
							people_personas: Array.isArray(person.people_personas)
								? person.people_personas.map((pp) => ({
										personas: pp?.personas ? { id: pp.personas.id, name: pp.personas.name } : null,
									}))
								: undefined,
						}
					: undefined;
				return {
					id: row.id,
					role: row.role ?? null,
					transcript_key: row.transcript_key ?? null,
					display_name: row.display_name ?? null,
					people: person ? minimal : undefined,
					cross_project: !!person && !valid,
				};
			});
			{
				const found = participants.find((p) => p.people)?.people;
				primaryParticipant = found ?? null;
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			throw new Response(`Error fetching participants: ${msg}`, {
				status: 500,
			});
		}

		const { data: peopleOptions, error: peopleError } = await getPeopleOptions({
			supabase,
			accountId,
			projectId,
		});

		if (peopleError) {
			consola.warn("Could not load people options for participant assignment:", peopleError.message);
		}

		const peopleLookup = new Map<string, { name: string | null; person_type?: string | null }>();
		for (const option of peopleOptions ?? []) {
			if (option?.id) {
				peopleLookup.set(option.id, {
					name: option.name ?? null,
					person_type: option.person_type ?? null,
				});
			}
		}
		for (const participant of participants) {
			const person = participant.people;
			if (person?.id) {
				peopleLookup.set(person.id, {
					name: person.name ?? null,
					person_type: (person as any).person_type ?? null,
				});
			}
		}
		if (primaryParticipant?.id) {
			peopleLookup.set(primaryParticipant.id, {
				name: primaryParticipant.name ?? null,
				person_type: (primaryParticipant as any).person_type ?? null,
			});
		}

		let linkedOpportunity: { id: string; title: string } | null = null;
		let lensTemplates: LensTemplate[] = [];
		let lensAnalyses: Record<string, LensAnalysisWithTemplate> = {};

		try {
			if (supabase) {
				// Load generic lens system
				const [templates, analyses] = await Promise.all([
					loadLensTemplates(supabase),
					loadLensAnalyses(supabase, interviewId, accountId),
				]);
				lensTemplates = templates;
				lensAnalyses = analyses;

				// Check if interview is linked to an opportunity
				const { data: summaryData } = await supabase
					.from("sales_lens_summaries")
					.select("opportunity_id")
					.eq("interview_id", interviewId)
					.eq("project_id", projectId)
					.not("opportunity_id", "is", null)
					.limit(1)
					.single();

				if (summaryData?.opportunity_id) {
					const { data: oppData } = await supabase
						.from("opportunities")
						.select("id, title")
						.eq("id", summaryData.opportunity_id)
						.single();

					if (oppData) {
						linkedOpportunity = oppData;
					}
				}
			}
		} catch (error) {
			consola.warn("Failed to load sales lens for interview", {
				interviewId,
				error,
			});
		}

		// Read conversation analysis from the conversation-overview lens (primary)
		// with fallback to legacy JSONB blob for un-migrated interviews
		const overviewLens = lensAnalyses[CONVERSATION_OVERVIEW_TEMPLATE_KEY];
		const conversationAnalysis =
			overviewLens?.status === "completed"
				? parseConversationOverviewLens(
						overviewLens.analysis_data as Record<string, unknown>,
						overviewLens.processed_at
					)
				: parseConversationAnalysisLegacy(
						interviewData.conversation_analysis as Record<string, unknown> | null | undefined,
						interviewData.updated_at
					);

		// Check transcript availability without loading the actual content
		const { data: transcriptMeta, error: transcriptError } = await supabase
			.from("interviews")
			.select("transcript, transcript_formatted")
			.eq("id", interviewId)
			.eq("project_id", projectId)
			.single();

		if (transcriptError) {
			consola.warn("Could not check transcript availability:", transcriptError.message);
		}

		// Debug transcript availability
		consola.info("Transcript availability check:", {
			interviewId,
			hasTranscript: Boolean(transcriptMeta?.transcript),
			hasFormattedTranscript: Boolean(transcriptMeta?.transcript_formatted),
			transcriptLength: transcriptMeta?.transcript?.length || 0,
			transcriptFormattedType: typeof transcriptMeta?.transcript_formatted,
		});

		// Generate a fresh presigned URL for media access if needed
		let freshMediaUrl = interviewData.media_url;
		if (interviewData.media_url) {
			try {
				let r2Key = getR2KeyFromPublicUrl(interviewData.media_url);

				// If getR2KeyFromPublicUrl failed, try to extract key from malformed paths
				// Pattern: /a/{accountId}/{projectId}/interviews/interviews/{projectId}/{filename}
				// or interviews/{projectId}/{filename}
				if (!r2Key && !interviewData.media_url.startsWith("http")) {
					const pathParts = interviewData.media_url.split("/").filter(Boolean);
					// Look for "interviews" in the path and extract everything after it
					const interviewsIndex = pathParts.indexOf("interviews");
					if (interviewsIndex >= 0 && interviewsIndex < pathParts.length - 1) {
						// Check if next part is also "interviews" (doubled path bug)
						const startIndex =
							pathParts[interviewsIndex + 1] === "interviews" ? interviewsIndex + 2 : interviewsIndex + 1;
						r2Key = pathParts.slice(startIndex).join("/");
						// Add interviews prefix if not already there
						if (!r2Key.startsWith("interviews/")) {
							r2Key = `interviews/${r2Key}`;
						}
					}
				}

				if (r2Key) {
					// Generate a fresh presigned URL (valid for 1 hour)
					const presignedResult = createR2PresignedUrl({
						key: r2Key,
						expiresInSeconds: 60 * 60, // 1 hour
					});
					if (presignedResult) {
						freshMediaUrl = presignedResult.url;
					}
				}
			} catch (error) {
				consola.warn("Could not generate fresh presigned URL for media:", error);
				// Keep the original URL as fallback
			}
		}

		const interview = {
			...interviewData,
			media_url: freshMediaUrl, // Use fresh presigned URL
			participants,
			primaryParticipant,
			// Check transcript availability without loading content
			hasTranscript: !!transcriptMeta?.transcript,
			hasFormattedTranscript: !!transcriptMeta?.transcript_formatted,
		};

		// Extract analysis job information from interview.conversation_analysis
		const analysisJob = extractAnalysisFromInterview(interview);

		const { data: insightsData, error } = await getInterviewInsights({
			supabase,
			interviewId: interviewId,
		});

		if (error) {
			const msg = error instanceof Error ? error.message : String(error);
			consola.error("Error fetching insights for interview", {
				interviewId,
				error: msg,
			});
		}

		const insights = insightsData ?? [];

		// Fetch evidence related to this interview with person associations
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select(
				`
				*,
				evidence_people (
					person_id,
					role,
					people (
						id,
						name,
						segment
					)
				)
			`
			)
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: false });

		if (evidenceError) {
			consola.warn("Could not fetch evidence:", evidenceError.message);
		}

		const evidenceRows = (evidence || []) as Array<
			EvidenceRecord & {
				id: string;
			}
		>;
		const facetsByEvidenceId = new Map<
			string,
			Array<{
				kind_slug: string;
				label: string;
				facet_account_id: number;
			}>
		>();

		if (evidenceRows.length > 0) {
			const evidenceIdsForFacets = evidenceRows.map((row) => row.id);
			const { data: facetRows, error: facetError } = await supabase
				.from("evidence_facet")
				.select("evidence_id, kind_slug, label, facet_account_id")
				.eq("project_id", projectId)
				.in("evidence_id", evidenceIdsForFacets);

			if (facetError) {
				consola.warn("Could not fetch evidence facets:", facetError.message);
			} else {
				for (const row of (facetRows || []) as Array<{
					evidence_id: string | null;
					kind_slug: string | null;
					label: string | null;
					facet_account_id: number | null;
				}>) {
					if (!row.evidence_id || !row.kind_slug || !row.label || !row.facet_account_id) continue;
					const list = facetsByEvidenceId.get(row.evidence_id) || [];
					const hasFacet = list.some(
						(item) =>
							item.kind_slug === row.kind_slug &&
							item.label === row.label &&
							item.facet_account_id === row.facet_account_id
					);
					if (!hasFacet) {
						list.push({
							kind_slug: row.kind_slug,
							label: row.label,
							facet_account_id: row.facet_account_id,
						});
					}
					facetsByEvidenceId.set(row.evidence_id, list);
				}
			}
		}

		const evidenceWithFacets = evidenceRows.map((row) => ({
			...row,
			facets: facetsByEvidenceId.get(row.id) || [],
		}));

		// Batch-fetch vote counts for all evidence in one query
		// Filter out any evidence items without valid IDs
		const evidenceIds = evidenceWithFacets
			.map((e) => e.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);
		const { data: evidenceVoteCounts } = evidenceIds.length
			? await getVoteCountsForEntities({
					supabase,
					projectId,
					entityType: "evidence",
					entityIds: evidenceIds,
					userId: ctx.claims.sub,
				})
			: { data: {} };

		const empathyMap = processEmpathyMap(evidenceWithFacets as EvidenceRow[]);

		// Load tasks linked to this interview for quick visibility in the detail UI.
		const { data: linkedTaskRows, error: linkedTaskError } = await supabase
			.from("task_links")
			.select("task_id, tasks!inner(id, title, status, due_date, priority)")
			.eq("entity_type", "interview")
			.eq("entity_id", interviewId)
			.order("created_at", { ascending: false })
			.limit(25);

		if (linkedTaskError) {
			consola.warn("Could not fetch linked tasks for interview:", linkedTaskError.message);
		}

		const linkedTasks = (
			(linkedTaskRows || []) as Array<{
				task_id: string;
				tasks:
					| {
							id: string;
							title: string;
							status: string;
							due_date: string | null;
							priority: number | null;
					  }
					| Array<{
							id: string;
							title: string;
							status: string;
							due_date: string | null;
							priority: number | null;
					  }>
					| null;
			}>
		)
			.flatMap((row) => {
				if (!row.tasks) return [];
				return Array.isArray(row.tasks) ? row.tasks : [row.tasks];
			})
			.filter((task) => !!task?.id)
			.filter((task, idx, arr) => arr.findIndex((candidate) => candidate.id === task.id) === idx);

		// Fetch creator's name from user_settings
		let creatorName = "Unknown";
		if (interviewData.created_by) {
			const { data: creatorData } = await supabase
				.from("user_settings")
				.select("first_name, last_name, email")
				.eq("user_id", interviewData.created_by)
				.single();

			if (creatorData) {
				if (creatorData.first_name || creatorData.last_name) {
					creatorName = [creatorData.first_name, creatorData.last_name].filter(Boolean).join(" ");
				} else if (creatorData.email) {
					creatorName = creatorData.email;
				}
			}
		}

		let assistantMessages: UpsightMessage[] = [];
		const userId = ctx.claims.sub;
		if (userId) {
			const resourceId = `interviewStatusAgent-${userId}-${interviewId}`;
			try {
				const threads = await memory.listThreads({
					filter: { resourceId },
					orderBy: { field: "createdAt", direction: "DESC" },
					page: 0,
					perPage: 1,
				});
				const threadId = threads?.threads?.[0]?.id;
				if (threadId) {
					const { messages } = await memory.recall({
						threadId,
						perPage: 50,
					});
					assistantMessages = convertMessages(messages).to("AIV5.UI") as UpsightMessage[];
				}
			} catch (error) {
				consola.warn("Failed to load assistant history", { resourceId, error });
			}
		}

		// Match key takeaway evidence snippets to actual evidence records
		if (conversationAnalysis?.keyTakeaways && evidence?.length) {
			matchTakeawaysToEvidence(conversationAnalysis.keyTakeaways, evidenceWithFacets as EvidenceRecord[]);
		}

		const loaderResult = {
			accountId,
			projectId,
			interview,
			insights,
			evidence: evidenceWithFacets,
			evidenceVoteCounts: evidenceVoteCounts || {},
			empathyMap,
			linkedTasks,
			peopleOptions: peopleOptions || [],
			creatorName,
			analysisJob,
			assistantMessages,
			conversationAnalysis,
			linkedOpportunity,
			lensTemplates,
			lensAnalyses,
		};

		consola.info("✅ Loader completed successfully:", {
			accountId,
			projectId,
			interviewId: interview.id,
			insightsCount: insights?.length || 0,
			evidenceCount: evidence?.length || 0,
			assistantMessages: assistantMessages.length,
		});

		// Track interview_detail_viewed event for PLG instrumentation
		try {
			const posthogServer = getPostHogServerClient();
			if (posthogServer) {
				const userId = ctx.claims.sub;
				posthogServer.capture({
					distinctId: userId,
					event: "interview_detail_viewed",
					properties: {
						interview_id: interviewId,
						project_id: projectId,
						account_id: accountId,
						has_transcript: interview.hasTranscript,
						has_analysis: !!conversationAnalysis,
						evidence_count: evidence?.length || 0,
						insights_count: insights?.length || 0,
						$groups: { account: accountId },
					},
				});
			}
		} catch (trackingError) {
			consola.warn("[INTERVIEW_DETAIL] PostHog tracking failed:", trackingError);
			// Don't throw - tracking failure shouldn't block user flow
		}

		return loaderResult;
	} catch (error) {
		// Re-throw Response errors directly without wrapping
		if (error instanceof Response) {
			throw error;
		}

		const msg = error instanceof Error ? error.message : String(error);
		consola.error("❌ Loader caught error:", error);
		consola.error("Error details:", {
			message: msg,
			accountId,
			projectId,
			interviewId,
		});
		throw new Response(`Failed to load interview: ${msg}`, { status: 500 });
	}
}
