// agents/llmAgent.ts
import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"

export const llmAgent = new Agent({
	name: "LLM Agent",
	description: "An agent that generates responses using OpenAI's GPT model.",
	instructions: "Generate a response based on the provided input.",
	model: openai("gpt-4o-mini"),
});
