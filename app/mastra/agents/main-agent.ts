import { Agent } from "@mastra/core/agent"
import { LibSQLStore } from "@mastra/libsql"
import { Memory } from "@mastra/memory"
import z from "zod"
import { openai } from "../../lib/billing/instrumented-openai.server"
import { manageOrganizationsTool } from "../tools/manage-organizations"
import { managePeopleTool } from "../tools/manage-people"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"
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
	id: "main-agent",
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
      6. Manage organizations - create, update, delete, and retrieve company/organization records
      7. **Destructive action safety (People)**: Never delete a person record based on an ambiguous name.
         - If user says "delete Participant 2", first call "manage_people" with { action: "list", nameSearch: "Participant 2", limit: 10 } and show candidate rows.
         - Ask the user which exact person to delete by repeating the exact displayed name.
         - After user chooses, call "manage_people" with { action: "delete", personId, dryRun: true } and report linkedCounts. Note: interviews are NOT deleted when deleting a person.
         - Ask for confirmation in plain language (no special phrase required): "Delete '<name>'?"
         - Only after user confirms, call "manage_people" with { action: "delete", personId, force: true, confirmName: "<name>" }.
         - After a successful delete, if the tool returned linkedInterviews, ask: "Do you also want to delete the linked interview record(s) too?" If yes, tell the user you can do that via the project-status agent (which has interview delete tooling) or via the Interviews UI.

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
	model: openai("gpt-5-mini"),
	tools: wrapToolsWithStatusEvents({
		upsight_search: upsightTool,
		manage_organizations: manageOrganizationsTool,
		manage_people: managePeopleTool,
	}),
	memory: new Memory({
		storage: new LibSQLStore({
			id: "main-agent-memory",
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
