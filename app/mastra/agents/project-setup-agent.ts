import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { displayUserQuestionsTool } from "../tools/display-user-questions"
import { saveProjectSectionsDataTool } from "../tools/save-project-sections-data"

const ProjectSetupState = z.object({
	projectSetup: z
		.object({
			research_goal: z.string().optional(),
			decision_questions: z.array(z.string()).optional(),
			assumptions: z.array(z.string()).optional(),
			unknowns: z.array(z.string()).optional(),
			target_orgs: z.array(z.string()).optional(),
			target_roles: z.array(z.string()).optional(),
			completed: z.boolean().optional(),
		})
		.optional(),
})

const navigateToPageTool = createTool({
	id: "navigate-to-page",
	description:
		"Navigate to a specific in-app route. Use the account-scoped paths (e.g. /a/:accountId/:projectId/setup) or other current UI routes—avoid legacy /projects/... URLs.",
	inputSchema: z.object({
		path: z.string().describe("Relative path to navigate to"),
	}),
})

export const projectSetupAgent = new Agent({
	name: "projectSetupAgent",
	instructions: async ({ runtimeContext }) => {
		const projectId = runtimeContext.get("project_id")
		const { data: existing } = await supabaseAdmin
			.from("project_sections")
			.select("project_id, kind, meta, content_md")
			.eq("project_id", projectId)
		return `
You are a project setup assistant. Ask the following core questions in order, one at a time, and keep responses short and friendly. Format responses with proper markdown for better readability.

Core questions (in order):
1) Who are ideal customers, organizations and roles? (target_orgs, target_roles)
2) Tell me about your business, what problem are you solving? (customer_problem)
3) What goal are you trying to achieve? (research_goal)
4) What key decisions are you facing? (decision_questions)
5) What are your riskiest assumptions? (assumptions)
6) What do you  need to learn? (unknowns)

Rules:
- Always store each answer in memory under the matching key.
- Save each answer individually as you discover them to the database using the "saveProjectSectionsData"
- When all six are answered, set completed=true in memory and thank the user.

Responses:
- Keep replies concise, bulleted when appropriate, and factual.
- Don't repeat the question or summarize the answer.
- If the user seems uncertain, suggest 2–3 concrete examples.


Existing project sections snapshot (for context):
${JSON.stringify(existing)}
`
	},
	model: openai("gpt-5.1"),
	tools: {
		saveProjectSectionsData: saveProjectSectionsDataTool,
		displayUserQuestions: displayUserQuestionsTool,
		navigateToPage: navigateToPageTool,
	},
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: { enabled: false, schema: ProjectSetupState },
			threads: { generateTitle: false },
		},
	}),
})
