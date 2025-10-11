import type { ActionFunctionArgs } from "react-router"
import { runBamlWithTracing } from "~/lib/baml/runBamlWithTracing.server"
import { getLangfuseClient } from "~/lib/langfuse.server"

export const action = async ({ request }: ActionFunctionArgs) => {
	const langfuse = getLangfuseClient()
	const lfTrace = (langfuse as any).trace?.({ name: "api.evaluate-question" })
	try {
		const { question, research_context } = await request.json()

		if (!question || typeof question !== "string") {
			return Response.json({ error: "Question is required" }, { status: 400 })
		}

		const cleanedQuestion = question.trim()
		const { result: evaluation } = await runBamlWithTracing({
			functionName: "EvaluateInterviewQuestion",
			traceName: "baml.evaluate-question",
			input: {
				question: cleanedQuestion,
				research_context,
			},
			metadata: { route: "api.evaluate-question" },
			logUsageLabel: "api.evaluate-question",
			bamlCall: (client) =>
				client.EvaluateInterviewQuestion(cleanedQuestion, research_context || "General user research interview"),
		})
		lfTrace?.update?.({
			metadata: {
				research_context,
				question: cleanedQuestion,
			},
			output: evaluation,
		})
		return Response.json(evaluation)
	} catch (error) {
		console.error("Question evaluation error:", error)
		return Response.json({ error: "Failed to evaluate question" }, { status: 500 })
	} finally {
		lfTrace?.end?.()
	}
}
