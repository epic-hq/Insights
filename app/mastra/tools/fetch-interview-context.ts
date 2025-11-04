import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const DEFAULT_EVIDENCE_LIMIT = 12

type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
type EvidenceRow = Database["public"]["Tables"]["evidence"]["Row"]
type InterviewParticipantRow = Database["public"]["Tables"]["interview_people"]["Row"] & {
	people?:
	| (Database["public"]["Tables"]["people"]["Row"] & {
		people_personas?: Array<{
			persona_id: string | null
			personas?: Database["public"]["Tables"]["personas"]["Row"] | null
		}> | null
	})
	| null
}

type InsightRow = Database["public"]["Tables"]["insights"]["Row"] & {
	insight_tags?: Array<{
		tags?: { tag?: string | null } | null
	}> | null
}

type EmpathyMapItem = {
	text: string
	evidenceId?: string
	anchors?: unknown
}

type EmpathyMap = {
	says: EmpathyMapItem[]
	does: EmpathyMapItem[]
	thinks: EmpathyMapItem[]
	feels: EmpathyMapItem[]
	pains: EmpathyMapItem[]
	gains: EmpathyMapItem[]
}

const emptyEmpathyMap = (): EmpathyMap => ({
	says: [],
	does: [],
	thinks: [],
	feels: [],
	pains: [],
	gains: [],
})

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((item) => (typeof item === "string" ? item.trim() : ""))
			.filter((item): item is string => Boolean(item))
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value)
			if (Array.isArray(parsed)) {
				return parsed
					.map((item) => (typeof item === "string" ? item.trim() : ""))
					.filter((item): item is string => Boolean(item))
			}
		} catch {
			const trimmed = value.trim()
			if (trimmed) return [trimmed]
		}
	}

	return []
}

function buildEmpathyMap(evidence: EvidenceRow[] | null | undefined): EmpathyMap {
	const map = emptyEmpathyMap()
	if (!Array.isArray(evidence)) {
		return map
	}

	for (const item of evidence) {
		const evidenceId = item.id

		if (Array.isArray(item.says)) {
			for (const says of item.says) {
				if (typeof says === "string" && says.trim()) {
					map.says.push({ text: says.trim(), evidenceId, anchors: item.anchors })
				}
			}
		}

		if (Array.isArray(item.does)) {
			for (const does of item.does) {
				if (typeof does === "string" && does.trim()) {
					map.does.push({ text: does.trim(), evidenceId, anchors: item.anchors })
				}
			}
		}

		if (Array.isArray(item.thinks)) {
			for (const thinks of item.thinks) {
				if (typeof thinks === "string" && thinks.trim()) {
					map.thinks.push({ text: thinks.trim(), evidenceId, anchors: item.anchors })
				}
			}
		}

		if (Array.isArray(item.feels)) {
			for (const feels of item.feels) {
				if (typeof feels === "string" && feels.trim()) {
					map.feels.push({ text: feels.trim(), evidenceId, anchors: item.anchors })
				}
			}
		}

		if (Array.isArray(item.pains)) {
			for (const pains of item.pains) {
				if (typeof pains === "string" && pains.trim()) {
					map.pains.push({ text: pains.trim(), evidenceId, anchors: item.anchors })
				}
			}
		}

		if (Array.isArray(item.gains)) {
			for (const gains of item.gains) {
				if (typeof gains === "string" && gains.trim()) {
					map.gains.push({ text: gains.trim(), evidenceId, anchors: item.anchors })
				}
			}
		}
	}

	return map
}

function summarizePersonalFacets(participants: InterviewParticipantRow[]): Array<{
	participantId?: number
	name: string | null
	summary: string | null
	personas: string[]
}> {
	return participants.map((participant) => {
		const person = participant.people
		const personaNames = Array.from(
			new Set(
				(person?.people_personas || [])
					?.map((entry) => entry?.personas?.name)
					.filter((name): name is string => Boolean(name)) ?? []
			)
		) as string[]

		const facets: string[] = []
		if (participant.role) facets.push(`Role: ${participant.role}`)
		if (person?.segment) facets.push(`Segment: ${person.segment}`)
		if (personaNames.length > 0) facets.push(`Personas: ${personaNames.join(", ")}`)

		return {
			participantId: participant.id,
			name: person?.name || participant.display_name || null,
			summary: facets.length > 0 ? facets.join(" | ") : null,
			personas: personaNames,
		}
	})
}

export const fetchInterviewContextTool = createTool({
	id: "fetch-interview-context",
	description:
		"Load interview-specific context, including interview metadata, participants, personal facets, insights, evidence, and empathy map highlights.",
	inputSchema: z.object({
		interviewId: z
			.string()
			.optional()
			.describe("Interview ID to load. Defaults to the interview ID in the runtime context."),
		includeEvidence: z
			.boolean()
			.optional()
			.describe("Set to false to omit evidence details when only high-level insights are required."),
		evidenceLimit: z.number().int().min(1).max(50).optional().describe("Maximum number of evidence items to return."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		data: z
			.object({
				interview: z
					.object({
						id: z.string(),
						title: z.string().optional(),
						participant_pseudonym: z.string().optional(),
						segment: z.string().optional(),
						interview_date: z.string().optional(),
						created_at: z.string().optional(),
						status: z.string().optional(),
						high_impact_themes: z.unknown().optional(),
						observations_and_notes: z.unknown().optional(),
						open_questions_and_next_steps: z.unknown().optional(),
					})
					.optional(),
				participants: z
					.array(
						z.object({
							id: z.number(),
							role: z.string().nullable(),
							transcript_key: z.string().nullable(),
							display_name: z.string().nullable(),
							person: z
								.object({
									id: z.string(),
									name: z.string().nullable(),
									segment: z.string().nullable(),
									description: z.string().nullable(),
									contact_info: z.unknown().nullable(),
									personas: z
										.array(
											z.object({
												id: z.string(),
												name: z.string().nullable(),
												color_hex: z.string().nullable(),
											})
										)
										.optional(),
								})
								.nullable(),
						})
					)
					.optional(),
				personalFacets: z
					.array(
						z.object({
							participantId: z.number().optional(),
							name: z.string().nullable(),
							summary: z.string().nullable(),
							personas: z.array(z.string()),
						})
					)
					.optional(),
				insights: z
					.array(
						z.object({
							id: z.string(),
							name: z.string().optional(),
							summary: z.string().optional(),
							pain: z.string().optional(),
							desired_outcome: z.string().optional(),
							category: z.string().optional(),
							journey_stage: z.string().optional(),
							emotional_response: z.string().optional(),
							updated_at: z.string().optional(),
							tags: z.array(z.string()).optional(),
						})
					)
					.optional(),
				evidence: z
					.array(
						z.object({
							id: z.string(),
							gist: z.string().nullable(),
							verbatim: z.string().nullable(),
							context_summary: z.string().nullable(),
							modality: z.string().nullable(),
							created_at: z.string().nullable(),
							says: z.array(z.string()).optional(),
							does: z.array(z.string()).optional(),
							thinks: z.array(z.string()).optional(),
							feels: z.array(z.string()).optional(),
							pains: z.array(z.string()).optional(),
							gains: z.array(z.string()).optional(),
						})
					)
					.optional(),
				empathyMap: z
					.object({
						says: z.array(
							z.object({
								text: z.string(),
								evidenceId: z.string().optional(),
								anchors: z.unknown().optional(),
							})
						),
						does: z.array(
							z.object({
								text: z.string(),
								evidenceId: z.string().optional(),
								anchors: z.unknown().optional(),
							})
						),
						thinks: z.array(
							z.object({
								text: z.string(),
								evidenceId: z.string().optional(),
								anchors: z.unknown().optional(),
							})
						),
						feels: z.array(
							z.object({
								text: z.string(),
								evidenceId: z.string().optional(),
								anchors: z.unknown().optional(),
							})
						),
						pains: z.array(
							z.object({
								text: z.string(),
								evidenceId: z.string().optional(),
								anchors: z.unknown().optional(),
							})
						),
						gains: z.array(
							z.object({
								text: z.string(),
								evidenceId: z.string().optional(),
								anchors: z.unknown().optional(),
							})
						),
					})
					.optional(),
			})
			.optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeInterviewId = runtimeContext?.get?.("interview_id")
		const runtimeProjectId = runtimeContext?.get?.("project_id")
		const runtimeAccountId = runtimeContext?.get?.("account_id")
		const interviewId = (context?.interviewId || runtimeInterviewId || "").trim()
		const projectId = (runtimeProjectId || "").trim()
		const accountId = runtimeAccountId
		const includeEvidence = context?.includeEvidence !== false
		const evidenceLimit = context?.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT

		consola.info("fetch-interview-context: execute start", {
			requestedInterviewId: context?.interviewId,
			resolvedInterviewId: interviewId,
			projectId,
			includeEvidence,
			evidenceLimit,
		})

		if (!interviewId) {
			consola.warn("fetch-interview-context: missing interviewId", {
				requestedInterviewId: context?.interviewId,
				runtimeInterviewId,
			})
			return {
				success: false,
				message: "Missing interviewId. Pass one explicitly or ensure the runtime context sets interview_id.",
			}
		}

		if (!projectId) {
			consola.warn("fetch-interview-context: missing projectId", {
				runtimeProjectId,
			})
			return {
				success: false,
				message: "Missing project_id in runtime context. This tool requires project scope to load interview data.",
			}
		}

		try {
			const [interviewResult, participantResult, insightsResult, evidenceResult] = await Promise.all([
				supabase
					.from("interviews")
					.select(
						"id, title, participant_pseudonym, segment, interview_date, created_at, status, high_impact_themes, observations_and_notes, open_questions_and_next_steps"
					)
					.eq("id", interviewId)
					.eq("project_id", projectId)
					.maybeSingle(),
				supabase
					.from("interview_people")
					.select(
						"id, role, transcript_key, display_name, created_at, people(id, name, segment, description, contact_info, people_personas(persona_id, personas(id, name, color_hex)))"
					)
					.eq("interview_id", interviewId)
					.order("created_at", { ascending: true }),
				supabase
					.from("insights")
					.select(
						"id, name, summary, pain, desired_outcome, category, journey_stage, emotional_response, updated_at, interview_id, project_id, insight_tags(tags(tag))"
					)
					.eq("interview_id", interviewId)
					.eq("project_id", projectId)
					.order("updated_at", { ascending: false }),
				includeEvidence
					? supabase
						.from("evidence")
						.select(
							"id, gist, verbatim, context_summary, modality, created_at, says, does, thinks, feels, pains, gains, anchors"
						)
						.eq("interview_id", interviewId)
						.eq("project_id", projectId)
						.order("created_at", { ascending: false })
						.limit(evidenceLimit)
					: Promise.resolve({ data: null, error: null }),
			])

			if (interviewResult.error) {
				consola.error("fetch-interview-context: failed to load interview", {
					interviewId,
					projectId,
					accountId,
					error: interviewResult.error,
				})
				return { success: false, message: interviewResult.error.message }
			}

			const interview = interviewResult.data as InterviewRow | null
			if (!interview) {
				return {
					success: false,
					message: "Interview not found or inaccessible for the current project.",
				}
			}

			if (participantResult.error) {
				consola.warn("fetch-interview-context: failed to load participants", {
					interviewId,
					projectId,
					error: participantResult.error,
				})
			}

			if (insightsResult.error) {
				consola.warn("fetch-interview-context: failed to load insights", {
					interviewId,
					projectId,
					error: insightsResult.error,
				})
			}

			if (evidenceResult && "error" in evidenceResult && evidenceResult.error) {
				consola.warn("fetch-interview-context: failed to load evidence", {
					interviewId,
					projectId,
					error: evidenceResult.error,
				})
			}

			const participants = (participantResult.data || []) as InterviewParticipantRow[]
			const personalFacets = summarizePersonalFacets(participants)
			const insights = (insightsResult.data || []) as InsightRow[]
			const evidence = includeEvidence ? ((evidenceResult.data || []) as EvidenceRow[]) : null
			const empathyMap = includeEvidence ? buildEmpathyMap(evidence) : emptyEmpathyMap()

			const formattedInsights = insights.map((row) => ({
				id: row.id,
				name: row.name || undefined,
				summary: row.summary || undefined,
				pain: row.pain || undefined,
				desired_outcome: row.desired_outcome || undefined,
				category: row.category || undefined,
				journey_stage: row.journey_stage || undefined,
				emotional_response: row.emotional_response || undefined,
				updated_at: row.updated_at || undefined,
				tags: Array.from(
					new Set(
						(row.insight_tags || [])
							.map((entry) => entry?.tags?.tag)
							.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
					)
				) as string[],
			}))

			const formattedEvidence = evidence?.map((row) => ({
				id: row.id,
				gist: row.gist,
				verbatim: row.verbatim,
				context_summary: row.context_summary,
				modality: row.modality,
				created_at: row.created_at,
				says: toStringArray(row.says),
				does: toStringArray(row.does),
				thinks: toStringArray(row.thinks),
				feels: toStringArray(row.feels),
				pains: toStringArray(row.pains),
				gains: toStringArray(row.gains),
			}))

			consola.info("fetch-interview-context: success", {
				interviewId,
				projectId,
				participantCount: participants.length,
				insightCount: formattedInsights.length,
				evidenceCount: formattedEvidence?.length ?? 0,
			})

			return {
				success: true,
				message: "Interview context loaded",
				data: {
					interview: {
						id: interview.id,
						title: interview.title || undefined,
						participant_pseudonym: interview.participant_pseudonym || undefined,
						segment: interview.segment || undefined,
						interview_date: interview.interview_date || undefined,
						created_at: interview.created_at || undefined,
						status: interview.status || undefined,
						high_impact_themes: interview.high_impact_themes || undefined,
						observations_and_notes: interview.observations_and_notes || undefined,
						open_questions_and_next_steps: interview.open_questions_and_next_steps || undefined,
					},
					participants: participants.map((participant) => ({
						id: participant.id,
						role: participant.role,
						transcript_key: participant.transcript_key,
						display_name: participant.display_name,
						person: participant.people
							? {
								id: participant.people.id,
								name: participant.people.name,
								segment: participant.people.segment,
								description: participant.people.description,
								contact_info: participant.people.contact_info,
								personas:
									participant.people.people_personas
										?.map((entry): { id: string; name: string | null; color_hex: string | null } | null =>
											entry?.personas
												? {
													id: entry.personas.id,
													name: entry.personas.name,
													color_hex: entry.personas.color_hex,
												}
												: null
										)
										.filter(
											(persona): persona is { id: string; name: string | null; color_hex: string | null } =>
												persona !== null
										) || undefined,
							}
							: null,
					})),
					personalFacets,
					insights: formattedInsights,
					evidence: formattedEvidence || undefined,
					empathyMap,
				},
			}
		} catch (error) {
			consola.error("fetch-interview-context: unexpected error", {
				interviewId,
				projectId,
				accountId,
				error,
			})
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unknown error fetching interview context",
			}
		}
	},
})
