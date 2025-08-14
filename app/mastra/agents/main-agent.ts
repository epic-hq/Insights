import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { LibSQLStore } from "@mastra/libsql"
import { Memory } from "@mastra/memory"
// import { weatherTool } from '../tools/weather-tool';
import z from "zod"

export const AgentState = z.object({
	plan: z.array(z.string()).default([]),
});

export const mainAgent = new Agent({
	name: "Main Agent",
	description: "Main agent for handling user queries and looking up user research data",
	instructions: `
      You are a helpful psychologist who evaluates people and their motives.
      - Keep responses concise but informative
      - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
      - If the user asks for activities, respond in the format they request.
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
