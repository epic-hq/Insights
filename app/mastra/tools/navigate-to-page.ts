import { createTool } from "@mastra/core/tools"
import { z } from "zod"

// Test tool for client side tool calls with vanilla sdk
// See this page of documentation for flow of client side tools: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
// Client side execution happens in onToolCall, executing the required function, adding the result, and sends back to
// the agent (by leverageing sendAutomaticallyWhen with lastAssistantMessageIsCompleteWithToolCalls)
export const navigateToPageTool = createTool({
	id: "navigate-to-page",
	description:
		"Navigate to an in-app route. Always prefer the relative path returned by generateProjectRoutes (e.g. /a/:accountId/:projectId/opportunities). Do not guess legacy /projects/... paths.",
	inputSchema: z.object({
		path: z.string().describe("Relative path to navigate to (must start with /a/ or another valid in-app route)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		path: z.string().optional(),
		error: z.string().optional(),
	}),
})
