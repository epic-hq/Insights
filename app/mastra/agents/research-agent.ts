/**
 * ResearchAgent: specialist for interviews, surveys, and prompts.
 */
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import consola from "consola"
import { openai } from "../../lib/billing/instrumented-openai.server"
import { createSurveyTool } from "../tools/create-survey"
import { fetchInterviewContextTool } from "../tools/fetch-interview-context"
import {
	createInterviewPromptTool,
	deleteInterviewPromptTool,
	fetchInterviewPromptsTool,
	updateInterviewPromptTool,
} from "../tools/manage-interview-prompts"
import { manageInterviewsTool } from "../tools/manage-interviews"
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
You are a focused Research specialist for project ${projectId}.

# Scope
You handle interviews, interview prompts, and survey responses/creation.
If the request is about people, tasks, opportunities, or documents, return control to the orchestrator.

# Surveys
- Use searchSurveyResponses for any survey response questions.
- Use createSurvey to draft and create new surveys, then navigate to the edit URL if returned.

# Interviews & Prompts
- Use manageInterviews for interview CRUD operations.
- Use fetchInterviewContext for deep dive on specific interviews.
- Use interview prompt tools for creating/updating/deleting prompts.

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`
		} catch (error) {
			consola.error("Error in research agent instructions:", error)
			return "You are a Research specialist for interviews and surveys."
		}
	},
	model: openai("gpt-4o-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchInterviewContext: fetchInterviewContextTool,
		manageInterviews: manageInterviewsTool,
		fetchInterviewPrompts: fetchInterviewPromptsTool,
		createInterviewPrompt: createInterviewPromptTool,
		updateInterviewPrompt: updateInterviewPromptTool,
		deleteInterviewPrompt: deleteInterviewPromptTool,
		searchSurveyResponses: searchSurveyResponsesTool,
		createSurvey: createSurveyTool,
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
})
