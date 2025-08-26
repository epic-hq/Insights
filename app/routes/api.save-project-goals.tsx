import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { upsertProjectSection } from "~/features/projects/db"
import { getServerClient } from "~/lib/supabase/server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { client: supabase } = getServerClient(request)
		const data = await request.json()

		const { projectId, targetOrg, targetRoles, goalTitle, goalDetail, assumptions, unknowns } = data

		if (!projectId) {
			return Response.json({ error: "Project ID is required" }, { status: 400 })
		}

		// Prepare project sections to upsert
		const sectionsToSave = [
			{
				project_id: projectId,
				kind: "target_market",
				content_md: `**Target Organization:** ${targetOrg}\n\n**Target Roles:** ${targetRoles.join(", ")}`,
				meta: {
					targetOrg,
					targetRoles,
					lastUpdated: new Date().toISOString(),
				},
			},
			{
				project_id: projectId,
				kind: "goal",
				content_md: `# ${goalTitle}\n\n${goalDetail}`,
				meta: {
					goalTitle,
					goalDetail,
					lastUpdated: new Date().toISOString(),
				},
			},
		]

		// Add assumptions section if any exist
		if (assumptions && assumptions.length > 0) {
			sectionsToSave.push({
				project_id: projectId,
				kind: "assumptions",
				content_md: assumptions.map((assumption: string, index: number) => `${index + 1}. ${assumption}`).join("\n\n"),
				meta: {
					assumptions,
					count: assumptions.length,
					lastUpdated: new Date().toISOString(),
				},
			})
		}

		// Add unknowns section if any exist
		if (unknowns && unknowns.length > 0) {
			sectionsToSave.push({
				project_id: projectId,
				kind: "risks", // Use 'risks' kind for unknowns as it's in the schema
				content_md: unknowns.map((unknown: string, index: number) => `${index + 1}. ${unknown}`).join("\n\n"),
				meta: {
					unknowns,
					count: unknowns.length,
					lastUpdated: new Date().toISOString(),
				},
			})
		}

		// Save all sections
		const results = []
		for (const section of sectionsToSave) {
			const { data: savedSection, error } = await upsertProjectSection({
				supabase,
				data: section,
			})

			if (error) {
				consola.error(`Failed to save section ${section.kind}:`, error)
				return Response.json({ error: `Failed to save ${section.kind}` }, { status: 500 })
			}

			results.push(savedSection)
		}

		consola.log(`Successfully saved ${results.length} project sections for project ${projectId}`)

		return Response.json({
			success: true,
			sectionsCount: results.length,
			projectId,
		})
	} catch (error) {
		consola.error("Failed to save project goals:", error)
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to save project goals",
			},
			{ status: 500 }
		)
	}
}
