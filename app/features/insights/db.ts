import type { QueryData, SupabaseClient } from "@supabase/supabase-js"
import type { Database, InsightInsert } from "~/types"

// This is our pattern for defining typed queries and returning results.
// in particular, we should create variables that describe the results
export const getInsights = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
}) => {
	const baseQuery = supabase
		.from("themes")
		.select(`
			id,
			interview_id,
			name,
			pain,
			details,
			category,
			journey_stage,
			emotional_response,
			desired_outcome,
			jtbd,
			impact,
			evidence,
			motivation,
			contradictions,
			updated_at,
			project_id,
			created_at
		`)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	const { data, error } = await baseQuery
	const insightIds = data?.map((i) => i.id) || []
	const interviewIds = data?.map((i) => i.interview_id).filter(Boolean) as string[]

	const [tagsResult, personasResult, interviewsResult, priorityResult, votesResult] = insightIds.length
		? await Promise.all([
				supabase
					.from("insight_tags")
					.select(`insight_id, tags (tag, term, definition)`)
					.in("insight_id", insightIds),
				supabase
					.from("persona_insights")
					.select(`insight_id, personas (id, name)`)
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

	const tagsMap = new Map<string, Array<{ tag?: string | null; term?: string | null; definition?: string | null }>>()
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

	// Get linked themes for all insights via evidence relationship
	const themesMap = new Map<string, any[]>()
	if (insightIds.length > 0) {
		const { data: themeLinks } = await supabase
			.from("theme_evidence")
			.select(`
				themes:themes (id, name, statement),
				evidence:evidence (interview_id)
			`)
			.eq("project_id", projectId)

		// Build map of interview_id -> themes
		const interviewThemesMap = new Map<string, any[]>()
		themeLinks?.forEach((link) => {
			const interviewId = link.evidence?.interview_id
			if (interviewId && link.themes) {
				if (!interviewThemesMap.has(interviewId)) {
					interviewThemesMap.set(interviewId, [])
				}
				interviewThemesMap.get(interviewId)?.push(link.themes)
			}
		})

		// Map themes to insights via interview_id
		data?.forEach((insight) => {
			if (insight.interview_id) {
				const themes = interviewThemesMap.get(insight.interview_id) || []
				// Deduplicate themes by id
				const uniqueThemes = themes.filter((theme, index, arr) => arr.findIndex((t) => t.id === theme.id) === index)
				themesMap.set(insight.id, uniqueThemes)
			}
		})
	}

	const transformedData = data?.map((insight) => ({
		...insight,
		priority: priorityMap.get(insight.id) ?? 0,
		vote_count: voteCountMap.get(insight.id) ?? 0,
		persona_insights: personasMap.get(insight.id)?.map((person) => ({ personas: person })) ?? [],
		interviews: insight.interview_id ? [interviewsMap.get(insight.interview_id) || null].filter(Boolean) : [],
		insight_tags:
			tagsMap
				.get(insight.id)
				?.map((tag) => ({
					tag: tag.tag,
					term: tag.term,
					definition: tag.definition,
				})) || [],
		linked_themes: themesMap.get(insight.id) || [],
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
		.select(`
			id,
			interview_id,
			name,
			pain,
			details,
			category,
			journey_stage,
			emotional_response,
			desired_outcome,
			jtbd,
			impact,
			evidence,
			motivation,
			contradictions,
			updated_at,
			project_id,
			created_at
		`)
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

	const [tagsResult, personasResult, interviewResult, priorityResult] = await Promise.all([
		supabase
			.from("insight_tags")
			.select(`insight_id, tags (tag, term, definition)`)
			.eq("insight_id", id),
		supabase.from("persona_insights").select(`insight_id, personas (id, name)`).eq("insight_id", id),
		insightData.interview_id
			? supabase.from("interviews").select("id, title").eq("id", insightData.interview_id).single()
			: Promise.resolve({ data: null, error: null }),
		supabase.from("insights_with_priority").select("id, priority").eq("id", id).single(),
	])

	return {
		...insightData,
		priority: priorityResult?.data?.priority ?? 0,
		persona_insights: personasResult?.data?.map((row) => ({ personas: row.personas })) ?? [],
		interviews: interviewResult?.data ? [interviewResult.data] : [],
		insight_tags:
			tagsResult?.data?.map((row) => ({
				tag: row.tags?.tag,
				term: row.tags?.term,
				definition: row.tags?.definition,
			})) ?? [],
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
