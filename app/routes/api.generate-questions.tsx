import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generateQuestionSetCanonical } from "~/utils/research-analysis.server"
import { getServerClient } from "~/lib/supabase/server"
import { getProjectContextGeneric } from "~/features/questions/db"
import { currentProjectContext } from "~/server/current-project-context"

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		// Prefer explicit project_id from form, else fall back to server currentProjectContext (if available)
		let ctxProjectId: string | null = null
		try {
			if (context?.get) {
				const ctxVal = context.get(currentProjectContext)
				ctxProjectId = ctxVal?.projectId ?? null
			}
		} catch {
			// context not provided for this route; ignore
		}
		const project_id = ((formData.get("project_id") as string) || ctxProjectId || null) as string | null
		let target_orgs = formData.get("target_orgs") as string
		let target_roles = formData.get("target_roles") as string
		let research_goal = formData.get("research_goal") as string
		let research_goal_details = formData.get("research_goal_details") as string
		let assumptions = formData.get("assumptions") as string
		let unknowns = formData.get("unknowns") as string
		let custom_instructions = (formData.get("custom_instructions") as string) || ""
		let questionCount = Number(formData.get("questionCount") ?? 10)
		let interview_time_limit = Number(formData.get("interview_time_limit") ?? 60)

		// If project_id is provided, load project context from database
		if (project_id) {
			const { client: supabase } = getServerClient(request)

			try {
				const projectContext = await getProjectContextGeneric(supabase, project_id)

				consola.log("projectContext:", projectContext)

				if (!projectContext) {
					return Response.json(
						{
							error: "Project context not found in database. Please complete project setup first.",
						},
						{ status: 400 }
					)
				}

				const meta = projectContext.merged as any
				// Load from database, keep custom_instructions from request
				target_orgs = meta.target_orgs?.join?.(", ") || meta.target_orgs || target_orgs || ""
				target_roles = meta.target_roles?.join?.(", ") || meta.target_roles || target_roles || ""
				research_goal = meta.research_goal || research_goal || ""
				research_goal_details = meta.research_goal_details || research_goal_details || ""
				assumptions = meta.assumptions?.join?.(", ") || meta.assumptions || assumptions || ""
				unknowns = meta.unknowns?.join?.(", ") || meta.unknowns || unknowns || ""
			} catch (error) {
				consola.warn("Could not load project context from database:", error)
			}
		}

		// Validate required fields (only when not loading from database)
		if (
			!project_id &&
			(!target_orgs || !target_roles || !research_goal || !research_goal_details || !assumptions || !unknowns)
		) {
			return Response.json(
				{
					error:
						"Missing required fields: target_orgs, target_roles, research_goal, research_goal_details, assumptions, unknowns",
				},
				{ status: 400 }
			)
		}

		// Final validation after potentially loading from database
		if (!target_orgs || !target_roles || !research_goal || !research_goal_details || !assumptions || !unknowns) {
			return Response.json(
				{
					error: project_id
						? "Project context not found in database. Please complete project setup first."
						: "Missing required fields: target_orgs, target_roles, research_goal, research_goal_details, assumptions, unknowns",
				},
				{ status: 400 }
			)
		}

		consola.log("Generating questions for:", {
			project_id,
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			custom_instructions,
		})

		consola.log("Generating questions (canonical) for:", {
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			questionCount,
		})

		const questionSet = await generateQuestionSetCanonical({
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			custom_instructions,
			session_id: `session_${Date.now()}`,
			round: 1,
			total_per_round: questionCount || 10,
			per_category_min: 1,
			per_category_max: 3,
			interview_time_limit,
		})

		consola.log("BAML questionSet result:", JSON.stringify(questionSet, null, 2))

		return Response.json({
			success: true,
			questionSet,
		})
	} catch (error) {
		consola.error("Failed to generate questions:", error)
		return Response.json(
			{
				error: "Failed to generate questions",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		)
	}
}
