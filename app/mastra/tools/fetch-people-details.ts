import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { contactInfoSchema } from "~/schemas"
import { personDetailSchema } from "~/schemas"
import type { Database, Interview, InterviewPeople, PeoplePersona, Person, ProjectPeople } from "~/types"

type ProjectPeopleRow = ProjectPeople & {
	person?: Person
}
type PeoplePersonaRow = PeoplePersona & {
	personas?: Database["public"]["Tables"]["personas"]["Row"] | null
}
type InterviewPeopleRow = InterviewPeople & {
	interview?: Interview | null
}

function normalizeDate(value: unknown) {
	if (!value) return null
	if (value instanceof Date) return value.toISOString()
	if (typeof value === "string") return value
	return null
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	const cleaned = value
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter((item): item is string => Boolean(item))
	return Array.from(new Set(cleaned))
}

export const fetchPeopleDetailsTool = createTool({
	id: "fetch-people-details",
	description:
		"Fetch detailed information about people in a project, including demographics, professional info, preferences, attributes, motivations, personas, and interview history.",
	inputSchema: z.object({
		projectId: z
			.string()
			.optional()
			.describe("Project ID to fetch people from. Defaults to the current project in context."),
		peopleSearch: z
			.string()
			.optional()
			.describe("Case-insensitive search string to match people by name or display name."),
		peopleLimit: z.number().int().min(1).max(50).optional().describe("Maximum number of people to return."),
		includeEvidence: z.boolean().optional().describe("Whether to include evidence counts and interview details."),
		includePersonas: z.boolean().optional().describe("Whether to include persona assignments for each person."),
		specificPersonIds: z.array(z.string()).optional().describe("Specific person IDs to fetch details for."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		people: z.array(personDetailSchema),
		totalCount: z.number(),
		searchApplied: z.string().nullable(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = runtimeContext?.get?.("project_id")
		const runtimeAccountId = runtimeContext?.get?.("account_id")

		const projectId = String(context?.projectId ?? runtimeProjectId ?? "")
		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : undefined
		const peopleSearch = (context?.peopleSearch ?? "").trim()
		const sanitizedPersonSearch = peopleSearch.replace(/[%*"'()]/g, "").trim()
		const peopleLimit = context?.peopleLimit ?? 20
		const includeEvidence = context?.includeEvidence ?? true
		const includePersonas = context?.includePersonas ?? true
		const specificPersonIds = context?.specificPersonIds ?? []

		consola.info("fetch-people-details: execute start", {
			projectId,
			accountId,
			peopleSearch: sanitizedPersonSearch,
			peopleLimit,
			includeEvidence,
			includePersonas,
			specificPersonIds: specificPersonIds.length,
		})

		if (!projectId) {
			consola.warn("fetch-people-details: missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				people: [],
				totalCount: 0,
				searchApplied: null,
			}
		}

		try {
			// Build the base query for project_people with person details
			let query = supabase
				.from("project_people")
				.select(`
					id,
					person_id,
					role,
					interview_count,
					first_seen_at,
					last_seen_at,
					created_at,
					updated_at,
					person:person_id(
						id,
						name,
						age,
						gender,
						pronouns,
						title,
						company,
						occupation,
						role,
						segment,
						industry,
						income,
						location,
						timezone,
						languages,
						education,
						lifecycle_stage,
						description,
						preferences,
						image_url,
						linkedin_url,
						website_url,
						contact_info,
						primary_email,
						primary_phone,
						created_at,
						updated_at
					)
				`)
				.eq("project_id", projectId)

			// Apply database-side search filtering if search term provided
			if (sanitizedPersonSearch) {
				// Split search term into individual words for more lenient matching
				const searchWords = sanitizedPersonSearch.split(/\s+/).filter((word) => word.length > 0)
				const searchConditions = searchWords.flatMap((word) => {
					const searchPattern = `%${word}%`
					return [
						`name.ilike.${searchPattern}`,
						`title.ilike.${searchPattern}`,
						`company.ilike.${searchPattern}`,
						`role.ilike.${searchPattern}`,
					]
				})

				// Use OR conditions for each word, making it very lenient
				// This allows matching any of the search words in any of the fields
				query = query.or(searchConditions.join(","), { foreignTable: "person" })
			}

			// Execute the query with search filter applied
			const { data: projectPeople, error: peopleError } = await query
				.order("interview_count", { ascending: false, nullsFirst: false })
				.limit(peopleLimit)

			if (peopleError) {
				consola.error("fetch-people-details: failed to fetch project people", peopleError)
				throw peopleError
			}

			let peopleRows = (projectPeople as ProjectPeopleRow[] | null) ?? []

			// Remove the JavaScript-based search filtering since we now do it in the database
			// if (sanitizedPersonSearch) {
			// 	const searchLower = sanitizedPersonSearch.toLowerCase()
			// 	peopleRows = peopleRows.filter((row) => {
			// 		const person = row.person
			// 		if (!person) return false

			// 		// Check person fields
			// 		const nameMatch = person.name?.toLowerCase().includes(searchLower)
			// 		const titleMatch = person.title?.toLowerCase().includes(searchLower)
			// 		const companyMatch = person.company?.toLowerCase().includes(searchLower)
			// 		const roleMatch = row.role?.toLowerCase().includes(searchLower)

			// 		return nameMatch || titleMatch || companyMatch || roleMatch
			// 	})
			// }

			// Apply specific person IDs filter if provided (client-side since it's an array filter)
			if (specificPersonIds.length > 0) {
				peopleRows = peopleRows.filter((row) => specificPersonIds.includes(row.person_id))
			}

			// No need to slice since we already limited in the database query
			// peopleRows = peopleRows.slice(0, peopleLimit)
			const personIds = peopleRows.map((row) => row.person_id)

			// Get total count for pagination info (apply same search filter)
			let countQuery = supabase
				.from("project_people")
				.select("*", { count: "exact", head: true })
				.eq("project_id", projectId)

			if (sanitizedPersonSearch) {
				const searchWords = sanitizedPersonSearch.split(/\s+/).filter((word) => word.length > 0)
				const searchConditions = searchWords.flatMap((word) => {
					const searchPattern = `%${word}%`
					return [
						`name.ilike.${searchPattern}`,
						`title.ilike.${searchPattern}`,
						`company.ilike.${searchPattern}`,
						`role.ilike.${searchPattern}`,
					]
				})

				countQuery = countQuery.or(searchConditions.join(","), { foreignTable: "person" })
			}

			const { count: totalCount } = await countQuery

			// Fetch additional data if requested
			const [personaData, interviewData, evidenceCounts] = await Promise.all([
				includePersonas && personIds.length > 0
					? supabase
							.from("people_personas")
							.select(`
						person_id,
						personas:persona_id(
							id,
							name,
							color_hex,
							description
						),
						assigned_at,
						confidence_score
					`)
							.in("person_id", personIds)
							.eq("project_id", projectId)
					: Promise.resolve({ data: null }),

				includeEvidence && personIds.length > 0
					? supabase
							.from("interview_people")
							.select(`
						person_id,
						interview:interview_id(
							id,
							title,
							interview_date,
							status
						)
					`)
							.eq("project_id", projectId)
							.in("person_id", personIds)
							.order("created_at", { ascending: false })
					: Promise.resolve({ data: null }),

				includeEvidence && personIds.length > 0
					? supabase
							.from("evidence")
							.select("interview_id")
							.eq("project_id", projectId)
							.in(
								"interview_id",
								(
									await supabase
										.from("interview_people")
										.select("interview_id")
										.eq("project_id", projectId)
										.in("person_id", personIds)
								).data
									?.map((ip) => ip.interview_id)
									.filter(Boolean) ?? []
							)
							.then((result) => {
								const interviewEvidenceCount = new Map<string, number>()
								if (result.data) {
									for (const evidence of result.data) {
										if (evidence.interview_id) {
											interviewEvidenceCount.set(
												evidence.interview_id,
												(interviewEvidenceCount.get(evidence.interview_id) ?? 0) + 1
											)
										}
									}
								}
								return interviewEvidenceCount
							})
					: Promise.resolve(new Map<string, number>()),
			])

			// Organize the additional data by person_id
			const personasByPerson = new Map<string, PeoplePersonaRow[]>()
			const interviewsByPerson = new Map<string, InterviewPeopleRow[]>()

			if (personaData.data) {
				for (const row of personaData.data as PeoplePersonaRow[]) {
					const existing = personasByPerson.get(row.person_id) ?? []
					existing.push(row)
					personasByPerson.set(row.person_id, existing)
				}
			}

			if (interviewData.data) {
				for (const row of interviewData.data as InterviewPeopleRow[]) {
					const existing = interviewsByPerson.get(row.person_id) ?? []
					existing.push(row)
					interviewsByPerson.set(row.person_id, existing)
				}
			}

			// Build the final result
			const people = peopleRows
				.map((row) => {
					const person = row.person
					if (!person) return null

					const personPersonas = personasByPerson.get(person.id) ?? []
					const personInterviews = interviewsByPerson.get(person.id) ?? []

					// Calculate evidence count for this person
					let evidenceCount = 0
					const interviews = personInterviews
						.map((ip) => {
							const interview = ip.interview
							if (!interview) return null

							const count = evidenceCounts.get(interview.id) ?? 0
							evidenceCount += count

							return {
								id: interview.id,
								title: interview.title,
								interview_date: normalizeDate(interview.interview_date),
								status: interview.status,
								evidenceCount: count,
							}
						})
						.filter(Boolean)

					return {
						personId: person.id,
						name: person.name,
						age: person.age,
						gender: person.gender,
						pronouns: person.pronouns,
						title: person.title,
						company: person.company,
						occupation: person.occupation,
						role: person.role,
						segment: person.segment,
						industry: person.industry,
						income: person.income,
						location: person.location,
						timezone: person.timezone,
						languages: toStringArray(person.languages),
						education: person.education,
						lifecycle_stage: person.lifecycle_stage,
						description: person.description,
						preferences: person.preferences,
						image_url: person.image_url,
						linkedin_url: person.linkedin_url,
						website_url: person.website_url,
						contactInfo: person.contact_info as z.infer<typeof contactInfoSchema> | null,
						primary_email: person.primary_email,
						primary_phone: person.primary_phone,
						projectRole: row.role,
						interviewCount: row.interview_count,
						firstSeenAt: normalizeDate(row.first_seen_at),
						lastSeenAt: normalizeDate(row.last_seen_at),
						personas: includePersonas
							? personPersonas.map((pp) => ({
									id: pp.personas?.id ?? null,
									name: pp.personas?.name ?? null,
									color_hex: pp.personas?.color_hex ?? null,
									description: pp.personas?.description ?? null,
									assigned_at: normalizeDate(pp.assigned_at),
									confidence_score: pp.confidence_score,
								}))
							: undefined,
						interviews: includeEvidence ? interviews : undefined,
						evidenceCount: includeEvidence ? evidenceCount : undefined,
						created_at: normalizeDate(person.created_at),
						updated_at: normalizeDate(person.updated_at),
					}
				})
				.filter(Boolean) as z.infer<typeof personDetailSchema>[]

			const message = sanitizedPersonSearch
				? `Found ${people.length} people matching "${sanitizedPersonSearch}" in project.`
				: `Retrieved ${people.length} people from project.`

			return {
				success: true,
				message,
				projectId,
				people,
				totalCount: totalCount ?? 0,
				searchApplied: sanitizedPersonSearch || null,
			}
		} catch (error) {
			consola.error("fetch-people-details: unexpected error", error)
			return {
				success: false,
				message: "Unexpected error fetching people details.",
				projectId,
				people: [],
				totalCount: 0,
				searchApplied: null,
			}
		}
	},
})
