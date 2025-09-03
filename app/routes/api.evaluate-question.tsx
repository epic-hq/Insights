import type { ActionFunctionArgs } from "react-router"
import { b } from "../../baml_client"

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { question, research_context } = await request.json()

    if (!question || typeof question !== "string") {
      return Response.json({ error: "Question is required" }, { status: 400 })
    }

    const evaluation = await b.EvaluateInterviewQuestion(
      question.trim(),
      research_context || "General user research interview"
    )

    return Response.json(evaluation)
  } catch (error) {
    console.error("Question evaluation error:", error)
    return Response.json(
      { error: "Failed to evaluate question" }, 
      { status: 500 }
    )
  }
}