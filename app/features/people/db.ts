import type { SupabaseClient, QueryData } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getPeople = async ({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) => {
	return await supabase
		.from("people")
		.select(`
			*,
			personas (
				*
			),
			interview_people (
				interviews (
					*
				)
			)
		`)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })
}

export const getPersonById = async ({
	supabase,
	accountId,
	id,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	id: string
}) => {
	const personByIdQuery = supabase
		.from("people")
		.select(`
			*,
			personas (
				*
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
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	data: Database["public"]["Tables"]["people"]["Update"]
}) => {
	return await supabase
		.from("people")
		.update(data)
		.eq("id", id)
		.eq("account_id", accountId)
		.select()
		.single()
}

export const deletePerson = async ({
	supabase,
	id,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
}) => {
	return await supabase
		.from("people")
		.delete()
		.eq("id", id)
		.eq("account_id", accountId)
}
