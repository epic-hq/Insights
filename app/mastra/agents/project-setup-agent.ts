import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { PROJECT_SECTIONS } from "~/features/projects/section-config"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { displayUserQuestionsTool } from "../tools/display-user-questions"
import { saveProjectSectionsDataTool } from "../tools/save-project-sections-data"

// Dynamically build ProjectSetupState from section config
const buildProjectSetupStateSchema = () => {
	const stateFields: Record<string, z.ZodTypeAny> = {}

	for (const section of PROJECT_SECTIONS) {
		if (section.kind === "research_goal") {
			stateFields.research_goal = z.string().optional()
			stateFields.research_goal_details = z.string().optional()
		} else if (section.type === "string[]") {
			stateFields[section.kind] = z.array(z.string()).optional()
		} else if (section.type === "string") {
			stateFields[section.kind] = z.string().optional()
		}
	}

	stateFields.completed = z.boolean().optional()

	return z.object({
		projectSetup: z.object(stateFields).optional(),
	})
}

const ProjectSetupState = buildProjectSetupStateSchema()

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
1) Tell me about your business, what problem are you solving? (customer_problem)
2) Who are your ideal customers, organizations and roles? (target_orgs, target_roles)
3) What products and services do you offer? (offerings)
4) What other products or solutions are your customers likely using or considering? (competitors)
5) What goal are you trying to achieve with this research? (research_goal)
6) What do you need to learn? (unknowns)
7) What key decisions are you facing? (decision_questions)
8) What are your riskiest assumptions? (assumptions)

Rules:
- Always store each answer in memory under the matching key.
- Save each answer individually as you discover them to the database using the "saveProjectSectionsData"
- When all eight questions are answered, set completed=true in memory and thank the user.

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
