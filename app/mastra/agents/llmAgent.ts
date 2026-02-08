// agents/llmAgent.ts

import { Agent } from "@mastra/core/agent";
import { openai } from "../../lib/billing/instrumented-openai.server";

export const llmAgent = new Agent({
	id: "llm-agent",
	name: "LLM Agent",
	description: "An agent that generates responses using OpenAI's GPT model.",
	instructions: "Generate a response based on the provided input.",
	model: openai("gpt-5-mini"),
});
