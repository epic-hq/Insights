import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "supabase/types"

// Type aliases for better readability
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
type Project_SectionInsert = Database["public"]["Tables"]["project_sections"]["Insert"]
type Project_SectionUpdate = Database["public"]["Tables"]["project_sections"]["Update"]

// Default ordering for sections if no explicit position is provided
const DEFAULT_SECTION_POSITION: Record<string, number> = {
	research_goal: 1,
	questions: 2,
	decision_questions: 3, // Add decision_questions support (use integer)
	target_orgs: 4,
	target_roles: 5,
	assumptions: 6,
	unknowns: 7,
	custom_instructions: 8,
}

export const getProjects = async ({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) => {
	return await supabase
		.from("projects")
		.select("*")
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getProjectById = async ({ supabase, id }: { supabase: SupabaseClient<Database>; id: string }) => {
	const isUUID = UUID_REGEX.test(id)
	const query = supabase.from("projects").select(`
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

	// Support both UUID and slug lookup
	if (isUUID) {
		return await query.eq("id", id).single()
	}
	return await query.eq("slug", id).single()
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

const _createProjectSection = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Project_SectionInsert
}) => {
	return await supabase.from("project_sections").insert(data).select().single()
}

const _updateProjectSection = async ({
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
	const position = data.position ?? DEFAULT_SECTION_POSITION[(data as { kind?: string }).kind ?? ""]
	const payload = position ? { ...data, position } : data

	consola.log("🗄️ upsertProjectSection:", {
		kind: data.kind,
		project_id: data.project_id,
		position,
		payload,
		payloadMeta: payload.meta,
	})

	const result = await supabase
		.from("project_sections")
		.upsert(payload, { onConflict: "project_id,kind" })
		.select()
		.single()
	consola.log("🗄️ upsert result:", result)
	return result
}

const _deleteProjectSection = async ({ supabase, id }: { supabase: SupabaseClient<Database>; id: string }) => {
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
