import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { getProjectSectionsByKind } from "~/features/projects/db"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const url = new URL(request.url)
		const projectId = url.searchParams.get("projectId")

		if (!projectId) {
			return Response.json({ error: "Project ID is required" }, { status: 400 })
		}

		// Load all relevant sections
		const sectionTypes = [
			"target_orgs",
			"target_roles",
			"research_goal",
			"assumptions",
			"unknowns",
			"custom_instructions",
		]
		const sectionsData: Record<string, any> = {}

		for (const kind of sectionTypes) {
			const { data: sections, error } = await getProjectSectionsByKind({
				supabase,
				projectId,
				kind,
			})

			if (error) {
				consola.error(`Failed to load ${kind} sections:`, error)
				continue
			}

			// Get the most recent section for this kind
			if (sections && sections.length > 0) {
				sectionsData[kind] = sections[0] // Most recent due to ordering by created_at desc
			}
		}

		// Parse the data into the format expected by the component
		const result = {
			target_orgs: [] as string[],
			target_roles: [] as string[],
			research_goal: "",
			research_goal_details: "",
			assumptions: [] as string[],
			unknowns: [] as string[],
			custom_instructions: "",
		}

		// Parse target orgs data
		if (sectionsData.target_orgs) {
			const meta = sectionsData.target_orgs.meta || {}
			result.target_orgs = meta.target_orgs || []
		}

		// Parse target roles data
		if (sectionsData.target_roles) {
			const meta = sectionsData.target_roles.meta || {}
			result.target_roles = meta.target_roles || []
		}

		// Parse research goal data
		if (sectionsData.research_goal) {
			const meta = sectionsData.research_goal.meta || {}
			result.research_goal = meta.research_goal || ""
			result.research_goal_details = meta.research_goal_details || ""
		}

		// Parse assumptions data
		if (sectionsData.assumptions) {
			const meta = sectionsData.assumptions.meta || {}
			result.assumptions = meta.assumptions || []
		}

		// Parse unknowns data
		if (sectionsData.unknowns) {
			const meta = sectionsData.unknowns.meta || {}
			result.unknowns = meta.unknowns || []
		}

		// Parse custom instructions data
		if (sectionsData.custom_instructions) {
			const meta = sectionsData.custom_instructions.meta || {}
			result.custom_instructions = meta.custom_instructions || ""
		}

		consola.log(`Loaded project goals data for project ${projectId}`)

		return Response.json({
			success: true,
			data: result,
			projectId,
		})
	} catch (error) {
		consola.error("Failed to load project goals:", error)
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to load project goals",
			},
			{ status: 500 }
		)
	}
}
