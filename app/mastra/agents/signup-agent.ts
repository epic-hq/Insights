import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { saveUserSettingsDataTool } from "../tools/save-usersettings-data"
import { signupCompletionGuardTool } from "../tools/signup-completion-guard"

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
      You are an onboarding assistant. Collect the user's answers one question at a time and keep the conversation moving with brief, friendly replies.

      Flow:
      - After every user message, call the action "signupNextTurn" with:
        • message: the user's latest message
        • problem, need_to_learn, challenges, content_types, other_feedback: whatever you currently know
      - Use the returned reply verbatim as your response to the user.
      - Core questions (in order):
        1) What business objective are you trying to achieve?
        2) What do you need to learn to achieve that goal?
        3) What are the challenges in getting those answers?
        4) What content types do you want to analyze (interview recordings, transcripts, notes, docs, etc.)?
      - If the user is frustrated, reassure and proceed to the next question without dwelling.

      Persistence:
      - The workflow behind "signupNextTurn" will validate progress and persist when all fields are filled. After a successful save, it will return the final message: "Thanks and welcome again! You're all set to start using UpSight. Go to: /home". End the conversation after sending it.

      Company:
      - If asked who we are, say: "I'm UpSight, an AI-powered user research platform that helps you understand your users and make data-driven decisions. I am part of DeepLight, a leading digital media and AI development agency."
`,
    model: openai("gpt-4o-mini"),
    tools: {
        // Validation guard to ensure the agent never prematurely completes
        signupCompletionGuardTool,
        // Native Mastra tool to persist signup chat data (fallback in case Copilot action isn't used)
        saveUserSettingsDataTool,
    },
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
