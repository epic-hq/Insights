import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types";

interface ProjectScopedParams {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
}

export const getOrganizations = async ({ supabase, projectId }: ProjectScopedParams) => {
	return await supabase
		.from("organizations")
		.select(
			`
                        *,
                        people_organizations (
                                id,
                                role,
                                relationship_status,
                                is_primary,
                                person:people (
                                        id,
                                        name,
                                        image_url,
                                        segment
                                )
                        )
                `
		)
		.eq("project_id", projectId)
		.order("name", { ascending: true });
};

export const getOrganizationById = async ({ supabase, projectId, id }: ProjectScopedParams & { id: string }) => {
	return await supabase
		.from("organizations")
		.select(
			`
                        *,
                        people_organizations (
                                id,
                                role,
                                relationship_status,
                                is_primary,
                                notes,
                                person:people (
                                        id,
                                        name,
                                        image_url,
                                        segment,
                                        title
                                )
                        )
                `
		)
		.eq("project_id", projectId)
		.eq("id", id)
		.single();
};

export const createOrganization = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>;
	data: Database["public"]["Tables"]["organizations"]["Insert"];
}) => {
	return await supabase.from("organizations").insert(data).select().single();
};

export const updateOrganization = async ({
	supabase,
	accountId,
	id,
	data,
}: Omit<ProjectScopedParams, "projectId"> & {
	id: string;
	data: Database["public"]["Tables"]["organizations"]["Update"];
}) => {
	// Use account_id for filtering since organizations might have null project_id
	return await supabase.from("organizations").update(data).eq("id", id).eq("account_id", accountId).select().single();
};

export const deleteOrganization = async ({ supabase, id, projectId }: ProjectScopedParams & { id: string }) => {
	return await supabase.from("organizations").delete().eq("id", id).eq("project_id", projectId);
};

export const linkPersonToOrganization = async ({
	supabase,
	accountId,
	projectId,
	personId,
	organizationId,
	role,
	relationshipStatus,
	isPrimary = false,
	notes,
}: ProjectScopedParams & {
	personId: string;
	organizationId: string;
	role?: string | null;
	relationshipStatus?: string | null;
	isPrimary?: boolean;
	notes?: string | null;
}) => {
	return await supabase.from("people_organizations").upsert(
		{
			account_id: accountId,
			project_id: projectId,
			person_id: personId,
			organization_id: organizationId,
			role: role ?? null,
			relationship_status: relationshipStatus ?? null,
			is_primary: isPrimary,
			notes: notes ?? null,
		},
		{ onConflict: "person_id,organization_id" }
	);
};

export const unlinkPersonFromOrganization = async ({
	supabase,
	projectId,
	personId,
	organizationId,
}: ProjectScopedParams & { personId: string; organizationId: string }) => {
	return await supabase
		.from("people_organizations")
		.delete()
		.eq("project_id", projectId)
		.eq("person_id", personId)
		.eq("organization_id", organizationId);
};

export const getProjectPeopleSummary = async ({ supabase, projectId }: ProjectScopedParams) => {
	return await supabase
		.from("people")
		.select("id, name, image_url, segment, title")
		.eq("project_id", projectId)
		.order("name", { ascending: true, nullsFirst: false });
};
