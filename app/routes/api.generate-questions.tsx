import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generateQuestionSetCanonical } from "~/utils/research-analysis.server"


export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const contentType = request.headers.get("content-type")
		let target_orgs: string
		let target_roles: string
		let research_goal: string
		let research_goal_details: string
		let assumptions: string
		let unknowns: string
		let custom_instructions: string
		let questionCount: number
		let interview_time_limit: number

		if (contentType?.includes("application/json")) {
			// Handle JSON requests (from new onboarding flow)
			const body = await request.json()
			target_orgs = body.target_org || ""
			target_roles = body.target_roles || ""
			research_goal = body.research_goal || ""
			research_goal_details = body.research_goal_details || ""
			assumptions = body.assumptions || ""
			unknowns = body.unknowns || ""
			custom_instructions = body.custom_instructions || ""
			questionCount = Number(body.questionCount ?? 10)
			interview_time_limit = Number(body.interview_time_limit ?? 60)
		} else {
			// Handle form data requests (legacy)
			const formData = await request.formData()
			target_orgs = formData.get("target_orgs") as string
			target_roles = formData.get("target_roles") as string
			research_goal = formData.get("research_goal") as string
			research_goal_details = formData.get("research_goal_details") as string
			assumptions = formData.get("assumptions") as string
			unknowns = formData.get("unknowns") as string
			custom_instructions = formData.get("custom_instructions") as string
			questionCount = Number(formData.get("questionCount") ?? 10)
			interview_time_limit = Number(formData.get("interview_time_limit") ?? 60)
		}

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
