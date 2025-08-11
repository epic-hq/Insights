import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database, ProjectInsert, ProjectUpdate } from "~/types"

export const getProjects = async ({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) => {
	consola.log("getProjects accountId: ", accountId)
	return await supabase
		.from("projects")
		.select(`
			*
			// project_people (
			// 	people (
			// 		id,
			// 		name,
			// 		segment
			// 	)
			// )
		`)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })
}

export const getProjectById = async ({
	supabase,
	accountId,
	id,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	id: string
}) => {
	consola.log("getProjectById accountId: ", accountId)
	return await supabase
		.from("projects")
		.select(`
			*,
			project_people (
				people (
					id,
					name,
					segment
				),
				interview_count,
				first_seen_at,
				last_seen_at
			),
			project_personas (
				personas (
					id,
					name,
					color_hex
				)
			)
		`)
		.eq("account_id", accountId)
		.eq("id", id)
		.single()
}

export const createProject = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: ProjectInsert
}) => {
	return await supabase.from("projects").insert(data).select().single()
}

export const updateProject = async ({
	supabase,
	id,
	accountId,
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	data: ProjectUpdate
}) => {
	return await supabase.from("projects").update(data).eq("id", id).eq("account_id", accountId).select().single()
}

export const deleteProject = async ({
	supabase,
	id,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
}) => {
	return await supabase.from("projects").delete().eq("id", id).eq("account_id", accountId)
}
