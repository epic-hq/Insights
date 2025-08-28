import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generateResearchQuestions } from "~/utils/research-analysis.server"

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

		consola.log("Generating questions for:", {
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
		})

		const suggestions = await generateResearchQuestions(
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			custom_instructions || ""
		)

		consola.log("BAML suggestions result:", JSON.stringify(suggestions, null, 2))

		// Flatten the categorized questions into a simple array for the UI
		const allQuestions = [
			...(suggestions.core_questions || []),
			...(suggestions.behavioral_questions || []),
			...(suggestions.pain_point_questions || []),
			...(suggestions.solution_questions || []),
			...(suggestions.context_questions || []),
		]

		consola.log("All questions flattened:", allQuestions)

		// Sort by priority and take the requested number of questions
		// Priority is an int where 1 is highest priority, 2 is medium, 3 is lowest
		const topQuestions = allQuestions
			.sort((a, b) => Number(a.priority ?? 2) - Number(b.priority ?? 2))
			.slice(0, questionCount)

		return Response.json({
			success: true,
			questions: topQuestions.map((q) => ({
				question: q.question,
				rationale: q.rationale,
				priority: q.priority,
			})),
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
