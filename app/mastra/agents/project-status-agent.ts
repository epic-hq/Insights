import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import consola from "consola"
import { z } from "zod"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { fetchEvidenceTool } from "../tools/fetch-evidence"
import { fetchInterviewContextTool } from "../tools/fetch-interview-context"
import { fetchPainMatrixCacheTool } from "../tools/fetch-pain-matrix-cache"
import { fetchPeopleDetailsTool } from "../tools/fetch-people-details"
import { fetchPersonasTool } from "../tools/fetch-personas"
import { fetchProjectGoalsTool } from "../tools/fetch-project-goals"
import { fetchProjectStatusContextTool } from "../tools/fetch-project-status-context"
import { fetchThemesTool } from "../tools/fetch-themes"

const ProjectStatusMemoryState = z.object({
	lastProjectId: z.string().optional(),
	lastSummary: z.string().optional(),
	lastUpdatedAt: z.string().optional(),
})

export const projectStatusAgent = new Agent({
	name: "projectStatusAgent",
	instructions: async ({ runtimeContext }) => {
		try {
			const projectId = runtimeContext.get("project_id")
			const accountId = runtimeContext.get("account_id")
			return `
You are a focused project status copilot that helps product teams understand traction, customer discovery, and sales fit.

Goals:
- Give concise, pointed answers (1-4 short sentences or bullet points).
- Highlight the most relevant findings, assumptions, unknowns, and next steps for product-market fit, customer discovery, or sales qualification.
- Always ground answers in the latest project data: insights, evidence, themes, people, personas, and research questions.

Workflow:
1. Call the "fetchProjectStatusContext" tool before answering to load the current project's data. Use project_id=${projectId || "<unknown>"} and account_id=${accountId || "<unknown>"} from the runtime context. Specify the scopes you need and adjust limits (e.g., evidenceLimit/insightLimit/interviewLimit) so you have enough detail to answer the question.
2. Parse the user's request:
   • If they name or clearly refer to a specific person, immediately call "fetchPeopleDetails" with peopleSearch set to that name and includePersonas/includeEvidence=true to get comprehensive person details, demographics, and interview history. Use the returned data to ground your answer, or ask for clarification if the person cannot be found.
   • If they ask about a particular theme, persona, or other entity, re-call the status tool (or another relevant tool) with the matching scope and search parameters so you can cite real records.
3. For detailed interview breakdowns or transcripts, follow up by calling "fetchInterviewContext" for the interview IDs you discovered (use includeEvidence=true unless the user prefers otherwise).
4. If no project is in context or the user asks about another project, ask which project they want and call the status tool with that projectId to confirm access.
5. When referencing information, mention counts or specific evidence summaries when helpful. Prioritize actionable recommendations, and if data is missing explain the gap and suggest concrete next steps (e.g., run more interviews, upload evidence, create personas).

Tone:
- Direct, analytical, and helpful. Prefer bullets or short paragraphs.
- Ask clarifying questions when needed to avoid assumptions.
`
		} catch (error) {
			consola.error("Error in project status agent instructions:", error)
			return `
I apologize, but I'm experiencing technical difficulties loading the project context. This might be due to missing project information or a temporary system issue.

Please try:
1. Ensuring you're working within a valid project context
2. Refreshing the page and trying again
3. Contacting support if the issue persists

I recommend checking your project settings or trying a simpler query to help diagnose the issue.`
		}
	},
	model: openai("gpt-4.1"),
	processors: [], // Disable PII detection to allow people data with personal information
	tools: {
		fetchProjectStatusContext: fetchProjectStatusContextTool,
		fetchInterviewContext: fetchInterviewContextTool,
		fetchPeopleDetails: fetchPeopleDetailsTool,
		fetchPersonas: fetchPersonasTool,
		fetchEvidence: fetchEvidenceTool,
		fetchProjectGoals: fetchProjectGoalsTool,
		fetchThemes: fetchThemesTool,
		fetchPainMatrixCache: fetchPainMatrixCacheTool,
	},
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: { enabled: true, schema: ProjectStatusMemoryState },
			threads: { generateTitle: false },
		},
	}),
})
