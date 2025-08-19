import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { LibSQLStore } from "@mastra/libsql"
import { Memory } from "@mastra/memory"
// import { weatherTool } from '../tools/weather-tool';
import z from "zod"

export const AgentState = z.object({
	plan: z.array(z.string()).default([]),
})

export const mainAgent = new Agent({
	name: "Main Agent",
	description: "Main agent for handling user queries and looking up user research data",
	instructions: `
      You are a business analyst with powerful data science skills. Tell me what i need to know.
			User tools to get information, transform, filter, sort analyze it.
`,
	model: openai("gpt-4o-mini"),
	tools: {},
	memory: new Memory({
		storage: new LibSQLStore({
			url: ":memory:", // using in-memory storage to avoid file connection issues
		}),
		options: {
			workingMemory: {
				enabled: true,
				schema: AgentState,
			},
		},
	}),
})
