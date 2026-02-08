/**
 * API endpoint for inline editing of people in the table view
 * Supports updating person fields and organization linking
 */
import consola from "consola";
import type { ActionFunction } from "react-router";
import { createOrganization, linkPersonToOrganization } from "~/features/organizations/db";
import { updatePerson } from "~/features/people/db";
import { currentProjectContext } from "~/server/current-project-context";
import { userContext } from "~/server/user-context";

export const action: ActionFunction = async ({ context, request, params }) => {
	const ctx = context.get(userContext);
	const projectCtx = context.get(currentProjectContext);
	const supabase = ctx.supabase;

	// Get account/project from context or fall back to URL params
	const accountId = projectCtx?.accountId || params?.accountId || null;
	const projectId = projectCtx?.projectId || params?.projectId || null;

	consola.info("[people/update-inline] Context check:", {
		contextAccountId: projectCtx?.accountId,
		contextProjectId: projectCtx?.projectId,
		paramsAccountId: params?.accountId,
		paramsProjectId: params?.projectId,
		finalAccountId: accountId,
		finalProjectId: projectId,
	});

	if (!accountId || !projectId) {
		return Response.json({ error: "Missing account or project context" }, { status: 400 });
	}

	if (!supabase) {
		return Response.json({ error: "Database connection not available" }, { status: 500 });
	}

	try {
		// Support both JSON and FormData submissions for Remix fetcher compatibility
		let personId: string;
		let field: string;
		let value: string | null;
		let organizationId: string | undefined;
		let newOrganizationName: string | undefined;
		let orgField: string | undefined;

		const contentType = request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			const payload = await request.json();
			personId = payload.personId;
			field = payload.field;
			value = payload.value;
			organizationId = payload.organizationId;
			newOrganizationName = payload.newOrganizationName;
			orgField = payload.orgField;
		} else {
			// Handle FormData from useFetcher
			const formData = await request.formData();
			personId = formData.get("personId") as string;
			field = formData.get("field") as string;
			const rawValue = formData.get("value") as string;
			value = rawValue === "" ? null : rawValue;
			organizationId = (formData.get("organizationId") as string) || undefined;
			newOrganizationName = (formData.get("newOrganizationName") as string) || undefined;
			orgField = (formData.get("orgField") as string) || undefined;
		}

		consola.info("[people/update-inline] Request:", {
			personId,
			field,
			value,
			organizationId,
			newOrganizationName,
		});

		if (!personId) {
			return Response.json({ error: "personId is required" }, { status: 400 });
		}

		// Handle organization updates separately
		if (field === "organization") {
			let targetOrgId = organizationId;

			// Create new organization if name provided
			if (newOrganizationName && !organizationId) {
				const { data: newOrg, error: createError } = await createOrganization({
					supabase,
					data: {
						account_id: accountId,
						project_id: projectId,
						name: newOrganizationName,
					},
				});

				if (createError) {
					consola.error("[people/update-inline] Create org error:", createError);
					return Response.json({ error: `Failed to create organization: ${createError.message}` }, { status: 500 });
				}

				targetOrgId = newOrg?.id;
				consola.info("[people/update-inline] Created new org:", targetOrgId);
			}

			if (targetOrgId) {
				// Clear is_primary on all existing links before setting the new one
				await supabase
					.from("people_organizations")
					.update({ is_primary: false })
					.eq("person_id", personId)
					.eq("account_id", accountId);

				// Link person to organization via junction table
				const { error: linkError } = await linkPersonToOrganization({
					supabase,
					accountId,
					projectId,
					personId,
					organizationId: targetOrgId,
					isPrimary: true,
				});

				if (linkError) {
					consola.error("[people/update-inline] Link error:", linkError);
					return Response.json({ error: `Failed to link organization: ${linkError.message}` }, { status: 500 });
				}

				// Also update default_organization_id on the person record
				const { error: defaultOrgError } = await supabase
					.from("people")
					.update({ default_organization_id: targetOrgId })
					.eq("id", personId)
					.eq("account_id", accountId);

				if (defaultOrgError) {
					consola.error("[people/update-inline] Default org update error:", defaultOrgError);
				}

				consola.success("[people/update-inline] Linked organization:", {
					personId,
					orgId: targetOrgId,
				});
			}

			return Response.json({ success: true, organizationId: targetOrgId });
		}

		// Handle organization field updates (like size_range, role in people_organizations)
		if (orgField && organizationId) {
			const allowedOrgFields = ["size_range", "employee_count", "industry"];
			const allowedLinkFields = ["role", "title"];

			if (allowedOrgFields.includes(orgField)) {
				// Update organization table directly
				const { error: updateError } = await supabase
					.from("organizations")
					.update({ [orgField]: value || null })
					.eq("id", organizationId)
					.eq("account_id", accountId);

				if (updateError) {
					consola.error("[people/update-inline] Org update error:", updateError);
					return Response.json({ error: `Failed to update organization: ${updateError.message}` }, { status: 500 });
				}

				consola.success("[people/update-inline] Updated organization:", {
					orgId: organizationId,
					field: orgField,
					value,
				});
				return Response.json({ success: true, organizationId });
			}

			if (allowedLinkFields.includes(orgField)) {
				// Update people_organizations link table (role/title at org)
				const { error: updateError } = await supabase
					.from("people_organizations")
					.update({ [orgField]: value || null })
					.eq("person_id", personId)
					.eq("organization_id", organizationId);

				if (updateError) {
					consola.error("[people/update-inline] Link update error:", updateError);
					return Response.json({ error: `Failed to update link: ${updateError.message}` }, { status: 500 });
				}

				consola.success("[people/update-inline] Updated org link:", {
					personId,
					orgId: organizationId,
					field: orgField,
					value,
				});
				return Response.json({ success: true, organizationId });
			}

			return Response.json({ error: `Organization field '${orgField}' is not editable` }, { status: 400 });
		}

		// Validate allowed fields for direct person updates
		const allowedFields = [
			"firstname",
			"lastname",
			"title",
			"description",
			"job_function",
			"seniority_level",
			"email",
			"phone",
			"linkedin_url",
			"company",
		];

		if (!allowedFields.includes(field)) {
			return Response.json({ error: `Field '${field}' is not editable` }, { status: 400 });
		}

		// Update the person field
		const updateData: Record<string, string | null> = {
			[field]: value || null,
		};

		const updatedPerson = await updatePerson({
			supabase,
			id: personId,
			accountId,
			projectId,
			data: updateData,
		});

		consola.success("[people/update-inline] Updated person:", {
			id: personId,
			field,
			value,
		});

		return Response.json({ success: true, person: updatedPerson });
	} catch (err) {
		consola.error("[people/update-inline] Error:", err);

		// Check for unique constraint violation
		const errorMessage = err instanceof Error ? err.message : String(err);
		if (
			errorMessage.includes("uniq_people_account_name") ||
			errorMessage.includes("duplicate key") ||
			errorMessage.includes("unique constraint")
		) {
			return Response.json(
				{
					error:
						"A person with this name already exists at this company. Use the deduplication feature to merge duplicate records.",
				},
				{ status: 409 }
			);
		}

		return Response.json({ error: errorMessage || "Internal server error" }, { status: 500 });
	}
};
