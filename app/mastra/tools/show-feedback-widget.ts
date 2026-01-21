import { createTool } from "@mastra/core/tools"
import { z } from "zod"

/**
 * Client-side tool for showing the PostHog feedback survey widget.
 * The agent detects feedback intent from conversation and extracts relevant context
 * to pre-populate the feedback form.
 *
 * Handled in ProjectStatusAgentChat.tsx onToolCall handler.
 */
export const showFeedbackWidgetTool = createTool({
	id: "showFeedbackWidget",
	description: `Show the product feedback widget when user wants to give feedback about the product.
Trigger when user says things like:
- "I want to give feedback"
- "report a bug" / "found a bug"
- "feature request" / "I wish..." / "it would be nice if..."
- "this is frustrating" / "this doesn't work"
- "suggestion for improvement"
- "feedback about..."

Extract any feedback details they've already mentioned to pre-fill the form, so they don't have to repeat themselves.`,
	inputSchema: z.object({
		feedbackType: z
			.enum(["bug", "feature_request", "general", "compliment"])
			.describe(
				"Type of feedback inferred from conversation: bug (something broken), feature_request (new capability), compliment (positive feedback), general (other)"
			),
		summary: z
			.string()
			.optional()
			.describe(
				"Brief summary extracted from conversation - what the user mentioned about the issue or request"
			),
		affectedFeature: z
			.string()
			.optional()
			.describe(
				"Which feature/area this relates to (e.g., 'imports', 'interviews', 'analysis', 'chat')"
			),
		sentiment: z
			.enum(["positive", "neutral", "negative"])
			.optional()
			.describe("Overall sentiment detected from conversation"),
		urgency: z
			.enum(["low", "medium", "high"])
			.optional()
			.describe("How urgent this seems based on user's language"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string().optional(),
	}),
	execute: async () => {
		// Client-side tool - actual widget display happens in onToolCall handler
		return { success: true }
	},
})
