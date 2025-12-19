import type { QueryData, SupabaseClient } from "@supabase/supabase-js"
import type { Database, InsightInsert } from "~/types"

// This is our pattern for defining typed queries and returning results.
// in particular, we should create variables that describe the results
export const getInsights = async ({
	supabase,
	accountId,
	projectId,
	offset,
	limit,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	offset?: number
	limit?: number
}) => {
	const baseQuery = supabase
		.from("themes")
		.select(
			`
			id,
			name,
			statement,
			inclusion_criteria,
			exclusion_criteria,
			synonyms,
			anti_examples,
			category,
			jtbd,
			pain,
			desired_outcome,
			journey_stage,
			emotional_response,
			motivation,
			impact,
			priority,
			updated_at,
			project_id,
			created_at,
			theme_evidence(count)
		`
		)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	// Optional pagination (PostgREST range is inclusive)
	if (typeof offset === "number" && typeof limit === "number") {
		baseQuery.range(offset, offset + limit - 1)
	}

	const { data, error } = await baseQuery
	const insightIds = data?.map((i) => i.id) || []

	// Get interview IDs via theme_evidence junction table
	const { data: evidenceLinks } = insightIds.length
		? await supabase
				.from("theme_evidence")
				.select("theme_id, evidence:evidence_id(interview_id)")
				.in("theme_id", insightIds)
		: { data: null }

	const interviewIds =
		Array.from(
			new Set((evidenceLinks as any)?.map((link: any) => link.evidence?.interview_id).filter(Boolean) as string[])
		) || []

	const [tagsResult, personasResult, interviewsResult, priorityResult, votesResult] = insightIds.length
		? await Promise.all([
				supabase
					.from("insight_tags")
					.select("insight_id, tags:tag_id(tag, term, definition)")
					.in("insight_id", insightIds),
				supabase
					.from("persona_insights")
					.select("insight_id, personas:persona_id(id, name)")
					.in("insight_id", insightIds),
				interviewIds.length
					? supabase.from("interviews").select("id, title").in("id", interviewIds)
					: Promise.resolve({ data: null, error: null }),
				supabase.from("insights_with_priority").select("id, priority").in("id", insightIds),
				supabase
					.from("votes")
					.select("entity_id")
					.eq("entity_type", "insight")
					.eq("project_id", projectId)
					.in("entity_id", insightIds),
			])
		: [null, null, null, null, null]

	const tagsMap = new Map<
		string,
		Array<{
			tag?: string | null
			term?: string | null
			definition?: string | null
		}>
	>()
	tagsResult?.data?.forEach((row) => {
		if (!row.insight_id) return
		if (!tagsMap.has(row.insight_id)) tagsMap.set(row.insight_id, [])
		if (row.tags) tagsMap.get(row.insight_id)?.push(row.tags)
	})

	const personasMap = new Map<string, Array<{ id: string; name: string | null }>>()
	personasResult?.data?.forEach((row) => {
		if (!row.insight_id || !row.personas) return
		if (!personasMap.has(row.insight_id)) personasMap.set(row.insight_id, [])
		personasMap.get(row.insight_id)?.push(row.personas)
	})

	const interviewsMap = new Map<string, { id: string; title: string | null }>()
	interviewsResult?.data?.forEach((row) => {
		if (row.id) interviewsMap.set(row.id, row)
	})

	const priorityMap = new Map<string, number>()
	priorityResult?.data?.forEach((row) => {
		priorityMap.set(row.id, row.priority ?? 0)
	})

	const voteCountMap = new Map<string, number>()
	votesResult?.data?.forEach((row) => {
		if (!row.entity_id) return
		voteCountMap.set(row.entity_id, (voteCountMap.get(row.entity_id) ?? 0) + 1)
	})

	// Build interview map for each theme via evidence links
	const themeInterviewsMap = new Map<string, string[]>()
	if (evidenceLinks) {
		;(evidenceLinks as any).forEach((link: any) => {
			const themeId = link.theme_id
			const interviewId = link.evidence?.interview_id
			if (themeId && interviewId) {
				if (!themeInterviewsMap.has(themeId)) {
					themeInterviewsMap.set(themeId, [])
				}
				if (!themeInterviewsMap.get(themeId)?.includes(interviewId)) {
					themeInterviewsMap.get(themeId)?.push(interviewId)
				}
			}
		})
	}

	const transformedData = data?.map((insight: any) => ({
		...insight,
		// Use priority from themes table directly, fall back to view for backwards compat
		priority: insight.priority ?? priorityMap.get(insight.id) ?? 3,
		vote_count: voteCountMap.get(insight.id) ?? 0,
		evidence_count: Array.isArray(insight.theme_evidence) ? (insight.theme_evidence[0]?.count ?? 0) : 0,
		persona_insights: personasMap.get(insight.id)?.map((person) => ({ personas: person })) ?? [],
		interviews: (themeInterviewsMap.get(insight.id) || []).map((id) => interviewsMap.get(id)).filter(Boolean),
		insight_tags:
			tagsMap.get(insight.id)?.map((tag) => ({
				tag: tag.tag,
				term: tag.term,
				definition: tag.definition,
			})) || [],
		linked_themes: [], // Themes are top-level now, not nested
		// Add backward compatibility field for interview_id
		interview_id: themeInterviewsMap.get(insight.id)?.[0] || null, // Use first interview for backwards compat
	}))
	return { data: transformedData, error }
}

export const getInsightById = async ({
	supabase,
	accountId,
	projectId,
	id,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	id: string
}) => {
	const insightByIdQuery = supabase
		.from("themes")
		.select(
			`
			id,
			name,
			statement,
			inclusion_criteria,
			exclusion_criteria,
			synonyms,
			anti_examples,
			category,
			jtbd,
			pain,
			desired_outcome,
			journey_stage,
			emotional_response,
			motivation,
			details,
			evidence,
			impact,
			contradictions,
			novelty,
			opportunity_ideas,
			related_tags,
			confidence,
			updated_at,
			project_id,
			created_at,
			theme_evidence(count)
		`
		)
		// .eq("account_id", accountId)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	type InsightById = QueryData<typeof insightByIdQuery>

	const { data, error } = await insightByIdQuery

	if (error) {
		if (error.code === "PGRST116") {
			return null
		}
		throw new Response("Failed to load insight", { status: 500 })
	}

	if (!data) {
		return null
	}

	const insightData: InsightById = data

	const [tagsResult, personasResult, priorityResult] = await Promise.all([
		supabase.from("insight_tags").select("insight_id, tags:tag_id(tag, term, definition)").eq("insight_id", id),
		supabase.from("persona_insights").select("insight_id, personas:persona_id(id, name)").eq("insight_id", id),
		supabase.from("insights_with_priority").select("priority").eq("id", id).maybeSingle(),
	])

	// Fetch people and orgs linked to this theme via evidence
	// 1. Get evidence IDs for this theme
	const { data: themeEvidence } = await supabase
		.from("theme_evidence")
		.select("evidence_id")
		.eq("theme_id", id)
		.eq("project_id", projectId)

	const evidenceIds = themeEvidence?.map((te) => te.evidence_id).filter(Boolean) ?? []

	let peopleData: Array<{
		id: string
		name: string | null
		role: string | null
		organization?: { id: string; name: string | null } | null
	}> = []
	const orgCounts: Map<string, { id: string; name: string; count: number }> = new Map()

	if (evidenceIds.length > 0) {
		// 2. Get people linked to this evidence
		const { data: evidencePeople } = await supabase
			.from("evidence_people")
			.select(
				"person_id, role, people:person_id!inner(id, name, organization_id, organizations:organization_id(id, name))"
			)
			.eq("project_id", projectId)
			.in("evidence_id", evidenceIds)

		if (evidencePeople) {
			// Deduplicate people (same person may appear in multiple evidence)
			const uniquePeople = new Map<string, any>()
			for (const ep of evidencePeople as any[]) {
				if (ep.people && !uniquePeople.has(ep.people.id)) {
					uniquePeople.set(ep.people.id, {
						id: ep.people.id,
						name: ep.people.name,
						role: ep.role,
						organization: ep.people.organizations
							? {
									id: ep.people.organizations.id,
									name: ep.people.organizations.name,
								}
							: null,
					})

					// Count orgs
					if (ep.people.organizations) {
						const orgId = ep.people.organizations.id
						const existing = orgCounts.get(orgId)
						if (existing) {
							existing.count++
						} else {
							orgCounts.set(orgId, {
								id: orgId,
								name: ep.people.organizations.name,
								count: 1,
							})
						}
					}
				}
			}
			peopleData = Array.from(uniquePeople.values())
		}
	}

	return {
		...insightData,
		priority: priorityResult.data?.priority ?? 0,
		evidence_count: Array.isArray((insightData as any).theme_evidence)
			? ((insightData as any).theme_evidence[0]?.count ?? 0)
			: 0,
		persona_insights: personasResult?.data?.map((row) => ({ personas: row.personas })) ?? [],
		insight_tags:
			tagsResult?.data?.map((row) => ({
				tag: row.tags?.tag,
				term: row.tags?.term,
				definition: row.tags?.definition,
			})) ?? [],
		people: peopleData,
		organizations: Array.from(orgCounts.values()).sort((a, b) => b.count - a.count),
	}
}

export const createInsight = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: InsightInsert & { project_id: string }
}) => {
	return await supabase.from("themes").insert(data).select().single()
}

export const updateInsight = async ({
	supabase,
	id,
	accountId,
	projectId,
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	projectId: string
	data: Database["public"]["Tables"]["themes"]["Update"]
}) => {
	return await supabase
		.from("themes")
		.update(data)
		.eq("id", id)
		// .eq("account_id", accountId)
		.eq("project_id", projectId)
		.select()
		.single()
}

export const deleteInsight = async ({
	supabase,
	id,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	projectId: string
}) => {
	return await supabase.from("themes").delete().eq("id", id).eq("project_id", projectId)
}
