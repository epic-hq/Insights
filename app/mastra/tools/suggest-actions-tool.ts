import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const suggestActionsTool = createTool({
	id: "suggestActions",
	description:
		"Render rich suggestion badges and/or an action card inside the chat bubble. Use for actionable next steps that benefit from icons and structure. Badges appear as a 2-up tappable pill grid (max 4). The optional card is a single highlighted suggestion with icon, title, description, and CTA.",
	inputSchema: z.object({
		badges: z
			.array(
				z.object({
					id: z.string().describe("Unique identifier for this badge"),
					label: z.string().describe("Short label (max 5 words)"),
					icon: z
						.string()
						.optional()
						.describe(
							"Lucide icon name: Search, Upload, Users, BarChart3, FileText, MessageSquare, Lightbulb, Target, TrendingUp, Zap, Eye, Plus, ArrowRight, RefreshCw, Settings"
						),
					action: z.enum(["send_message", "navigate"]).describe("What happens on tap"),
					message: z.string().optional().describe("Message to send when action=send_message"),
					path: z.string().optional().describe("Path to navigate to when action=navigate"),
				})
			)
			.min(1)
			.max(4)
			.describe("1-4 tappable suggestion badges"),
		card: z
			.object({
				icon: z.string().describe("Lucide icon name for the card"),
				title: z.string().describe("Card title (max 8 words)"),
				description: z.string().describe("Brief description of the action (1-2 sentences)"),
				ctaLabel: z.string().describe("CTA button text (max 4 words)"),
				action: z.enum(["send_message", "navigate"]).describe("What happens on CTA click"),
				message: z.string().optional().describe("Message to send when action=send_message"),
				path: z.string().optional().describe("Path to navigate to when action=navigate"),
				skipLabel: z.string().optional().describe("Optional skip link text"),
			})
			.optional()
			.describe("Optional single highlighted action card"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
	}),
	execute: async () => {
		// Client-facing tool, server execution is a no-op
		return { success: true };
	},
});
