import type { QueryData, SupabaseClient } from "@supabase/supabase-js"
import type { Database, InsightInsert, } from "~/types"

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
		.from("insights")
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
    persona_insights:persona_insights (
      *,
      personas:personas (name,id)
    ),
		interviews (title,id),
		insight_tags:insight_tags (
			tags (tag,term, definition)
		)
  `)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	const { data, error } = await query
	const transformedData = data?.map(insight => ({
		...insight,
		insight_tags: insight.insight_tags?.map(it => ({
			tag: it.tags?.tag,
			term: it.tags?.term,
			definition: it.tags?.definition
		})) || []
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
		.from("insights")
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
    persona_insights:persona_insights (
      *,
      personas:personas (name,id)
    ),
		interviews (title,id),
		insight_tags:insight_tags (
			tags (tag,term, definition)
		)
  `)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	type InsightById = QueryData<typeof insightByIdQuery>

	const { data, error } = await insightByIdQuery

	// consola.log("getInsightById", data, error)

	if (error) {
		// PGRST116 means no rows returned from .single()
		if (error.code === 'PGRST116') {
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
		.eq("account_id", accountId)
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
	return await supabase.from("insights").delete().eq("id", id).eq("account_id", accountId).eq("project_id", projectId)
}
