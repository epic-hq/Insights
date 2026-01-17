import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { taskAgent } from "~/app/mastra/agents/task-agent"

export const delegateToTaskAgentTool = createTool({
	id: "delegate-to-task-agent",
	description:
		"Delegate task management operations to specialized task agent. Use when user wants to create, update, complete, delete, or query tasks. The task agent is an expert at task operations and will handle the request efficiently.",
	inputSchema: z.object({
		userMessage: z.string().describe("User's task-related request (e.g., 'I completed getting papers to Kathy')"),
		context: z.string().optional().describe("Optional additional context about the task request"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		response: z.string(),
		agentUsed: z.string(),
	}),
	execute: async (input, context?) => {
		try {
			const projectId = context?.requestContext?.get("project_id") as string | undefined
			const accountId = context?.requestContext?.get("account_id") as string | undefined
			const userId = context?.requestContext?.get("user_id") as string | undefined

			if (!projectId || !accountId || !userId) {
				throw new Error("Missing required context: project_id, account_id, or user_id")
			}

			consola.info("Delegating to task agent", {
				projectId,
				accountId,
				userId,
				message: input.userMessage.substring(0, 100),
			})

			const result = await taskAgent.generate(input.userMessage, {
				requestContext: new Map([
					["project_id", projectId],
					["account_id", accountId],
					["user_id", userId],
				]),
			})

			return {
				success: true,
				response: result.text,
				agentUsed: "taskAgent",
			}
		} catch (error) {
			consola.error("Error delegating to task agent:", error)
			return {
				success: false,
				response: `Failed to delegate to task agent: ${error instanceof Error ? error.message : String(error)}`,
				agentUsed: "taskAgent",
			}
		}
	},
})
