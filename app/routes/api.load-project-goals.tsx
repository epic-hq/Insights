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
		const sectionTypes = ["target_market", "goal", "assumptions", "risks"]
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
			targetOrg: "",
			targetRoles: [] as string[],
			goalTitle: "",
			goalDetail: "",
			assumptions: [] as string[],
			unknowns: [] as string[],
		}

		// Parse target market data
		if (sectionsData.target_market) {
			const meta = sectionsData.target_market.meta || {}
			result.targetOrg = meta.targetOrg || ""
			result.targetRoles = meta.targetRoles || []
		}

		// Parse goal data
		if (sectionsData.goal) {
			const meta = sectionsData.goal.meta || {}
			result.goalTitle = meta.goalTitle || ""
			result.goalDetail = meta.goalDetail || ""
		}

		// Parse assumptions data
		if (sectionsData.assumptions) {
			const meta = sectionsData.assumptions.meta || {}
			result.assumptions = meta.assumptions || []
		}

		// Parse unknowns/risks data
		if (sectionsData.risks) {
			const meta = sectionsData.risks.meta || {}
			result.unknowns = meta.unknowns || []
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
