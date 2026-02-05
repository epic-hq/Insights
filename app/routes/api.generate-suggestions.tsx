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
				suggestions: z.array(z.string()).max(3).describe("3 short suggestions based on the assistant's message"),
			}),
			prompt: `
Context: ${uiContext || "User interface context"}
Last Assistant Message: "${lastMessage.slice(0, 1000)}"

Generate 3 short suggestions for what the user might say or select next.

CRITICAL: If the assistant asks a question with examples (e.g., "Which roles do you want? e.g., Director of Regulatory Affairs, Clinical Operations Manager"),
extract those EXACT examples as suggestions. The user should be able to click to select an option the AI mentioned.

Rules:
- If the message contains examples in parentheses or after "e.g.", extract those as suggestions
- If asking about roles/organizations/competitors, use the specific names mentioned
- Length: Keep suggestions short (2-6 words max)
- Format: Use the exact wording from the AI's examples when available
- If no examples given, suggest short relevant responses based on context
`,
		})

		return Response.json({ suggestions: result.object.suggestions })
	} catch (error) {
		console.error("Suggestion generation failed:", error)
		return Response.json({ suggestions: [] })
	}
}
