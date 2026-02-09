import type { PostgrestError, QueryData, SupabaseClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk/v3";
import consola from "consola";
import type { inferSegmentsTask } from "~/../src/trigger/people/inferSegments";
import type { Database } from "~/types";

/**
 * Trigger segment inference for a person if they have a title but missing job_function/seniority
 * Runs asynchronously in background - doesn't block the request
 */
async function triggerSegmentInferenceIfNeeded(person: {
	id: string;
	title?: string | null;
	job_function?: string | null;
	seniority_level?: string | null;
	account_id: string;
	project_id?: string | null;
}) {
	// Only trigger if person has a title but missing segment data
	if (!person.title || (person.job_function && person.seniority_level)) {
		return;
	}

	if (!person.project_id) {
		consola.warn("[db] Cannot trigger segment inference - missing project_id", {
			personId: person.id,
		});
		return;
	}

	try {
		// Fire and forget - don't await
		tasks
			.trigger<typeof inferSegmentsTask>("people.infer-segments", {
				projectId: person.project_id,
				accountId: person.account_id,
				personId: person.id,
				force: false,
			})
			.then((handle) => {
				consola.info("[db] Triggered segment inference", {
					personId: person.id,
					runId: handle.id,
				});
			})
			.catch((err) => {
				consola.warn("[db] Failed to trigger segment inference", {
					personId: person.id,
					error: err,
				});
			});
	} catch (err) {
		// Don't fail the main operation if inference trigger fails
		consola.warn("[db] Error triggering segment inference", {
			personId: person.id,
			error: err,
		});
	}
}

export const getPeople = async ({
	supabase,
	accountId,
	projectId,
	scope = "project",
	includeInternal = false,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	scope?: "project" | "account";
	includeInternal?: boolean;
}) => {
	// Build select string conditionally based on scope
	const baseSelect = `
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
				facet:facet_account(
					id,
					label,
					kind_id,
					synonyms,
					is_active,
					facet_kind_global(
						slug,
						label
					)
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
                                job_title,
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
			)`;

	// Build query based on scope
	let query = supabase.from("people").select(baseSelect).eq("account_id", accountId);

	if (!includeInternal) {
		query = query.or("person_type.is.null,person_type.neq.internal");
	}

	// Filter by project using the project_id column directly
	// NOTE: We use people.project_id instead of project_people junction table
	// because junction records may not always be created/maintained
	if (scope === "project") {
		query = query.eq("project_id", projectId);
	}

	const { data, error } = await query.order("created_at", { ascending: false });

	// consola.log("getPeople data: ", data)
	return { data, error };
};

export const getPersonById = async ({
	supabase,
	accountId,
	projectId,
	id,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	id: string;
}) => {
	const personByIdQuery = supabase
		.from("people")
		.select(
			`
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
				facet:facet_account(
					id,
					label,
					kind_id,
					synonyms,
					is_active,
					facet_kind_global(
						slug,
						label
					)
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
                                job_title,
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
                        person_facet_summaries (
                                id,
                                kind_slug,
                                summary,
                                generated_at,
                                model_version,
                                input_hash,
                                supporting_evidence
                        ),
                        interview_people (
                                id,
                                interviews (
                                        id,
                                        title,
                                        created_at,
                                        source_type,
                                        media_type
				)
			)
		`
		)
		.eq("account_id", accountId)
		.eq("id", id)
		.single();

	type PersonById = QueryData<typeof personByIdQuery>;

	consola.info("getPersonById query params:", { accountId, projectId, id });

	const { data, error } = await personByIdQuery;

	if (error) {
		const supabaseError = error as PostgrestError;
		consola.error("getPersonById error", {
			accountId,
			projectId,
			id,
			message: error.message,
			details: supabaseError?.details,
			hint: supabaseError?.hint,
			code: supabaseError?.code,
		});

		throw new Response("Failed to load person", { status: 500 });
	}

	if (!data) {
		consola.warn("getPersonById: no data returned", {
			accountId,
			projectId,
			id,
		});
		throw new Response("Person not found", { status: 404 });
	}

	const personData: PersonById = data;
	// consola.info("getPersonById success", { id: personData.id, project_id: projectId })
	return personData;
};

export const createPerson = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>;
	data: Database["public"]["Tables"]["people"]["Insert"];
}) => {
	const result = await supabase.from("people").insert(data).select().single();

	// Trigger segment inference if person was created successfully with a title
	if (result.data && !result.error) {
		triggerSegmentInferenceIfNeeded({
			id: result.data.id,
			title: result.data.title,
			job_function: result.data.job_function,
			seniority_level: result.data.seniority_level,
			account_id: result.data.account_id,
			project_id: result.data.project_id,
		});
	}

	return result;
};

export const updatePerson = async ({
	supabase,
	id,
	accountId,
	projectId,
	data,
}: {
	supabase: SupabaseClient<Database>;
	id: string;
	accountId: string;
	projectId: string;
	data: Database["public"]["Tables"]["people"]["Update"];
}) => {
	const updatePersonQuery = supabase
		.from("people")
		.update(data)
		.eq("id", id)
		.eq("project_id", projectId)
		.select()
		.single();

	type UpdatedPerson = QueryData<typeof updatePersonQuery>;

	const { data: updatedData, error } = await updatePersonQuery;

	if (error) {
		throw new Response("Failed to update person", { status: 500 });
	}

	const personData: UpdatedPerson = updatedData;

	// Trigger segment inference if title was updated and segments are missing
	// Use force=true if title changed to re-infer even if segments exist
	if (personData && data.title !== undefined) {
		triggerSegmentInferenceIfNeeded({
			id: personData.id,
			title: personData.title,
			job_function: personData.job_function,
			seniority_level: personData.seniority_level,
			account_id: accountId,
			project_id: projectId,
		});
	}

	return personData;
};

export const deletePerson = async ({
	supabase,
	id,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>;
	id: string;
	accountId: string;
	projectId: string;
}) => {
	void accountId;
	const { data, error } = await supabase.from("people").delete().eq("id", id).eq("project_id", projectId);

	if (error) {
		console.error("Delete person error:", error);
		throw new Error(`Failed to delete person: ${error.message} (code: ${error.code})`);
	}

	return { data, error };
};

/**
 * Get people with validation details for the validation status page
 * Returns people who have validation-related data (outcome, stage, etc.)
 */
const _getPeopleWithValidation = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
}) => {
	void accountId;
	// Query people with their interview data and insights
	// We'll use the contact_info JSONB field to store validation details
	const { data, error } = await supabase
		.from("people")
		.select(
			`
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
                                        title
				)
			)
		`
		)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false });

	return { data, error };
};
