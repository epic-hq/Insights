import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { evidenceDetailSchema } from "~/schemas"
import type { Database, Evidence, Interview } from "~/types"

const DEFAULT_EVIDENCE_LIMIT = 50

function normalizeDate(value: unknown) {
	if (!value) return null
	if (value instanceof Date) return value.toISOString()
	if (typeof value === "string") return value
	return null
}

export const fetchEvidenceTool = createTool({
	id: "fetch-evidence",
	description:
		"Fetch evidence records from a project with filtering and pagination. Includes related interview, person, and insight data.",
	inputSchema: z.object({
		projectId: z
			.string()
			.optional()
			.describe("Project ID to fetch evidence from. Defaults to the current project in context."),
		interviewId: z.string().optional().describe("Filter evidence by specific interview ID."),
		personId: z.string().optional().describe("Filter evidence by specific person ID."),
		evidenceSearch: z
			.string()
			.optional()
			.describe("Case-insensitive search string to match evidence content (gist, verbatim, chunk)."),
		evidenceLimit: z.number().int().min(1).max(100).optional().describe("Maximum number of evidence items to return."),
		includeInterview: z.boolean().optional().describe("Whether to include interview details for each evidence item."),
		includePerson: z.boolean().optional().describe("Whether to include person details for each evidence item."),
		includeInsights: z.boolean().optional().describe("Whether to include related insights for each evidence item."),
		modality: z
			.enum(["qual", "quant"])
			.optional()
			.describe("Filter by evidence modality (qualitative or quantitative)."),
		confidence: z.enum(["low", "medium", "high"]).optional().describe("Filter by evidence confidence level."),
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
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = runtimeContext?.get?.("project_id")
		const runtimeAccountId = runtimeContext?.get?.("account_id")

		const projectId = context?.projectId ?? runtimeProjectId ?? ""
		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : undefined
		const interviewId = context?.interviewId?.trim()
		const personId = context?.personId?.trim()
		const evidenceSearch = (context?.evidenceSearch ?? "").trim()
		const sanitizedEvidenceSearch = evidenceSearch.replace(/[%*"'()]/g, "").trim()
		const evidenceLimit = context?.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT
		const includeInterview = context?.includeInterview ?? true
		const includePerson = context?.includePerson ?? true
		const includeInsights = context?.includeInsights ?? false
		const modality = context?.modality
		const confidence = context?.confidence

		const filtersApplied = {
			interviewId: interviewId || null,
			personId: personId || null,
			modality: modality || null,
			confidence: confidence || null,
		}

		consola.info("fetch-evidence: execute start", {
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
		})

		if (!projectId) {
			consola.warn("fetch-evidence: missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				evidence: [],
				totalCount: 0,
				searchApplied: null,
				filtersApplied,
			}
		}

		try {
			// Build the base query for evidence
			let query = supabase
				.from("evidence")
				.select(`
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
				`)
				.eq("project_id", projectId)

			// Apply filters
			if (interviewId) {
				query = query.eq("interview_id", interviewId)
			}

			if (modality) {
				query = query.eq("modality", modality)
			}

			if (confidence) {
				query = query.eq("confidence", confidence)
			}

			// Execute the main query (without search filter for counting)
			const { data: evidenceData, error: evidenceError } = await query
				.order("created_at", { ascending: false })
				.limit(evidenceLimit * 2) // Fetch more to allow for filtering

			if (evidenceError) {
				consola.error("fetch-evidence: failed to fetch evidence", evidenceError)
				throw evidenceError
			}

			let evidenceRows = (evidenceData as Evidence[] | null) ?? []

			// Get evidence IDs for related data queries
			const evidenceIds = evidenceRows.map((row) => row.id)

			// Filter by person if specified
			if (personId && evidenceIds.length > 0) {
				const { data: personEvidenceIds } = await supabase
					.from("interview_people")
					.select("interview_id")
					.eq("person_id", personId)

				if (personEvidenceIds) {
					const interviewIds = personEvidenceIds.map((ip) => ip.interview_id).filter(Boolean)
					evidenceRows = evidenceRows.filter((row) => row.interview_id && interviewIds.includes(row.interview_id))
				}
			}

			// Apply JavaScript-based search filtering if search term provided
			if (sanitizedEvidenceSearch) {
				const searchLower = sanitizedEvidenceSearch.toLowerCase()
				evidenceRows = evidenceRows.filter((row) => {
					const searchableText = [row.gist, row.verbatim, row.chunk, row.context_summary, row.citation]
						.filter(Boolean)
						.join(" ")
						.toLowerCase()

					return searchableText.includes(searchLower)
				})
			}

			// Apply limit after filtering
			evidenceRows = evidenceRows.slice(0, evidenceLimit)

			// Get total count for pagination info
			const { count: totalCount } = await supabase
				.from("evidence")
				.select("*", { count: "exact", head: true })
				.eq("project_id", projectId)

			// Fetch additional related data if requested
			const [interviewData, personData, insightsData] = await Promise.all([
				includeInterview && evidenceRows.length > 0
					? supabase
							.from("interviews")
							.select("id, title, interview_date, status")
							.in(
								"id",
								evidenceRows
									.map((row) => row.interview_id)
									.filter((id): id is string => Boolean(id)) || []
							)
					: Promise.resolve({ data: null }),

				includePerson && evidenceRows.length > 0
					? supabase
							.from("interview_people")
							.select(`
							interview_id,
							people:person_id(id, name)
						`)
							.in(
								"interview_id",
								evidenceRows
									.map((row) => row.interview_id)
									.filter((id): id is string => Boolean(id)) || []
							)
					: Promise.resolve({ data: null }),

				includeInsights && evidenceRows.length > 0
					? supabase
							.from("insights")
							.select("id, name, details, interview_id")
							.eq("project_id", projectId)
							.in(
								"interview_id",
								evidenceRows
									.map((row) => row.interview_id)
									.filter((id): id is string => Boolean(id)) || []
							)
					: Promise.resolve({ data: null }),
			])

			// Organize related data by interview_id for efficient lookup
			const interviewsById = new Map<
				string,
				{
					id: string
					title: string | null
					interviewDate: string | null
					status: string | null
				}
			>()
			const peopleByInterviewId = new Map<
				string,
				Array<{
					id: string
					name: string | null
					role: string | null
				}>
			>()
			const insightsByInterviewId = new Map<
				string,
				Array<{
					id: string
					name: string | null
					summary: string | null
				}>
			>()

			if (interviewData?.data) {
				for (const interview of interviewData.data as Interview[]) {
					interviewsById.set(interview.id, {
						id: interview.id,
						title: interview.title,
						interviewDate: normalizeDate(interview.interview_date),
						status: interview.status,
					})
				}
			}

			if (personData?.data) {
				for (const ip of personData.data as unknown as Array<{
					interview_id: string
					people: { id: string; name: string | null } | null
				}>) {
					const existing = peopleByInterviewId.get(ip.interview_id) ?? []
					if (ip.people) {
						existing.push({
							id: ip.people.id,
							name: ip.people.name,
							role: null, // role not selected in this query
						})
					}
					peopleByInterviewId.set(ip.interview_id, existing)
				}
			}

			if (insightsData?.data) {
				for (const insight of insightsData.data as Insight[]) {
					const existing = insightsByInterviewId.get(insight.interview_id) ?? []
					existing.push({
						id: insight.id,
						name: insight.name,
						summary: insight.details || null,
					})
					insightsByInterviewId.set(insight.interview_id, existing)
				}
			}

			// Build the final result
			const evidence = evidenceRows.map((row) => ({
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
				interviewTitle: interviewsById.get(row.interview_id)?.title ?? null,
				interviewDate: interviewsById.get(row.interview_id)?.interviewDate ?? null,
				interviewStatus: interviewsById.get(row.interview_id)?.status ?? null,
				personName: peopleByInterviewId.get(row.interview_id)?.[0]?.name ?? null,
				personRole: peopleByInterviewId.get(row.interview_id)?.[0]?.role ?? null,
				insightCount: insightsByInterviewId.get(row.interview_id)?.length ?? 0,
			}))

			return {
				success: true,
				message,
				projectId,
				evidence,
				totalCount: totalCount ?? 0,
				searchApplied: sanitizedEvidenceSearch || null,
				filtersApplied,
			}
		} catch (error) {
			consola.error("fetch-evidence: unexpected error", error)
			return {
				success: false,
				message: "Unexpected error fetching evidence.",
				projectId,
				evidence: [],
				totalCount: 0,
				searchApplied: null,
				filtersApplied,
			}
		}
	},
})
