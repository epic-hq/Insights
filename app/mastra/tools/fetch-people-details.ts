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
		"Fetch detailed information about people in a project, including demographics, professional info, preferences, attributes, motivations, personas, interview history, evidence snippets, and facet/scale attributes.",
	inputSchema: z.object({
		projectId: z
			.string()
			.describe("Project ID to fetch people from. Required - no default project context available."),
		peopleSearch: z
			.string()
			.optional()
			.describe("Case-insensitive search string to match people by name or display name."),
		peopleLimit: z.number().int().min(1).max(50).optional().describe("Maximum number of people to return."),
		includeEvidence: z.boolean().optional().describe("Whether to include actual evidence snippets from interviews."),
		includePersonas: z.boolean().optional().describe("Whether to include persona assignments for each person."),
		includeFacets: z.boolean().optional().describe("Whether to include facet attributes and scale measurements for each person."),
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
		const runtimeAccountId = runtimeContext?.get?.("account_id")

		const projectId = context.projectId
		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : undefined
		const peopleSearch = (context?.peopleSearch ?? "").trim()
		const sanitizedPersonSearch = peopleSearch.replace(/[%*"'()]/g, "").trim()
		const peopleLimit = context?.peopleLimit ?? 20
		const includeEvidence = context?.includeEvidence ?? true
		const includePersonas = context?.includePersonas ?? true
		const includeFacets = context?.includeFacets ?? false
		const specificPersonIds = context?.specificPersonIds ?? []

		consola.info("fetch-people-details: execute start", {
			projectId,
			accountId,
			peopleSearch: sanitizedPersonSearch,
			peopleLimit,
			includeEvidence,
			includePersonas,
			includeFacets,
			specificPersonIds: specificPersonIds.length,
		})

		if (!projectId || projectId.trim() === "") {
			consola.warn("fetch-people-details: missing or empty projectId")
			return {
				success: false,
				message: "Missing or empty projectId. A valid project ID is required.",
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
				// Split search term into individual words for more restrictive matching
				const searchWords = sanitizedPersonSearch.split(/\s+/).filter((word) => word.length > 0)
				const searchConditions = searchWords.flatMap((word) => {
					return [
						`name.ilike.%${word}%`,
						`title.ilike.%${word}%`,
						`company.ilike.%${word}%`,
						`role.ilike.%${word}%`,
					]
				})

				// Apply search conditions to the foreign table (person)
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

			consola.info("fetch-people-details: query results", {
				projectId,
				searchTerm: sanitizedPersonSearch,
				rawResultsCount: peopleRows.length,
				sampleResult: peopleRows.length > 0 ? {
					person_id: peopleRows[0].person_id,
					name: peopleRows[0].person?.name,
					title: peopleRows[0].person?.title,
					company: peopleRows[0].person?.company
				} : null
			})

			// Apply word-boundary filtering for search terms to avoid substring matches
			if (sanitizedPersonSearch) {
				const searchWords = sanitizedPersonSearch.split(/\s+/).filter((word) => word.length > 0)
				const wordBoundaryRegex = new RegExp(`\\b${searchWords.join('|')}\\b`, 'i')

				peopleRows = peopleRows.filter((row) => {
					const person = row.person
					if (!person) return false

					const searchableText = [
						person.name,
						person.title,
						person.company,
						person.role,
						row.role
					].filter(Boolean).join(' ')

					return wordBoundaryRegex.test(searchableText)
				})

				consola.info("fetch-people-details: after word boundary filtering", {
					projectId,
					searchTerm: sanitizedPersonSearch,
					filteredResultsCount: peopleRows.length,
				})
			}

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
					return [
						`name.ilike.%${word}%`,
						`title.ilike.%${word}%`,
						`company.ilike.%${word}%`,
						`role.ilike.%${word}%`,
					]
				})

				countQuery = countQuery.or(searchConditions.join(","), { foreignTable: "person" })
			}

			let { count: totalCount } = await countQuery

			// If we have search filtering, we need to adjust the count based on our word boundary filtering
			if (sanitizedPersonSearch) {
				// We can't easily count with word boundaries in SQL, so we'll estimate based on our filtering ratio
				// For now, just use the filtered count as the total (since we're limiting results anyway)
				totalCount = peopleRows.length
			}

			// Fetch additional data if requested
			const [personaData, interviewData, evidenceData, facetData, scaleData] = await Promise.all([
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
							.select(`
						id,
						gist,
						verbatim,
						context_summary,
						modality,
						created_at,
						interview_id,
						interview:interview_id(
							title,
							interview_date
						)
					`)
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
							.order("created_at", { ascending: false })
							.limit(50) // Limit evidence per person to avoid too much data
					: Promise.resolve({ data: null }),

				includeFacets && personIds.length > 0
					? supabase
							.from("person_facet")
							.select(`
						person_id,
						facet_account_id,
						source,
						confidence,
						noted_at,
						facet:facet_account!inner(
							id,
							label,
							kind_id,
							synonyms,
							is_active,
							kind:kinds!inner(
								slug,
								label
							)
						)
					`)
							.eq("project_id", projectId)
							.in("person_id", personIds)
					: Promise.resolve({ data: null }),

				includeFacets && personIds.length > 0
					? supabase
							.from("person_scale")
							.select(`
						person_id,
						kind_slug,
						score,
						band,
						source,
						confidence,
						noted_at
					`)
							.eq("project_id", projectId)
							.in("person_id", personIds)
					: Promise.resolve({ data: null }),
			])

			// Organize the additional data by person_id
			const personasByPerson = new Map<string, PeoplePersonaRow[]>()
			const interviewsByPerson = new Map<string, InterviewPeopleRow[]>()
			const evidenceByPerson = new Map<string, any[]>()
			const facetsByPerson = new Map<string, any[]>()
			const scalesByPerson = new Map<string, any[]>()

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

			if (evidenceData.data) {
				for (const evidence of evidenceData.data as any[]) {
					// Find which person this evidence belongs to by looking up interview_people
					const interviewPeople = (interviewData.data as InterviewPeopleRow[])?.find(
						(ip) => ip.interview?.id === evidence.interview_id
					)
					if (interviewPeople) {
						const existing = evidenceByPerson.get(interviewPeople.person_id) ?? []
						existing.push(evidence)
						evidenceByPerson.set(interviewPeople.person_id, existing)
					}
				}
			}

			if (facetData.data) {
				for (const facet of facetData.data as any[]) {
					const existing = facetsByPerson.get(facet.person_id) ?? []
					existing.push(facet)
					facetsByPerson.set(facet.person_id, existing)
				}
			}

			if (scaleData.data) {
				for (const scale of scaleData.data as any[]) {
					const existing = scalesByPerson.get(scale.person_id) ?? []
					existing.push(scale)
					scalesByPerson.set(scale.person_id, existing)
				}
			}

			// Build the final result
			const people = peopleRows
				.map((row) => {
					const person = row.person
					if (!person) return null

					const personPersonas = personasByPerson.get(person.id) ?? []
					const personInterviews = interviewsByPerson.get(person.id) ?? []
					const personEvidence = evidenceByPerson.get(person.id) ?? []
					const personFacets = facetsByPerson.get(person.id) ?? []
					const personScales = scalesByPerson.get(person.id) ?? []

					// Calculate evidence count for backward compatibility
					const evidenceCount = personEvidence.length

					const interviews = personInterviews
						.map((ip) => {
							const interview = ip.interview
							if (!interview) return null

							// Count evidence for this specific interview
							const interviewEvidenceCount = personEvidence.filter(
								(ev) => ev.interview_id === interview.id
							).length

							return {
								id: interview.id,
								title: interview.title,
								interview_date: normalizeDate(interview.interview_date),
								status: interview.status,
								evidenceCount: interviewEvidenceCount,
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
						evidence: includeEvidence
							? personEvidence.slice(0, 20).map((ev) => ({ // Limit to 20 snippets per person
									id: ev.id,
									gist: ev.gist ?? null,
									verbatim: ev.verbatim ?? null,
									context_summary: ev.context_summary ?? null,
									modality: ev.modality ?? null,
									interview_title: ev.interview?.title ?? null,
									interview_date: normalizeDate(ev.interview?.interview_date),
									created_at: normalizeDate(ev.created_at),
								}))
							: undefined,
						facets: includeFacets
							? personFacets.map((facet) => ({
									facet_account_id: facet.facet_account_id,
									label: facet.facet?.label ?? `ID:${facet.facet_account_id}`,
									kind_slug: facet.facet?.kind?.slug ?? "",
									source: facet.source ?? null,
									confidence: facet.confidence ?? null,
								}))
							: undefined,
						scales: includeFacets
							? personScales.map((scale) => ({
									kind_slug: scale.kind_slug,
									score: scale.score,
									band: scale.band ?? null,
									source: scale.source ?? null,
									confidence: scale.confidence ?? null,
								}))
							: undefined,
						evidenceCount: includeEvidence ? evidenceCount : undefined,
						created_at: normalizeDate(person.created_at),
						updated_at: normalizeDate(person.updated_at),
					}
				})
				.filter(Boolean) as z.infer<typeof personDetailSchema>[]

			const message = sanitizedPersonSearch
				? `Found ${people.length} people matching "${sanitizedPersonSearch}" in project.`
				: `Retrieved ${people.length} people from project.`

			consola.info("fetch-people-details: final result", {
				projectId,
				searchTerm: sanitizedPersonSearch,
				peopleCount: people.length,
				totalCount: totalCount ?? 0,
				samplePerson: people.length > 0 ? {
					id: people[0].personId,
					name: people[0].name,
					title: people[0].title,
					company: people[0].company
				} : null
			})

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
