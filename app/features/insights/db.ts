import type { QueryData, SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"

// This is our pattern for defining typed queries and returning results.
// in particular, we should create variables that describe the results
export const getInsights = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId?: string
}) => {
	const insightsQuery = supabase
		.from("insights")
		.select(`
    *,
    persona_insights:persona_insights (
      persona_id,
      relevance_score,
      people_personas (
        id,
        people (
          id,
          name,
          color_hex
        )
      )
    ),
    persona_type_count:persona_insights(count)
  `)
		.eq("account_id", accountId)
		// .eq("project_id", projectId)
		.order("created_at", { ascending: false })

	type Insights = QueryData<typeof insightsQuery>

	const { data, error } = await insightsQuery
	consola.log("insights result: ", data)
	if (error) {
		throw new Response("Failed to load insights", { status: 500 })
	}
	const insightsData: Insights = data
	return insightsData
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
			*,
			interviews (*),
			insight_tags (
				tags (*)
			)
		`)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	type InsightById = QueryData<typeof insightByIdQuery>

	const { data, error } = await insightByIdQuery

	if (error) {
		throw new Response("Failed to load insight", { status: 500 })
	}
	const insightData: InsightById = data
	return insightData
}

export const createInsight = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Database["public"]["Tables"]["insights"]["Insert"] & { project_id: string }
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
