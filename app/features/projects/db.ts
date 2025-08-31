import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database, Project_SectionInsert, Project_SectionUpdate, ProjectInsert, ProjectUpdate } from "~/types"

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

export const getProjectById = async ({ supabase, id }: { supabase: SupabaseClient<Database>; id: string }) => {
	// consola.log("getProjectById accountId: ", accountId)
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
			)
		`)
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
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	data: ProjectUpdate
}) => {
	return await supabase.from("projects").update(data).eq("id", id).select().single()
}

export const deleteProject = async ({ supabase, id }: { supabase: SupabaseClient<Database>; id: string }) => {
	return await supabase.from("projects").delete().eq("id", id)
}

// Project Sections functions
export const getProjectSections = async ({
	supabase,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	projectId: string
}) => {
	return await supabase
		.from("project_sections")
		.select("*")
		.eq("project_id", projectId)
		.order("position", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false })
}

export const getProjectSectionKinds = async ({ supabase }: { supabase: SupabaseClient<Database> }) => {
	return await supabase.from("project_section_kinds").select("id").order("id", { ascending: true })
}

export const createProjectSection = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Project_SectionInsert
}) => {
	return await supabase.from("project_sections").insert(data).select().single()
}

export const updateProjectSection = async ({
	supabase,
	id,
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	data: Project_SectionUpdate
}) => {
	return await supabase.from("project_sections").update(data).eq("id", id).select().single()
}

export const upsertProjectSection = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Project_SectionInsert & { id?: string }
}) => {
	return await supabase.from("project_sections").upsert(data, { onConflict: "project_id,kind" }).select().single()
}

export const deleteProjectSection = async ({ supabase, id }: { supabase: SupabaseClient<Database>; id: string }) => {
	return await supabase.from("project_sections").delete().eq("id", id)
}

export const getProjectSectionsByKind = async ({
	supabase,
	projectId,
	kind,
}: {
	supabase: SupabaseClient<Database>
	projectId: string
	kind: string
}) => {
	return await supabase
		.from("project_sections")
		.select("*")
		.eq("project_id", projectId)
		.eq("kind", kind)
		.order("created_at", { ascending: false })
}
