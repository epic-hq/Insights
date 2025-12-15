import { createTool } from "@mastra/core/tools"
import { z } from "zod"

/**
 * Tool for switching between agents in the UI.
 * This is a client-side tool - the actual navigation happens in the chat component's onToolCall handler.
 */
export const switchAgentTool = createTool({
	id: "switch-agent",
	description:
		"Switch to a different agent for specialized tasks. Use 'project-setup' for onboarding/goal setting, 'project-status' for general queries.",
	inputSchema: z.object({
		targetAgent: z.enum(["project-setup", "project-status"]).describe("The agent to switch to"),
		reason: z.string().optional().describe("Brief explanation for why switching agents (shown to user)"),
	}),
})
