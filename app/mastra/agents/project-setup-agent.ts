import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { PROJECT_SECTIONS } from "~/features/projects/section-config"
import { supabaseAdmin } from "~/lib/supabase/client.server"
// ToolCallPairProcessor is deprecated in v1 - tool call pairing is handled internally now
// import { ToolCallPairProcessor } from "../processors/tool-call-pair-processor"
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
import { researchCompanyWebsiteTool } from "../tools/research-company-website"
import { webResearchTool } from "../tools/research-web"
import { saveAccountCompanyContextTool } from "../tools/save-account-company-context"
import { saveProjectSectionsDataTool } from "../tools/save-project-sections-data"
import { suggestionTool } from "../tools/suggestion-tool"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

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
	id: "project-setup-agent",
	name: "projectSetupAgent",
	instructions: async ({ requestContext }) => {
		const projectId = requestContext.get("project_id")

		// Fetch existing project sections
		const { data: existing } = await supabaseAdmin
			.from("project_sections")
			.select("project_id, kind, meta, content_md")
			.eq("project_id", projectId)

		// Fetch project to get account_id
		const { data: project } = await supabaseAdmin.from("projects").select("account_id").eq("id", projectId).single()

		// Fetch account context (company info)
		let accountContext: Record<string, unknown> | null = null
		if (project?.account_id) {
			const { data: account } = await supabaseAdmin
				.from("accounts")
				.select("company_description, customer_problem, offerings, target_orgs, target_roles, competitors, website_url")
				.eq("id", project.account_id)
				.maybeSingle()

			accountContext = account
		}

		// Check if account has company context filled in
		const hasCompanyContext =
			accountContext &&
			(accountContext.company_description ||
				accountContext.customer_problem ||
				(Array.isArray(accountContext.offerings) && accountContext.offerings.length > 0))

		return `
You are a fast, efficient project setup assistant. Be BRIEF - 1-2 sentences max per response.

## Journey: Define > Design > Collect > Synthesize > Prioritize

${
	hasCompanyContext
		? `
## COMPANY CONTEXT ALREADY SET
The account already has company info. Skip company questions and focus on PROJECT goals.
Account context: ${JSON.stringify(accountContext)}

Start with: "What's the main thing you want to learn from this research?"
`
		: `
## COMPANY CONTEXT NEEDED
First collect company context (saved to account for reuse).

Start by asking: "What's your company website? I'll pull in context automatically."

WHEN USER SHARES A WEBSITE URL:
1. Call "researchCompanyWebsite" with the URL
2. If successful, IMMEDIATELY call "saveAccountCompanyContext" with project_id: "${projectId}" AND all extracted fields
3. Briefly confirm what you found: "Got it - [company] helps [target_orgs] with [customer_problem]. Moving on..."
4. Proceed directly to project goals - no need to ask for confirmation

IMPORTANT: Always include project_id when calling saveAccountCompanyContext!

If research fails or user prefers manual entry, ask these in order:
1) What does your company do? (company_description)
2) What problem do you solve? (customer_problem)
3) Who are your target customers? (target_orgs, target_roles)
`
}

## PROJECT GOALS (always collect)
${hasCompanyContext ? "Start here:" : "After company context:"}
1) Research goal (research_goal) - what do you want to learn?
2) What you need to learn (unknowns)
3) Key decisions to make (decision_questions)
4) Riskiest assumptions (assumptions)

## RULES
- Ask ONE question at a time, max 1-2 sentences
- Save each answer immediately via "saveProjectSectionsData"
- NEVER summarize or repeat - just move forward
- When all goals are done, call "generateResearchStructure"
- After generating, say "Done! Your research plan is ready."
- After each question, call "suggestNextSteps" with the EXACT examples you mentioned (e.g., if you asked about roles and mentioned "Director of Regulatory Affairs, Clinical Ops Manager", use those as suggestions)

## STYLE
- Ultra brief: "Got it. Next: [question]?"
- If vague, give 2-3 quick examples
- No bullets, no formatting unless needed
- No "Great!", "Perfect!" - just move forward

Document requests: Use manageDocuments tool.

Existing project sections (skip if answered):
${JSON.stringify(existing)}
`
	},
	model: openai("gpt-5.1"),
	tools: wrapToolsWithStatusEvents({
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
		researchCompanyWebsite: researchCompanyWebsiteTool,
		saveAccountCompanyContext: saveAccountCompanyContextTool,
		suggestNextSteps: suggestionTool,
	}),
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: { enabled: false, schema: ProjectSetupState },
		},
		generateTitle: false,
	}),
	// Note: Using number format for Zod v4 compatibility
	outputProcessors: [new TokenLimiterProcessor(100_000)],
})
