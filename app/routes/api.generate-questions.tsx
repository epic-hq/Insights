import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generateQuestionSetCanonical } from "~/utils/research-analysis.server"


export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		const target_orgs = formData.get("target_orgs") as string
		const target_roles = formData.get("target_roles") as string
		const research_goal = formData.get("research_goal") as string
		const research_goal_details = formData.get("research_goal_details") as string
		const assumptions = formData.get("assumptions") as string
		const unknowns = formData.get("unknowns") as string
		const custom_instructions = formData.get("custom_instructions") as string
		const questionCount = Number(formData.get("questionCount") ?? 10)

		consola.log("Generating questions for:", {
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
		})
		if (!target_orgs || !target_roles || !research_goal || !research_goal_details || !assumptions || !unknowns) {
			return Response.json(
				{
					error:
						"Missing required fields: target_orgs, target_roles, research_goal, research_goal_details, assumptions, unknowns",
				},
				{ status: 400 }
			)
		}

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
			custom_instructions: custom_instructions || "",
			session_id: `session_${Date.now()}`,
			round: 1,
			total_per_round: questionCount || 10,
			per_category_min: 1,
			per_category_max: 3,
			interview_time_limit: Number(formData.get("interview_time_limit") ?? 60),
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
