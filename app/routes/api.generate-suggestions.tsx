import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	// Ensure user is authenticated
	const ctx = context.get(userContext)
	if (!ctx?.claims?.sub) {
		return Response.json({ suggestions: [] }, { status: 401 })
	}

	const { context: uiContext, lastMessage } = await request.json()

	if (!lastMessage || typeof lastMessage !== "string") {
		return Response.json({ suggestions: [] })
	}

	try {
		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: z.object({
				suggestions: z
					.array(z.string())
					.max(3)
					.describe("3 short, imperative, actionable next steps for the user. Max 5 words each."),
			}),
			prompt: `
Context: ${uiContext || "User interface context"}
Last Assistant Message: "${lastMessage.slice(0, 1000)}"

Generate 3 short, distinct, imperative suggestions for what the user might want to do or ask next based on the assistant's response.
- Format: Imperative commands (Verb + Noun).
- Length: Ultra-short (2-5 words).
- No questions. No "Would you like...".
- If the message asks a question, suggest answers.
- If the message provides data, suggest drill-downs or actions.
`,
		})

		return Response.json({ suggestions: result.object.suggestions })
	} catch (error) {
		console.error("Suggestion generation failed:", error)
		return Response.json({ suggestions: [] })
	}
}
