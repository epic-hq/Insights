/**
 * ResearchAgent: specialist for interviews, surveys, and prompts.
 */
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import consola from "consola"
import { openai } from "../../lib/billing/instrumented-openai.server"
import { createSurveyTool } from "../tools/create-survey"
import { deleteSurveyTool } from "../tools/delete-survey"
import { fetchInterviewContextTool } from "../tools/fetch-interview-context"
import { fetchSurveysTool } from "../tools/fetch-surveys"
import {
	createInterviewPromptTool,
	deleteInterviewPromptTool,
	fetchInterviewPromptsTool,
	updateInterviewPromptTool,
} from "../tools/manage-interview-prompts"
import { manageInterviewsTool } from "../tools/manage-interviews"
import { navigateToPageTool } from "../tools/navigate-to-page"
import { searchSurveyResponsesTool } from "../tools/search-survey-responses"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

export const researchAgent = new Agent({
	id: "research-agent",
	name: "researchAgent",
	description: "Specialist for research operations: interviews, surveys, and interview prompts.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = requestContext.get("project_id")
			const accountId = requestContext.get("account_id")
			const userId = requestContext.get("user_id")

			return `
You are a Research specialist that EXECUTES actions using tools. You do NOT describe what you would do - you DO it.

Project: ${projectId}, Account: ${accountId}

# CRITICAL: Survey/Waitlist Creation

When the user asks to create a survey, waitlist, signup, or ask link, you MUST:

1. IMMEDIATELY call the createSurvey tool with:
   - projectId: "${projectId}"
   - name: A descriptive name based on user request (e.g., "Product Waitlist", "Beta Signup")
   - description: Brief description
   - questions: Array of 2-4 questions (see examples below)
   - isLive: true

2. After createSurvey succeeds, IMMEDIATELY call navigateToPage with the editUrl from the response

DO NOT just describe what questions you would create. DO NOT provide fake URLs. CALL THE TOOL.

## Question Examples

For WAITLISTS:
[
  { "prompt": "What is your biggest challenge right now?", "type": "auto" },
  { "prompt": "On a scale of 1-10, how urgently do you need a solution?", "type": "likert", "likertScale": 10, "likertLabels": { "low": "Not urgent", "high": "Very urgent" } },
  { "prompt": "What features or outcomes are most important to you?", "type": "auto" }
]

For FEEDBACK:
[
  { "prompt": "What's working well for you?", "type": "auto" },
  { "prompt": "What could be improved?", "type": "auto" },
  { "prompt": "How likely are you to recommend us to a colleague?", "type": "likert", "likertScale": 10, "likertLabels": { "low": "Not likely", "high": "Very likely" } }
]

# Other Operations

- fetchSurveys: List/search surveys in the project
- searchSurveyResponses: Analyze survey responses
- deleteSurvey: Archive or delete a survey
- Interview prompts: Use fetch/create/update/deleteInterviewPrompt tools
- Interviews: Use manageInterviews, fetchInterviewContext

# Rules
- ALWAYS use tools to take action. Never just describe what you would do.
- After creating anything, use navigateToPage to take the user there.
- Never fabricate URLs - only use URLs returned by tools.
`
		} catch (error) {
			consola.error("Error in research agent instructions:", error)
			return "You are a Research specialist for interviews and surveys."
		}
	},
	model: openai("gpt-4o"),
	tools: wrapToolsWithStatusEvents({
		fetchInterviewContext: fetchInterviewContextTool,
		manageInterviews: manageInterviewsTool,
		fetchInterviewPrompts: fetchInterviewPromptsTool,
		createInterviewPrompt: createInterviewPromptTool,
		updateInterviewPrompt: updateInterviewPromptTool,
		deleteInterviewPrompt: deleteInterviewPromptTool,
		fetchSurveys: fetchSurveysTool,
		searchSurveyResponses: searchSurveyResponsesTool,
		createSurvey: createSurveyTool,
		deleteSurvey: deleteSurveyTool,
		navigateToPage: navigateToPageTool,
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
})
