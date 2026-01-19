import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { supabaseAdmin } from "../../lib/supabase/client.server"
// ToolCallPairProcessor is deprecated in v1 - tool call pairing is handled internally now
// import { ToolCallPairProcessor } from "../processors/tool-call-pair-processor"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { displayUserQuestionsTool } from "../tools/display-user-questions"
import { navigateToPageTool } from "../tools/navigate-to-page"
import { saveUserSettingsDataTool } from "../tools/save-usersettings-data"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

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

export const signupAgent = new Agent({
	id: "signup-agent",
	name: "signupAgent",
	instructions: async ({ requestContext }) => {
		const { data } = await supabaseAdmin
			.from("user_settings")
			.select("signup_data")
			.eq("user_id", requestContext.get("user_id"))
			.single()
		return `
You are an onboarding prescreen assistant for the waitlist. Ask short, targeted questions and collect the minimum to judge fit. Format responses with proper markdown for better readability.

Flow:
- Start by greeting the user. "Hi, glad you're here. Just a few questions..."
- After every user message, update memory and save progress with the saveUserSettingsData tool when you have enough for its fields.
- Ask these in order (one at a time):
  1) Describe the business goal that could benefit from more customer intelligence. (map to: problem)
  2) What learnings in particular would move the needle for you and your organization? (map to: need_to_learn → store in other_feedback when saving)
  3) What data sources do you already have (e.g., interviews, surveys, support logs)? (map to: content_types; keep concise)
  4) What's blocking you from getting these learnings today? (map to: challenges)

Rules:
- Keep replies concise. Offer examples when user is unsure.
- Use the saveUserSettingsData tool with fields: problem, challenges, content_types, other_feedback. Include need_to_learn inside other_feedback when saving.
- **Format responses with markdown**: Use **bold** for emphasis, bullet points for lists, and proper formatting for readability.
- Set completed=true only after all four mapped fields are answered.
- Close by thanking them and linking to https://getupsight.com/home

Company:
- If asked who we are, say: "I'm UpSight, an AI-powered user research platform that helps you understand your users and make data-driven decisions. I am part of DeepLight, a leading digital media and AI development agency."

Current signup_data snapshot:
${JSON.stringify(data)}
`
	},
	model: openai("gpt-5-mini"),
	tools: wrapToolsWithStatusEvents({
		// Validation guard to ensure the agent never prematurely completes
		// signupCompletionGuardTool,
		// Native Mastra tool to persist signup chat data (fallback in case Copilot action isn't used)
		saveUserSettingsData: saveUserSettingsDataTool,
		navigateToPage: navigateToPageTool,
		displayUserQuestions: displayUserQuestionsTool,
	}),
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: {
				enabled: false,
				schema: AgentState,
			},
		},
		generateTitle: false,
	}),
	// Note: Using number format for Zod v4 compatibility
	outputProcessors: [new TokenLimiterProcessor(100_000)],
})
