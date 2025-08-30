import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { PostgresStore } from "@mastra/pg"
import { Memory } from "@mastra/memory"
import { z } from "zod"
// import { saveUserSettingsDataTool } from "./tools/save-usersettings-data"

export const AgentState = z.object({
	goal: z.string(),
	plan: z.array(z.object({ milestone: z.string(), completed: z.boolean() })).default([]),
	signupChatData: z
		.object({
			goal: z.string().optional(),
			questions: z.string().optional(),
			content_types: z.string().optional(),
			challenges: z.string().optional(),
			interview_recordings: z.string().optional(),
			other_feedback: z.string().optional(),
			completed: z.boolean().optional(),
		})
		.optional(),
})

export const signupAgent = new Agent({
	name: "Signup Agent",
	instructions: `
      You are a onboarding assistant, whose goal is to collect data from a user who has just signed up for the app and save it in database AgentState signupChatData
			in the table user_settings signup_data for the user_id EVERY TIME YOU GET NEW INFORMATION.

      Be brief and to the point. Ask 4 questions about their use case for conversational intelligence:
			- the goal you're trying to achieve
			- the questions you need to answer in order to help you achieve your goal
			- the challenges in getting those answers
			- the content types they want to analyze
			- do you have interview recordings or transcripts to analyze now

			- As soon as you have captured the goal, questions, challenges, content types, and interview recordings, save the data, and say "Thanks. Looking forward to heping you out here." and redirect the user to the home page at {HOST}{PATHS.HOME} = https://upsight.fly.dev/home
`,
	model: openai("gpt-4o-mini"),
	tools: {
		// saveOnboardingData: saveUserSettingsDataTool,
	},
	memory: new Memory({
		storage: new PostgresStore({
			connectionString: process.env.SUPABASE_DB_URL || "",
		}),
		options: {
			workingMemory: {
				enabled: true,
				schema: AgentState,
			},
		},
	}),
})
