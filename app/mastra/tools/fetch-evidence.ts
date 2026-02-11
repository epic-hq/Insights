import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase/client.server";
import { HOST } from "../../paths";
import { evidenceDetailSchema } from "../../schemas";
import type { Database, Evidence, Insight, Interview } from "../../types";
import { createRouteDefinitions } from "../../utils/route-definitions";

const DEFAULT_EVIDENCE_LIMIT = 50;

function normalizeDate(value: unknown) {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return null;
}

export const fetchEvidenceTool = createTool({
	id: "fetch-evidence",
	description:
		"Fetch evidence records from a project with filtering and pagination. Includes related interview, person, and insight data.",
	inputSchema: z.object({
		projectId: z
			.string()
			.nullish()
			.describe("Project ID to fetch evidence from. Defaults to the current project in context."),
		interviewId: z.string().nullish().describe("Filter evidence by specific interview ID."),
		personId: z.string().nullish().describe("Filter evidence by specific person ID."),
		evidenceSearch: z
			.string()
			.nullish()
			.describe("Case-insensitive search string to match evidence content (gist, verbatim, chunk)."),
		evidenceLimit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.nullish()
			.transform((val) => val ?? DEFAULT_EVIDENCE_LIMIT)
			.describe("Maximum number of evidence items to return."),
		includeInterview: z
			.boolean()
			.nullish()
			.transform((val) => val ?? true)
			.describe("Whether to include interview details for each evidence item."),
		includePerson: z
			.boolean()
			.nullish()
			.transform((val) => val ?? true)
			.describe("Whether to include person details for each evidence item."),
		includeInsights: z
			.boolean()
			.nullish()
			.transform((val) => val ?? false)
			.describe("Whether to include related insights for each evidence item."),
		modality: z
			.enum(["qual", "quant"])
			.nullish()
			.describe("Filter by evidence modality (qualitative or quantitative)."),
		confidence: z.enum(["low", "medium", "high"]).nullish().describe("Filter by evidence confidence level."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		evidence: z.array(evidenceDetailSchema),
		totalCount: z.number(),
		searchApplied: z.string().nullable(),
		filtersApplied: z.object({
			interviewId: z.string().nullable(),
			personId: z.string().nullable(),
			modality: z.string().nullable(),
			confidence: z.string().nullable(),
		}),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		const runtimeProjectIdStr = runtimeProjectId ? String(runtimeProjectId).trim() : undefined;
		const projectId = input.projectId ?? runtimeProjectIdStr ?? null;
		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : undefined;
		const interviewId = input.interviewId?.trim();
		const personId = input.personId?.trim();
		const evidenceSearch = (input.evidenceSearch ?? "").trim();
		const sanitizedEvidenceSearch = evidenceSearch.replace(/[%*"'()]/g, "").trim();
		const evidenceLimit = input.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT;
		const includeInterview = input.includeInterview ?? true;
		const includePerson = input.includePerson ?? true;
		const includeInsights = input.includeInsights ?? false;
		const modality = input.modality;
		const confidence = input.confidence;

		const filtersApplied = {
			interviewId: interviewId || null,
			personId: personId || null,
			modality: modality || null,
			confidence: confidence || null,
		};

		consola.debug("fetch-evidence: execute start", {
			projectId,
			accountId,
			interviewId,
			personId,
			evidenceSearch: sanitizedEvidenceSearch,
			evidenceLimit,
			includeInterview,
			includePerson,
			includeInsights,
			modality,
			confidence,
		});

		if (!projectId) {
			consola.warn("fetch-evidence: missing projectId");
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				evidence: [],
				totalCount: 0,
				searchApplied: null,
				filtersApplied,
			};
		}

		// At this point, projectId is guaranteed to be a string
		const projectIdStr = projectId as string;

		try {
			// Build the base query for evidence
			let query = supabase
				.from("evidence")
				.select(
					`
					id,
					project_id,
					interview_id,
					source_type,
					method,
					modality,
					support,
					journey_stage,
					topic,
					confidence,
					chunk,
					gist,
					verbatim,
					context_summary,
					citation,
					is_question,
					says,
					does,
					thinks,
					feels,
					pains,
					gains,
					created_at,
					updated_at
				`
				)
				.eq("project_id", projectIdStr)
				.is("deleted_at", null)
				.eq("is_archived", false);

			// Apply filters
			if (interviewId) {
				query = query.eq("interview_id", interviewId);
			}

			if (modality) {
				query = query.eq("modality", modality);
			}

			if (confidence) {
				query = query.eq("confidence", confidence);
			}

			// Execute the main query (without search filter for counting)
			const { data: evidenceData, error: evidenceError } = await query
				.order("created_at", { ascending: false })
				.limit(evidenceLimit * 2); // Fetch more to allow for filtering

			if (evidenceError) {
				consola.error("fetch-evidence: failed to fetch evidence", evidenceError);
				throw evidenceError;
			}

			let evidenceRows = (evidenceData as Evidence[] | null) ?? [];

			// Get evidence IDs for related data queries
			const evidenceIds = evidenceRows.map((row) => row.id);

			// Filter by person if specified
			if (personId && evidenceIds.length > 0) {
				const { data: personEvidenceIds } = await supabase
					.from("interview_people")
					.select("interview_id")
					.eq("person_id", personId);

				if (personEvidenceIds) {
					const interviewIds = personEvidenceIds.map((ip) => ip.interview_id).filter(Boolean);
					evidenceRows = evidenceRows.filter((row) => row.interview_id && interviewIds.includes(row.interview_id));
				}
			}

			// Apply JavaScript-based search filtering if search term provided
			if (sanitizedEvidenceSearch) {
				const searchLower = sanitizedEvidenceSearch.toLowerCase();
				evidenceRows = evidenceRows.filter((row) => {
					const searchableText = [row.gist, row.verbatim, row.chunk, row.context_summary, row.citation]
						.filter(Boolean)
						.join(" ")
						.toLowerCase();

					return searchableText.includes(searchLower);
				});
			}

			// Apply limit after filtering
			evidenceRows = evidenceRows.slice(0, evidenceLimit);

			// Get total count for pagination info
			const { count: totalCount } = await supabase
				.from("evidence")
				.select("*", { count: "exact", head: true })
				.eq("project_id", projectIdStr)
				.is("deleted_at", null)
				.eq("is_archived", false);

			// Fetch additional related data if requested
			const [interviewData, personData, insightsData] = await Promise.all([
				includeInterview && evidenceRows.length > 0
					? supabase
							.from("interviews")
							.select("id, title, interview_date, status")
							.in("id", evidenceRows.map((row) => row.interview_id).filter((id): id is string => Boolean(id)) || [])
					: Promise.resolve({ data: null }),

				includePerson && evidenceRows.length > 0
					? supabase
							.from("interview_people")
							.select(
								`
							interview_id,
							people:person_id(id, name)
						`
							)
							.in(
								"interview_id",
								evidenceRows.map((row) => row.interview_id).filter((id): id is string => Boolean(id)) || []
							)
					: Promise.resolve({ data: null }),

				includeInsights && evidenceRows.length > 0
					? supabase
							.from("themes")
							.select("id, name, details, interview_id")
							.eq("project_id", projectIdStr)
							.in(
								"interview_id",
								evidenceRows.map((row) => row.interview_id).filter((id): id is string => Boolean(id)) || []
							)
					: Promise.resolve({ data: null }),
			]);

			// Organize related data by interview_id for efficient lookup
			const interviewsById = new Map<
				string,
				{
					id: string;
					title: string | null;
					interviewDate: string | null;
					status: string | null;
				}
			>();
			const peopleByInterviewId = new Map<
				string,
				Array<{
					id: string;
					name: string | null;
					role: string | null;
				}>
			>();
			const insightsByInterviewId = new Map<
				string,
				Array<{
					id: string;
					name: string | null;
					summary: string | null;
				}>
			>();

			if (interviewData?.data) {
				for (const interview of interviewData.data as Interview[]) {
					interviewsById.set(interview.id, {
						id: interview.id,
						title: interview.title,
						interviewDate: normalizeDate(interview.interview_date),
						status: interview.status,
					});
				}
			}

			if (personData?.data) {
				for (const ip of personData.data as unknown as Array<{
					interview_id: string;
					people: { id: string; name: string | null } | null;
				}>) {
					const existing = peopleByInterviewId.get(ip.interview_id) ?? [];
					if (ip.people) {
						existing.push({
							id: ip.people.id,
							name: ip.people.name,
							role: null, // role not selected in this query
						});
					}
					peopleByInterviewId.set(ip.interview_id, existing);
				}
			}

			if (insightsData?.data) {
				const insightsWithInterviewId = (insightsData.data as Insight[]).filter(
					(insight): insight is Insight & { interview_id: string } => Boolean(insight.interview_id)
				);
				for (const insight of insightsWithInterviewId) {
					const existing = insightsByInterviewId.get(insight.interview_id) ?? [];
					existing.push({
						id: insight.id,
						name: insight.name,
						summary: insight.details || null,
					});
					insightsByInterviewId.set(insight.interview_id, existing);
				}
			}

			// Build routes for URL generation
			const projectPath = accountId && projectIdStr ? `/a/${accountId}/${projectIdStr}` : "";
			const routes = projectPath ? createRouteDefinitions(projectPath) : null;

			// Build the final result
			const evidence = evidenceRows.map((row) => {
				const person = row.interview_id ? (peopleByInterviewId.get(row.interview_id)?.[0] ?? null) : null;
				return {
					id: row.id,
					projectId: row.project_id,
					interviewId: row.interview_id,
					verbatim: row.verbatim,
					gist: row.gist,
					contextSummary: row.context_summary,
					modality: row.modality,
					confidence: row.confidence,
					createdAt: normalizeDate(row.created_at),
					updatedAt: normalizeDate(row.updated_at),
					// Simplified related data
					interviewTitle: row.interview_id ? (interviewsById.get(row.interview_id)?.title ?? null) : null,
					interviewDate: row.interview_id ? (interviewsById.get(row.interview_id)?.interviewDate ?? null) : null,
					interviewStatus: row.interview_id ? (interviewsById.get(row.interview_id)?.status ?? null) : null,
					personName: person?.name ?? null,
					personId: person?.id ?? null,
					personRole: person?.role ?? null,
					insightCount: row.interview_id ? (insightsByInterviewId.get(row.interview_id)?.length ?? 0) : 0,
					url: routes ? `${HOST}${routes.evidence.detail(row.id)}` : null,
					interviewUrl: routes && row.interview_id ? `${HOST}${routes.interviews.detail(row.interview_id)}` : null,
					personUrl: routes && person?.id ? `${HOST}${routes.people.detail(person.id)}` : null,
				};
			});

			const message = sanitizedEvidenceSearch
				? `Found ${evidence.length} evidence records matching "${sanitizedEvidenceSearch}".`
				: `Retrieved ${evidence.length} evidence records.`;

			return {
				success: true,
				message,
				projectId,
				evidence,
				totalCount: totalCount ?? 0,
				searchApplied: sanitizedEvidenceSearch || null,
				filtersApplied,
			};
		} catch (error) {
			consola.error("fetch-evidence: unexpected error", error);
			return {
				success: false,
				message: "Unexpected error fetching evidence.",
				projectId,
				evidence: [],
				totalCount: 0,
				searchApplied: null,
				filtersApplied,
			};
		}
	},
});
