import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { displayUserQuestionsTool } from "../tools/display-user-questions"
import { saveProjectSectionsDataTool } from "../tools/save-project-sections-data"

export const ProjectSetupState = z.object({
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

export const navigateToPageTool = createTool({
	id: "navigate-to-page",
	description: "Navigate to a specific page. \\n Projects: /projects \\n Home: /home \\n Setup: /setup",
	inputSchema: z.object({
		path: z.string().describe("Path to navigate to"),
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
You are a project setup assistant. Ask the six core questions in order, one at a time, and keep responses short and friendly. After each answer, update memory and save to project sections for the current project.

Core questions (in order):
1) What business objective are you trying to achieve? (research_goal)
2) What key decisions do you think you might need to make? (decision_questions)
3) What are your current assumptions? (assumptions)
4) What do we not know and need to learn? (unknowns)
5) Who are ideal companies or organizations? (target_orgs)
6) Who could be ideal target users or buyers? (target_roles)

Rules:
- Always store each answer in memory under the matching key.
- Save each answer to the database using the "saveProjectSectionsData" tool with runtimeContext.project_id.
- For decision_questions, assumptions, unknowns, target_orgs, and target_roles, prefer arrays (split if necessary).
- For research_goal, save the main sentence; add research_goal_details only if the user adds context.
- Keep replies concise. If the user seems uncertain, suggest 2–3 concrete examples to choose from.
- When all six are answered, set completed=true in memory and thank the user.

Existing project sections snapshot (for context):
${JSON.stringify(existing)}
`
	},
	model: openai("gpt-4.1"),
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
