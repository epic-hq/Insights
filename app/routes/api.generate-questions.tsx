import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generateResearchQuestions } from "~/utils/research-analysis.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const body = await request.json()
		const { icp, role, goal, customInstructions, questionCount = 4 } = body

		if (!icp || !role || !goal) {
			return Response.json({ error: "Missing required fields: icp, role, goal" }, { status: 400 })
		}

		consola.log("Generating questions for:", { icp, role, goal, customInstructions, questionCount })

		// Include custom instructions in the goal if provided
		const enhancedGoal = customInstructions ? `${goal}. Additional requirements: ${customInstructions}` : goal

		const suggestions = await generateResearchQuestions(icp, role, enhancedGoal, customInstructions || "")

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
		const topQuestions = allQuestions.sort((a, b) => a.priority - b.priority).slice(0, questionCount)

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
