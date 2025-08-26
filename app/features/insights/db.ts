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
	const query = supabase
		.from("insights_with_priority")
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
			priority,
		  persona_insights:persona_insights (
		    *,
		    personas:personas (name,id)
		  ),
		interviews (title,id),
		insight_tags:insight_tags (
			tags (tag,term, definition)
		)
		`)
		// .eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	const { data, error } = await query
	// Get linked themes for all insights via evidence relationship
	const insightIds = data?.map((i) => i.id) || []
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
		insight_tags:
			insight.insight_tags?.map((it: any) => ({
				tag: it.tags?.tag,
				term: it.tags?.term,
				definition: it.tags?.definition,
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
		.from("insights_with_priority")
		.select(`
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
			priority,
		  persona_insights:persona_insights (
		    *,
		    personas:personas (name,id)
		  ),
		interviews (title,id),
		insight_tags:insight_tags (
			tags (tag,term, definition)
		)
		`)
		// .eq("account_id", accountId)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	type InsightById = QueryData<typeof insightByIdQuery>

	const { data, error } = await insightByIdQuery

	// consola.log("getInsightById", data, error)

	if (error) {
		// PGRST116 means no rows returned from .single()
		if (error.code === "PGRST116") {
			return null
		}
		throw new Response("Failed to load insight", { status: 500 })
	}

	if (!data) {
		return null
	}

	const insightData: InsightById = data
	return insightData
}

export const createInsight = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: InsightInsert & { project_id: string }
}) => {
	return await supabase.from("insights").insert(data).select().single()
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
	data: Database["public"]["Tables"]["insights"]["Update"]
}) => {
	return await supabase
		.from("insights")
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
	return await supabase.from("insights").delete().eq("id", id).eq("project_id", projectId)
}
