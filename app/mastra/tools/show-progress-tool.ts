import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const showProgressTool = createTool({
	id: "showProgress",
	description:
		"Render a progress card inside the chat bubble showing steps of a long operation. Each step has a status (pending, active, done). Use when performing multi-step operations so the user sees progress.",
	inputSchema: z.object({
		title: z.string().describe("Title for the progress card (e.g. 'Analyzing interviews')"),
		steps: z
			.array(
				z.object({
					id: z.string().describe("Unique step identifier"),
					label: z.string().describe("Human-readable step label"),
					status: z
						.enum(["pending", "active", "done"])
						.describe("Step status: pending (not started), active (in progress), done (completed)"),
				})
			)
			.min(1)
			.max(6)
			.describe("1-6 steps to display"),
		progressPercent: z.number().min(0).max(100).optional().describe("Optional overall progress percentage (0-100)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
	}),
	execute: async () => {
		// Client-facing tool, server execution is a no-op
		return { success: true };
	},
});
