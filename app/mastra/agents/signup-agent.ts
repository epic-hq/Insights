import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/server"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { displayUserQuestionsTool } from "../tools/display-user-questions"
import { saveUserSettingsDataTool } from "../tools/save-usersettings-data"
import { signupCompletionGuardTool } from "../tools/signup-completion-guard"

export const AgentState = z.object({
  signupChatData: z
    .object({
      problem: z.string().optional(),
      need_to_learn: z.string().optional(),
      content_types: z.string().optional(),
      challenges: z.string().optional(),
      other_feedback: z.string().optional(),
      completed: z.boolean().optional(),
    })
    .optional(),
})

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

export const signupAgent = new Agent({
  name: "signupAgent",
  instructions: async ({ runtimeContext }) => {
    const { data } = await supabaseAdmin
      .from("user_settings")
      .select("signup_data")
      .eq("user_id", runtimeContext.get("user_id"))
      .single()
    return `
You are an onboarding prescreen assistant for the waitlist. Ask short, targeted questions and collect the minimum to judge fit.

Flow:
- After every user message, update memory and save progress with the saveUserSettingsData tool when you have enough for its fields.
- Ask these in order (one at a time):
  1) Describe the business goal that could benefit from more customer intelligence. (map to: problem)
  2) What learnings in particular would move the needle for you and your organization? (map to: need_to_learn → store in other_feedback when saving)
  3) What data sources do you already have (e.g., interviews, surveys, support logs)? (map to: content_types; keep concise)
  4) What’s blocking you from getting these learnings today? (map to: challenges)

Rules:
- Keep replies concise. Offer examples when user is unsure.
- Use the saveUserSettingsData tool with fields: problem, challenges, content_types, other_feedback. Include need_to_learn inside other_feedback when saving.
- Set completed=true only after all four mapped fields are answered.
- Close by thanking them and linking to https://getupsight.com/home

Company:
- If asked who we are, say: "I'm UpSight, an AI-powered user research platform that helps you understand your users and make data-driven decisions. I am part of DeepLight, a leading digital media and AI development agency."

Current signup_data snapshot:
${JSON.stringify(data)}
`
  },
  model: openai("gpt-4.1"),
  tools: {
    // Validation guard to ensure the agent never prematurely completes
    // signupCompletionGuardTool,
    // Native Mastra tool to persist signup chat data (fallback in case Copilot action isn't used)
    saveUserSettingsData: saveUserSettingsDataTool,
    navigateToPage: navigateToPageTool,
    displayUserQuestions: displayUserQuestionsTool,
  },
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: {
				enabled: false,
				schema: AgentState,
			},
			threads: {
				generateTitle: false,
			},
		},
	}),
})
