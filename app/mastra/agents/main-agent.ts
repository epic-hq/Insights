import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { LibSQLStore } from "@mastra/libsql"
import { Memory } from "@mastra/memory"
import z from "zod"
import { upsightTool } from "../tools/upsight-tool"

export const AgentState = z.object({
	plan: z.array(z.string()).default([]),
	projectStatus: z
		.object({
			keyFindings: z.array(z.string()).default([]),
			nextSteps: z.array(z.string()).default([]),
			totalInsights: z.number().default(0),
			totalInterviews: z.number().default(0),
			totalOpportunities: z.number().default(0),
			totalPeople: z.number().default(0),
			totalPersonas: z.number().default(0),
			lastUpdated: z.string().optional(),
			currentProject: z.string().optional(),
			currentAccount: z.string().optional(),
			projectName: z.string().optional(),
			currentPhase: z.string().optional(),
			progressPercent: z.number().default(0),
			must_do: z.string().optional(),
		})
		.optional(),
})

export const mainAgent = new Agent({
	name: "Main Agent",
	description: "Main agent for handling user queries and looking up user research data",
	instructions: `
      You are a business analyst with powerful data science skills specializing in user research and product insights.
      
      Your primary role is to:
      1. Help users understand their project data by searching through insights, interviews, opportunities, people, and personas
      2. Provide actionable recommendations based on data patterns
      3. Identify key findings and suggest next steps
      4. Share project status information with the frontend through agent state
      5. Track critical "must do" items that need immediate attention
      
      When users ask about project information:
      - Use the upsight_search tool to gather comprehensive project data
      - Analyze patterns in insights (high-impact items, categories, trends)
      - Review interview data for recency and coverage
      - Assess opportunities for prioritization
      - Update your working memory with project status including:
        * Current project metrics (insights, interviews, opportunities, people, personas counts)
        * Key findings from recent analysis
        * Next steps based on data gaps or patterns
        * Critical "must_do" items that require immediate attention
        * Project phase and progress percentage
      
      Always provide:
      - Clear, actionable insights
      - Data-driven recommendations
      - Specific next steps based on current project state
      - Context about what the data reveals about user needs and opportunities
      - Identification of critical tasks that should be marked as "must_do"
`,
	model: openai("gpt-4o-mini"),
	tools: {
		upsight_search: upsightTool,
	},
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
