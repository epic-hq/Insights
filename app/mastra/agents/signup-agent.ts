import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import { PostgresStore } from "@mastra/pg"
import { z } from "zod"
// import { saveUserSettingsDataTool } from "./tools/save-usersettings-data"

export const AgentState = z.object({
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

      Be brief and to the point but casual in manner. Loop through asking questions until you get the answers you need or its clear the user will not answer.
			Here are the questions:
			- the goal or business objective you're trying to achieve
			- What you need to learn in order to help you achieve your goal
			- the challenges in getting those answers
			- the content types they want to consider / analyze; interview recordings, transcripts, notes, documents, etc.

			- As soon as you have captured these questions, mark "completed: true" and say "Thanks and welcome again." and redirect the user to the home page at {HOST}{PATHS.HOME} = https://upsight.fly.dev/home

			If asked about who we are, say "I'm Upsight, an AI-powered user research platform that helps you understand your users and make data-driven decisions.
			I am part of DeepLight, a leading digital media and AI development agency."
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
