/**
 * API route to update ICP criteria for a project
 *
 * POST: Save ICP criteria to project_sections (project-level overrides)
 */

import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server");
		const { user: claims } = await getAuthenticatedUser(request);
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get user-scoped client
		const { client: userDb } = getServerClient(request);

		const body = await request.json();
		const { accountId, projectId, target_roles, target_orgs, target_company_sizes, target_facets } = body;

		if (!projectId || !accountId) {
			return Response.json({ error: "Missing projectId or accountId" }, { status: 400 });
		}

		// Verify user has access to this project
		const { data: project, error: projectError } = await userDb
			.from("projects")
			.select("id, account_id")
			.eq("id", projectId)
			.eq("account_id", accountId)
			.single();

		if (projectError || !project) {
			return Response.json({ error: "Project not found" }, { status: 404 });
		}

		// Update or insert project_sections for each criteria type
		const sections = [
			{ kind: "target_roles", meta: { target_roles } },
			{ kind: "target_orgs", meta: { target_orgs } },
			{ kind: "target_company_sizes", meta: { target_company_sizes } },
			{ kind: "target_facets", meta: { target_facets: target_facets || [] } },
		];

		for (const section of sections) {
			const { error } = await userDb.from("project_sections").upsert(
				{
					project_id: projectId,
					kind: section.kind,
					meta: section.meta,
				},
				{
					onConflict: "project_id,kind",
				}
			);

			if (error) {
				console.error(`Failed to save ${section.kind}:`, error);
				return Response.json({ error: `Failed to save ${section.kind}` }, { status: 500 });
			}
		}

		return Response.json({ success: true });
	} catch (error: any) {
		console.error("[icp-criteria] Error:", error);
		return Response.json(
			{
				error: error?.message || "Failed to save ICP criteria",
			},
			{ status: 500 }
		);
	}
}
