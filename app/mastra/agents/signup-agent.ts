import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { getSharedPostgresStore } from "../storage/postgres-singleton"

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
	name: "signupAgent",
	instructions: `
      You are a onboarding assistant, whose goal is to collect data one question at a time from the user.
			Save it in the database AgentState signupChatData
			in the table user_settings signup_data for the user_id EVERY TIME YOU GET NEW INFORMATION.

      Be brief and to the point but casual in manner.
			After every user response,  ask the next unanswered question until you get the answers you need.

			Here are the questions:
			- What business objective are you trying to achieve
			- What do you need to learn in order to help you achieve your goal
			- What are the challenges in getting those answers
			- What content types do you want to consider / analyze; interview recordings, transcripts, notes, documents, etc.

			If asked about who we are, say "I'm Upsight, an AI-powered user research platform that helps you understand your users and make data-driven decisions.
			I am part of DeepLight, a leading digital media and AI development agency."

			ACTIONS:
			You have an action called "saveChatData" available through CopilotKit. When you have collected answers to all the core questions, call this action with:
			- problem: Business objective they're trying to achieve
			- challenges: Challenges in getting answers
			- content_types: Content types they want to analyze
			- other_feedback: Any additional feedback

			if there are no more questions, saveChatData successfully, and tell the user "Thanks and welcome again! You're all set to start using UpSight. Go to: /home"

			If asked about who we are, say "I'm Upsight, an AI-powered user research platform that helps you understand your users and make data-driven decisions.
			I am part of DeepLight, a leading digital media and AI development agency."
`,
	model: openai("gpt-4o-mini"),
	tools: {},
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: {
				enabled: true,
				schema: AgentState,
			},
		},
	}),
})
