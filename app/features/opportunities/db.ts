import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getOpportunities = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
}) => {
	return await supabase
		.from("opportunities")
		.select("*")
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
}

export const getOpportunityById = async ({
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
	return await supabase
		.from("opportunities")
		.select("*")
		.eq("account_id", accountId)
		.eq("project_id", projectId)
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
	projectId,
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	projectId: string
	data: Database["public"]["Tables"]["opportunities"]["Update"]
}) => {
	return await supabase
		.from("opportunities")
		.update(data)
		.eq("id", id)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.select()
		.single()
}

export const deleteOpportunity = async ({
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
	return await supabase
		.from("opportunities")
		.delete()
		.eq("id", id)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
}
