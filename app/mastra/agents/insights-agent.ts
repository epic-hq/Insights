import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { dailyBriefWorkflow } from "../workflows/daily-brief"

/**
 * Agent that can generate insights and run daily brief workflows
 * This agent can be used in chat interfaces via CopilotKit
 */
export const insightsAgent = new Agent({
	name: "insights-agent",
	description: "Generate insights and daily briefs for user research projects",
	instructions: `You are an expert user research analyst. You can:
1. Generate daily briefs of insights for specific projects
2. Analyze user research data and provide recommendations
3. Help users understand patterns in their research insights

When a user asks for a daily brief, use the dailyBriefWorkflow to get the latest insights for their project.`,
	model: openai("gpt-5-mini"),
	workflows: {
		dailyBriefWorkflow,
	},
});
