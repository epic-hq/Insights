/**
 * ChiefOfStaffAgent: strategic guidance based on current project status and tasks.
 */
import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import consola from "consola";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { getSharedPostgresStore } from "../storage/postgres-singleton";
import { displayComponentTool } from "../tools/display-component";
import { fetchProjectStatusContextTool } from "../tools/fetch-project-status-context";
import { generateProjectRoutesTool } from "../tools/generate-project-routes";
import { fetchTasksTool } from "../tools/manage-tasks";
import { recommendNextActionsTool } from "../tools/recommend-next-actions";
import { requestUserInputTool } from "../tools/request-user-input";
import { suggestionTool } from "../tools/suggestion-tool";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";

export const chiefOfStaffAgent = new Agent({
	id: "chief-of-staff-agent",
	name: "chiefOfStaffAgent",
	description:
		"Strategic advisor that reviews current project status and tasks to recommend the next 2-3 concrete actions.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = requestContext.get("project_id");
			const accountId = requestContext.get("account_id");
			const userId = requestContext.get("user_id");
			const responseMode = requestContext.get("response_mode");
			const isFastStandardized = responseMode === "fast_standardized";

			if (isFastStandardized) {
				return `
You are the Chief of Staff for project ${projectId}. Produce a fast, standardized answer for broad "what should I do next?" guidance.

# Fast Mode Rules
- Keep total response under 90 words.
- Make at most ONE data call:
  - First call fetchProjectStatusContext with scopes=["status","sections"], includeEvidence=false, and small limits.
  - Call recommendNextActions only if status/sections are missing, stale, or ambiguous.
- Do not call fetchTasks unless user explicitly asks about tasks.
- Return only this structure:
  Status: <1 sentence with concrete counts when available>.
  Next:
  1) <single-line action + why>
  2) <single-line action + why>
- No preamble, no headings, no long analysis.
- Format entity references as \`[Name](url)\`. Use generateProjectRoutes if URL not in tool output.

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`;
			}

			return `
You are the Chief of Staff for project ${projectId}. Your job is to orient the user and recommend the next 2-3 concrete actions based on real project data.

# Workflow (MANDATORY)

Step 1: Call recommendNextActions to get project state + prioritized suggestions. This tool automatically renders a visual DecisionSupport widget — you do NOT need to call displayComponent.
Step 2: Write a 1-2 sentence chat summary. The widget does the heavy lifting — keep text brief.

# Additional tools (use only when needed)
- fetchProjectStatusContext — only if you need detail beyond what recommendNextActions returns
- fetchTasks — only if user explicitly asks about tasks
- generateProjectRoutes — to build links for entities

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`;
		} catch (error) {
			consola.error("Error in chief of staff instructions:", error);
			return "You are a Chief of Staff. Use project data to recommend next actions.";
		}
	},
	model: openai("gpt-4o-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchProjectStatusContext: fetchProjectStatusContextTool,
		fetchTasks: fetchTasksTool,
		recommendNextActions: recommendNextActionsTool,
		// Alias: Mastra network routing agent may use kebab-case tool ID instead of camelCase key
		"recommend-next-actions": recommendNextActionsTool,
		suggestNextSteps: suggestionTool,
		generateProjectRoutes: generateProjectRoutesTool,
		requestUserInput: requestUserInputTool,
		displayComponent: displayComponentTool,
		"display-component": displayComponentTool,
	}),
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			lastMessages: 20,
			observationalMemory: {
				model: "openai/gpt-4.1-mini",
			},
		},
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
});
