import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { LibSQLStore } from "@mastra/libsql"
import { Memory } from "@mastra/memory"
import { z } from "zod"

export const AgentState = z.object({
	goal: z.string(),
	plan: z.array(z.object({ milestone: z.string(), completed: z.boolean() })).default([]),
	signupChatData: z.object({
		problem: z.string().optional(),
		challenges: z.string().optional(),
		importance: z.number().optional(),
		ideal_solution: z.string().optional(),
		content_types: z.string().optional(),
		other_feedback: z.string().optional(),
		completed: z.boolean().optional(),
	}).optional(),
})

export const signupAgent = new Agent({
	name: "Signup Agent",
	instructions: `
      You are a helpful customer service agent, welcoming someone who just joined the wait list for our User Research app.

      Your primary function is to ask them a series of questions to help us understand their use case and
			collect the data we need to help them get started with the app. When responding:
			- start the conversation by Saying Hi and thanking them for signing up.
			- If the user asks for anything else, say sorry, I need to just focus on this for now.
			- after you collected and saved the data, redirect the user to the home page at {HOST}{PATHS.HOME} = https://upsight.fly.dev/home
`,
	model: openai("gpt-4o-mini"),
	tools: {},
	memory: new Memory({
		storage: new LibSQLStore({ url: "file::memory:" }),
		options: {
			workingMemory: {
				enabled: true,
				schema: AgentState,
			},
		},
	}),
})
