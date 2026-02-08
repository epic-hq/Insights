import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { getProjectSectionsByKind } from "~/features/projects/db";
import { getSectionDefaultValue, PROJECT_SECTIONS } from "~/features/projects/section-config";
import { getServerClient } from "~/lib/supabase/client.server";

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request);
		const url = new URL(request.url);
		const projectId = url.searchParams.get("projectId");

		if (!projectId) {
			return Response.json({ error: "Project ID is required" }, { status: 400 });
		}

		// Load all sections
		const sectionsData: Record<string, { meta: Record<string, unknown> }> = {};

		for (const { kind } of PROJECT_SECTIONS) {
			const { data: sections, error } = await getProjectSectionsByKind({
				supabase,
				projectId,
				kind,
			});

			if (error) {
				consola.error(`Failed to load ${kind} sections:`, error);
				continue;
			}

			// Get the most recent section for this kind
			if (sections && sections.length > 0) {
				sectionsData[kind] = {
					meta: (sections[0].meta as Record<string, unknown>) || {},
				};
			}
		}

		// Build result dynamically from section config
		const result: Record<string, unknown> = {};

		for (const { kind, type } of PROJECT_SECTIONS) {
			const section = sectionsData[kind];
			const meta = section?.meta || {};

			if (type === "object" && kind === "research_goal") {
				// Special case for research_goal which has nested structure
				result.research_goal = meta.research_goal || "";
				result.research_goal_details = meta.research_goal_details || "";
			} else {
				// For all other sections, extract the value from meta using the kind as key
				result[kind] = meta[kind] ?? getSectionDefaultValue(kind);
			}
		}

		consola.log(`Loaded project goals data for project ${projectId}`);

		return Response.json({
			success: true,
			data: result,
			projectId,
		});
	} catch (error) {
		consola.error("Failed to load project goals:", error);
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to load project goals",
			},
			{ status: 500 }
		);
	}
}
