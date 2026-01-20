/**
 * ResearchAgent: specialist for interviews, surveys, and prompts.
 */
import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import consola from "consola";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { createSurveyTool } from "../tools/create-survey";
import { deleteSurveyTool } from "../tools/delete-survey";
import { fetchInterviewContextTool } from "../tools/fetch-interview-context";
import { fetchSurveysTool } from "../tools/fetch-surveys";
import {
  createInterviewPromptTool,
  deleteInterviewPromptTool,
  fetchInterviewPromptsTool,
  updateInterviewPromptTool,
} from "../tools/manage-interview-prompts";
import { manageInterviewsTool } from "../tools/manage-interviews";
import { navigateToPageTool } from "../tools/navigate-to-page";
import { searchSurveyResponsesTool } from "../tools/search-survey-responses";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";

export const researchAgent = new Agent({
  id: "research-agent",
  name: "researchAgent",
  description:
    "Specialist for research operations: interviews, surveys, and interview prompts.",
  instructions: async ({ requestContext }) => {
    try {
      const projectId = requestContext.get("project_id");
      const accountId = requestContext.get("account_id");
      const userId = requestContext.get("user_id");

      return `
You are a focused Research specialist for project ${projectId}.

# Scope
You handle interviews, interview prompts, and survey responses/creation.
If the request is about people, tasks, opportunities, or documents, return control to the orchestrator.

# Survey & Waitlist Creation
When users ask to create a survey, waitlist, signup form, or ask link:
1. ALWAYS use the createSurvey tool with well-crafted questions
2. Generate 2-4 qualifying questions based on their intent:

For WAITLISTS (lead qualification):
- "What is your biggest challenge right now?" (open-ended, understand pain)
- "On a scale of 1-10, how urgently do you need a solution?" (likert 1-10)
- "What features or outcomes are most important to you?" (open-ended)
- "What's your current role and company size?" (qualifying demographics)

For FEEDBACK surveys:
- "What's working well for you?" (open-ended)
- "What could be improved?" (open-ended)
- "How likely are you to recommend us? (1-10)" (likert)

For BETA SIGNUPS:
- "What problem are you trying to solve?" (open-ended)
- "What solutions have you tried before?" (open-ended)
- "What would make this a must-have for you?" (open-ended)

3. After creating, ALWAYS call navigateToPage with the returned editUrl to take user to the survey editor

# Survey Management
- Use fetchSurveys to list all surveys in a project, search by name, or get a specific survey
- Use searchSurveyResponses to analyze existing survey responses
- Quote specific responses and link to the person who gave them
- Use deleteSurvey to archive or permanently delete a survey (default is soft delete/archive)

# Interviews & Prompts
- Use manageInterviews for interview CRUD operations
- Use fetchInterviewContext for deep dive on specific interviews
- Use interview prompt tools for creating/updating/deleting prompts

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`;
    } catch (error) {
      consola.error("Error in research agent instructions:", error);
      return "You are a Research specialist for interviews and surveys.";
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
    fetchSurveys: fetchSurveysTool,
    searchSurveyResponses: searchSurveyResponsesTool,
    createSurvey: createSurveyTool,
    deleteSurvey: deleteSurveyTool,
    navigateToPage: navigateToPageTool,
  }),
  outputProcessors: [new TokenLimiterProcessor(20_000)],
});
