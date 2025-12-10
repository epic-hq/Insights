import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const suggestionTool = createTool({
	id: "suggestNextSteps",
	description: "Provide a list of 2-3 suggested next steps or responses for the user to select from.",
	inputSchema: z.object({
		suggestions: z
			.array(z.string())
			.min(1)
			.max(3)
			.describe("2-3 short, actionable follow-up options for the user (max 5-8 words each)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
	}),
	execute: async () => {
		// This is a client-facing tool, server execution is a no-op
		return { success: true }
	},
})
