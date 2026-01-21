import { createTool } from "@mastra/core/tools"
import { z } from "zod"

/**
 * Client-side tool for capturing product feedback directly from conversation.
 * The agent detects feedback intent and extracts relevant context.
 * Feedback is logged to PostHog and a confirmation card is displayed in chat.
 *
 * Handled in ProjectStatusAgentChat.tsx onToolCall handler.
 */
export const showFeedbackWidgetTool = createTool({
	id: "showFeedbackWidget",
	description: `Capture and log product feedback when user mentions feedback, bugs, requests, or frustration.
Trigger when user says things like:
- "I want to give feedback"
- "report a bug" / "found a bug"
- "feature request" / "I wish..." / "it would be nice if..."
- "this is frustrating" / "this doesn't work"
- "suggestion for improvement"
- "feedback about..."

Extract the feedback details from what they've already said - no form needed, just capture it directly.`,
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
		captured: z.boolean().optional(),
		feedbackType: z.string().optional(),
		summary: z.string().optional(),
		affectedFeature: z.string().optional(),
	}),
	execute: async () => {
		// Client-side tool - feedback capture happens in onToolCall handler
		return { success: true }
	},
})
