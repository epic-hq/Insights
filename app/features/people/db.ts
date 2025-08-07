import type { QueryData, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getPeople = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
}) => {
	return await supabase
		.from("people")
		.select(`
			*,
			people_personas (
				personas (
					*
				),
				confidence_score,
				source,
				assigned_at
			),
			interview_people (
				interviews (
					*
				)
			)
		`)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
}

export const getPersonById = async ({
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
	const personByIdQuery = supabase
		.from("people")
		.select(`
			*,
			people_personas (
				personas (
					*
				),
				confidence_score,
				source,
				assigned_at,
				interview_id,
				project_id
			),
			interview_people (
				interviews (
					*,
					insights (
						*
					)
				)
			)
		`)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	type PersonById = QueryData<typeof personByIdQuery>

	const { data, error } = await personByIdQuery

	if (error) {
		throw new Response("Failed to load person", { status: 500 })
	}

	const personData: PersonById = data
	return personData
}

export const createPerson = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Database["public"]["Tables"]["people"]["Insert"]
}) => {
	return await supabase.from("people").insert(data).select().single()
}

export const updatePerson = async ({
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
	data: Database["public"]["Tables"]["people"]["Update"]
}) => {
	const updatePersonQuery = supabase
		.from("people")
		.update(data)
		.eq("id", id)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.select()
		.single()

	type UpdatedPerson = QueryData<typeof updatePersonQuery>

	const { data: updatedData, error } = await updatePersonQuery

	if (error) {
		throw new Response("Failed to update person", { status: 500 })
	}

	const personData: UpdatedPerson = updatedData
	return personData
}

export const deletePerson = async ({
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
	return await supabase.from("people").delete().eq("id", id).eq("account_id", accountId).eq("project_id", projectId)
}
