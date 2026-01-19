/**
 * ChiefOfStaffAgent: strategic guidance based on current project status and tasks.
 */
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import consola from "consola"
import { openai } from "../../lib/billing/instrumented-openai.server"
import { fetchProjectStatusContextTool } from "../tools/fetch-project-status-context"
import { fetchTasksTool } from "../tools/manage-tasks"
import { recommendNextActionsTool } from "../tools/recommend-next-actions"
import { suggestionTool } from "../tools/suggestion-tool"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

export const chiefOfStaffAgent = new Agent({
	id: "chief-of-staff-agent",
	name: "chiefOfStaffAgent",
	description:
		"Strategic advisor that reviews current project status and tasks to recommend the next 2-3 concrete actions.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = requestContext.get("project_id")
			const accountId = requestContext.get("account_id")
			const userId = requestContext.get("user_id")

			return `
You are the Chief of Staff for project ${projectId}. Your job is to orient the user and recommend the next 2-3 concrete actions based on real project data.

# Operating Rules
- ALWAYS ground recommendations in fetched data. Do not give generic advice.
- First call fetchProjectStatusContext with scopes=["status","sections"] and includeEvidence=false, and small limits.
- Call fetchTasks with limit<=10 to see current backlog.
- Use recommendNextActions if the user asks what to do next or seems unsure.
- Provide at most 2-3 recommendations, each tied to a specific project gap or task.
- Include links when referencing records.

# Guidance by Situation
- No interviews or evidence: recommend 1-2 interviews or an Ask Link to gather initial data.
- Many themes but low validation: recommend a survey to validate top 1-2 themes.
- Lots of backlog tasks: recommend the top 2 highest-impact tasks and ask to confirm priority.
- Project setup incomplete: recommend finishing setup before analysis work.

# Output Style
- Short status snapshot (1-2 sentences max).
- 2-3 action recommendations, each starting with a strong verb.
- Ask a single clarifying question only if the data is missing or ambiguous.

# Tools
- fetchProjectStatusContext
- fetchTasks
- recommendNextActions
- suggestNextSteps

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`
		} catch (error) {
			consola.error("Error in chief of staff instructions:", error)
			return "You are a Chief of Staff. Use project data to recommend next actions."
		}
	},
	model: openai("gpt-4o-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchProjectStatusContext: fetchProjectStatusContextTool,
		fetchTasks: fetchTasksTool,
		recommendNextActions: recommendNextActionsTool,
		suggestNextSteps: suggestionTool,
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
})
