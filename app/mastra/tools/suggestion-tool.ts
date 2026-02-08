import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const suggestionTool = createTool({
	id: "suggestNextSteps",
	description:
		"Provide 2-3 clickable options for the user. CRITICAL: If you just asked a question with examples (e.g. 'Director of Regulatory Affairs, Clinical Operations Manager'), use those EXACT examples as suggestions so the user can click to select them.",
	inputSchema: z.object({
		suggestions: z
			.array(z.string())
			.min(1)
			.max(3)
			.describe(
				"2-3 short options (max 6 words). If you mentioned specific examples in your response, use those exact examples here."
			),
	}),
	outputSchema: z.object({
		success: z.boolean(),
	}),
	execute: async () => {
		// This is a client-facing tool, server execution is a no-op
		return { success: true };
	},
});
