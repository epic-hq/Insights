import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
// @ts-expect-error - moduleResolution workaround for @mastra/memory/processors subpath export
import { TokenLimiter } from "@mastra/memory/processors"
import { z } from "zod"
import { PROJECT_SECTIONS } from "~/features/projects/section-config"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { ToolCallPairProcessor } from "../processors/tool-call-pair-processor"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { displayUserQuestionsTool } from "../tools/display-user-questions"
import { generateResearchStructureTool } from "../tools/generate-research-structure"
import { manageAnnotationsTool } from "../tools/manage-annotations"
import { manageDocumentsTool } from "../tools/manage-documents"
import {
	deleteProjectSectionMetaKeyTool,
	fetchProjectSectionTool,
	updateProjectSectionMetaTool,
} from "../tools/manage-project-sections"
import { saveProjectSectionsDataTool } from "../tools/save-project-sections-data"
import { webResearchTool } from "../tools/web-research"

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
You are a fast, efficient project setup assistant. Your goal: collect 8 pieces of info quickly and generate a research plan. Be BRIEF - 1-2 sentences max per response.

Questions to collect (in order):
1) Business & problem (customer_problem)
2) Target customers - orgs and roles (target_orgs, target_roles)
3) Products/services offered (offerings)
4) Competitors/alternatives (competitors)
5) Research goal (research_goal)
6) What you need to learn (unknowns)
7) Key decisions to make (decision_questions)
8) Riskiest assumptions (assumptions)

CRITICAL RULES:
- Ask ONE question at a time, max 1-2 sentences
- Save each answer immediately via "saveProjectSectionsData"
- NEVER summarize or repeat what user said - just move to next question
- NEVER ask for confirmation - when all 8 are done, immediately call "generateResearchStructure"
- After generating, say "Done! Your research plan is ready." and set completed=true

Response style:
- Ultra brief: "Got it. Next: [question]?"
- If user is vague, give 2-3 quick examples, don't lecture
- No bullets, no formatting unless truly needed
- No "Great!", "Perfect!", "Thanks for sharing" - just move forward

Document requests: If user asks to "save", "create", or "document" something, use manageDocuments tool.

Existing project sections (skip questions already answered):
${JSON.stringify(existing)}
`
	},
	model: openai("gpt-5.1"),
	tools: {
		saveProjectSectionsData: saveProjectSectionsDataTool,
		fetchProjectSection: fetchProjectSectionTool,
		updateProjectSectionMeta: updateProjectSectionMetaTool,
		deleteProjectSectionMetaKey: deleteProjectSectionMetaKeyTool,
		displayUserQuestions: displayUserQuestionsTool,
		navigateToPage: navigateToPageTool,
		generateResearchStructure: generateResearchStructureTool,
		manageDocuments: manageDocumentsTool,
		manageAnnotations: manageAnnotationsTool,
		webResearch: webResearchTool,
	},
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: { enabled: false, schema: ProjectSetupState },
			threads: { generateTitle: false },
		},
		processors: [new ToolCallPairProcessor(), new TokenLimiter(100_000)],
	}),
});
