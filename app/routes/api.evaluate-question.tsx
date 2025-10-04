import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { b } from "../../baml_client"

export const action = async ({ request }: ActionFunctionArgs) => {
	const langfuse = getLangfuseClient()
	const lfTrace = (langfuse as any).trace?.({ name: "api.evaluate-question" })
	try {
		const { question, research_context } = await request.json()

		if (!question || typeof question !== "string") {
			return Response.json({ error: "Question is required" }, { status: 400 })
		}

		const gen = lfTrace?.generation?.({ name: "baml.EvaluateInterviewQuestion" })
		const evaluation = await b.EvaluateInterviewQuestion(
			question.trim(),
			research_context || "General user research interview"
		)
		gen?.update?.({ input: { question: question.trim(), research_context }, output: evaluation })
		gen?.end?.()
		return Response.json(evaluation)
	} catch (error) {
		console.error("Question evaluation error:", error)
		return Response.json({ error: "Failed to evaluate question" }, { status: 500 })
	} finally {
		lfTrace?.end?.()
	}
}
