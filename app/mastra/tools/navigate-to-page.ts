import { createTool } from "@mastra/core/tools"
import { z } from "zod"

// Test tool for client side tool calls with vanilla sdk
// See this page of documentation for flow of client side tools: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
// Client side execution happens in onToolCall, executing the required function, adding the result, and sends back to
// the agent (by leverageing sendAutomaticallyWhen with lastAssistantMessageIsCompleteWithToolCalls)
export const navigateToPageTool = createTool({
	id: "navigate-to-page",
	description: "Navigate to a specific page. \n Projects: /projects \n Home: /home \n Signup Chat: /signup-chat",
	inputSchema: z.object({
		path: z.string().describe("Path to navigate to"),
	}),
})
