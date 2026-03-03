import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const showCelebrationTool = createTool({
	id: "showCelebration",
	description:
		"Render a celebration card for milestones like first interview uploaded, first theme discovered, first survey response, or 10+ evidence items. Max once per session. Keep it brief and action-oriented with an optional CTA.",
	inputSchema: z.object({
		milestone: z.string().describe('Milestone title, e.g. "First interview uploaded!"'),
		description: z.string().describe("Brief celebration text (1-2 sentences)"),
		icon: z.string().optional().describe("Lucide icon name (default: Sparkles)"),
		ctaLabel: z.string().optional().describe('CTA button text, e.g. "See your evidence"'),
		ctaAction: z.enum(["send_message", "navigate"]).optional().describe("What happens on CTA click"),
		ctaMessage: z.string().optional().describe("Message to send when ctaAction=send_message"),
		ctaPath: z.string().optional().describe("Path to navigate to when ctaAction=navigate"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
	}),
	execute: async () => {
		// Client-facing tool, server execution is a no-op
		return { success: true };
	},
});
