import type { QueryData, SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
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
	const { data, error } = await supabase
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
			person_facet (
				facet_account_id,
				source,
				confidence,
				noted_at,
				facet:facet_account!inner(
					id,
					label,
					kind_id,
					synonyms,
					is_active
				)
			),
                        person_scale (
                                kind_slug,
                                score,
                                band,
                                source,
                                confidence,
                                noted_at
                        ),
                        people_organizations (
                                id,
                                role,
                                relationship_status,
                                is_primary,
                                organization:organizations (
                                        id,
                                        name,
                                        website_url,
                                        domain,
                                        industry,
                                        size_range,
                                        headquarters_location
                                )
                        ),
                        interview_people (
                                interviews (
                                        id,
                                        title
                                )
			)
		`)
		// .eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	// consola.log("getPeople data: ", data)
	return { data, error }
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
	consola.info("getPersonById start", { accountId, projectId, id })
	const personByIdQuery = supabase
		.from("people")
		.select(`
			*,
			people_personas (
				personas (
					id,
					name,
					color_hex
				),
				confidence_score,
				source,
				assigned_at,
				interview_id,
				project_id
			),
			person_facet (
				facet_account_id,
				source,
				confidence,
				noted_at,
				facet:facet_account!inner(
					id,
					label,
					kind_id,
					synonyms,
					is_active
				)
			),
                        person_scale (
                                kind_slug,
                                score,
                                band,
                                source,
                                confidence,
                                noted_at
                        ),
                        people_organizations (
                                id,
                                role,
                                relationship_status,
                                is_primary,
                                notes,
                                organization:organizations (
                                        id,
                                        name,
                                        website_url,
                                        domain,
                                        industry,
                                        size_range,
                                        headquarters_location
                                )
                        ),
                        interview_people (
                                id,
                                interviews (
                                        id,
                                        title,
                                        created_at,
                                        insights (
						id,
						name,
						category,
						pain,
						details,
						desired_outcome,
						evidence,
						journey_stage,
						emotional_response,
						project_id
					)
				)
			)
		`)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	type PersonById = QueryData<typeof personByIdQuery>

	const { data, error } = await personByIdQuery

	if (error) {
		consola.error("getPersonById error", {
			accountId,
			projectId,
			id,
			message: error.message,
			details: (error as any)?.details,
			hint: (error as any)?.hint,
			code: (error as any)?.code,
		})
		throw new Response("Failed to load person", { status: 500 })
	}

	if (!data) {
		consola.warn("getPersonById: no data returned", { accountId, projectId, id })
		throw new Response("Person not found", { status: 404 })
	}

	const personData: PersonById = data
	consola.info("getPersonById success", { id: personData.id, project_id: projectId })
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
	const { data, error } = await supabase.from("people").delete().eq("id", id).eq("project_id", projectId)

	if (error) {
		console.error("Delete person error:", error)
		throw new Error(`Failed to delete person: ${error.message} (code: ${error.code})`)
	}

	return { data, error }
}

/**
 * Get people with validation details for the validation status page
 * Returns people who have validation-related data (outcome, stage, etc.)
 */
const _getPeopleWithValidation = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
}) => {
	// Query people with their interview data and insights
	// We'll use the contact_info JSONB field to store validation details
	const { data, error } = await supabase
		.from("people")
		.select(`
			id,
			name,
			company,
			contact_info,
			person_facet (
				facet_account_id,
				source,
				confidence
			),
                        person_scale (
                                kind_slug,
                                score,
                                band
                        ),
                        people_organizations (
                                organization:organizations (
                                        id,
                                        name,
                                        website_url,
                                        domain
                                )
                        ),
                        interview_people (
                                interviews (
                                        id,
                                        title,
                                        insights (
						id,
						name,
						category,
						pain,
						journey_stage
					)
				)
			)
		`)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	return { data, error }
}
