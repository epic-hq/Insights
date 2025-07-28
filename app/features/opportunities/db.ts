import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getOpportunities = async ({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) => {
	return await supabase
		.from("opportunities")
		.select(`
			*,
			opportunity_insights (
				insights (
					id,
					title,
					content,
					category,
					impact_score
				)
			)
		`)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })
}

export const getOpportunityById = async ({
	supabase,
	accountId,
	id,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	id: string
}) => {
	return await supabase
		.from("opportunities")
		.select(`
			*,
			opportunity_insights (
				insights (
					id,
					title,
					content,
					category,
					impact_score,
					interviews (
						id,
						title,
						date,
						participant_name
					)
				)
			)
		`)
		.eq("account_id", accountId)
		.eq("id", id)
		.single()
}

export const createOpportunity = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Database["public"]["Tables"]["opportunities"]["Insert"]
}) => {
	return await supabase.from("opportunities").insert(data).select().single()
}

export const updateOpportunity = async ({
	supabase,
	id,
	accountId,
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	data: Database["public"]["Tables"]["opportunities"]["Update"]
}) => {
	return await supabase
		.from("opportunities")
		.update(data)
		.eq("id", id)
		.eq("account_id", accountId)
		.select()
		.single()
}

export const deleteOpportunity = async ({
	supabase,
	id,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
}) => {
	return await supabase
		.from("opportunities")
		.delete()
		.eq("id", id)
		.eq("account_id", accountId)
}
