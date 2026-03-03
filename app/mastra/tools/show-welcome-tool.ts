import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const showWelcomeTool = createTool({
	id: "showWelcome",
	description:
		"Render a welcome-back card for returning users. Shows a date stamp, 1-4 change bullets summarizing what happened since their last visit, and action badges. Call fetchResearchPulse first to get deltas, then call this tool with the results. Only use as the FIRST message of a returning session.",
	inputSchema: z.object({
		datestamp: z.string().describe('Human-readable time-since-last-visit, e.g. "Since your last visit (2 days ago)"'),
		changes: z
			.array(
				z.object({
					icon: z.string().optional().describe("Lucide icon name for this change bullet"),
					text: z.string().describe("Short description of the change"),
				})
			)
			.min(1)
			.max(4)
			.describe("1-4 change bullets summarizing what happened"),
		badges: z
			.array(
				z.object({
					id: z.string().describe("Unique identifier for this badge"),
					label: z.string().describe("Short label (max 5 words)"),
					icon: z.string().optional().describe("Lucide icon name for this badge"),
					action: z.enum(["send_message", "navigate"]).describe("What happens on tap"),
					message: z.string().optional().describe("Message to send when action=send_message"),
					path: z.string().optional().describe("Path to navigate to when action=navigate"),
				})
			)
			.min(1)
			.max(4)
			.describe("1-4 tappable action badges"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
	}),
	execute: async () => {
		// Client-facing tool, server execution is a no-op
		return { success: true };
	},
});
