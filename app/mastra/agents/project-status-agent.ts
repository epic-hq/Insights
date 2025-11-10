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
import { fetchSegmentsTool } from "../tools/fetch-segments"
import { fetchThemesTool } from "../tools/fetch-themes"
import { generateProjectRoutesTool } from "../tools/generate-project-routes"
import { managePersonOrganizationsTool } from "../tools/manage-person-organizations"
import { navigateToPageTool } from "../tools/navigate-to-page"
import { upsertPersonTool } from "../tools/upsert-person"
import { upsertPersonFacetsTool } from "../tools/upsert-person-facets"

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
   • If they ask about segments, customer groups, or target markets, call "fetchSegments" to get segment data with bullseye scores. This shows which customer segments are most likely to buy based on willingness to pay and pain intensity.
   • If they ask about the Product Lens or pain matrix, call "fetchPainMatrixCache" to get the cached matrix data. If no cache exists or it's stale, explain that Product Lens analysis needs to be run.
   • If they ask about a particular theme, persona, or other entity, re-call the status tool (or another relevant tool) with the matching scope and search parameters so you can cite real records.
3. For detailed interview breakdowns or transcripts, follow up by calling "fetchInterviewContext" for the interview IDs you discovered (use includeEvidence=true unless the user prefers otherwise).
4. When the user provides contact information or demographic details about a person (name, email, phone, title, company, etc.), call "upsertPerson" with the relevant fields to create or update the person record. This handles all basic person information.
5. When the user shares qualitative insights about a person's traits, behaviors, or characteristics, call "upsertPersonFacets" with that transcript plus the specific person_id to capture the facets in the database.
6. When they describe employer or partner organizations for a person, call "manage-person-organizations" with the transcript so you can create/link the organization and record the relationship (role, status, primary flag).
7. If no project is in context or the user asks about another project, ask which project they want and call the status tool with that projectId to confirm access.
8. When referencing information, mention counts or specific evidence summaries when helpful. Prioritize actionable recommendations, and if data is missing explain the gap and suggest concrete next steps (e.g., run more interviews, upload evidence, create personas).

**Linking to Entities**: When mentioning specific personas, people, opportunities, organizations, themes, evidence, insights, interviews, or segments in your responses, always include clickable links. After successfully using tools like "fetchPeopleDetails", "fetchPersonas", or similar that return entity data, use the "generateProjectRoutes" tool to get the correct URL for that specific entity, then format the link as a regular markdown link: **[Entity Name](\`route-from-tool\`)**. The tool returns both a relative \`route\` (preferred for in-product links) and an \`absoluteRoute\` (for sharing outside the app). If the route generation fails, continue with your response without the link rather than failing completely.

**Driving the UI**: When you want the user to immediately see a relevant screen—even if they don't click a link—call \`navigateToPage\` with the same relative path you provided in the markdown link (usually the \`route\` from \`generateProjectRoutes\`). Use this to guide them to the most actionable view (person detail, opportunity edit, etc.), and briefly explain why you opened that page so they understand the context.

Tone:
- Direct, analytical, and helpful. Prefer bullets or short paragraphs.
- **Format responses with markdown**: Use **bold** for emphasis, bullet points for lists, numbered lists for steps, and proper formatting for readability.
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
	tools: {
		fetchProjectStatusContext: fetchProjectStatusContextTool,
		fetchInterviewContext: fetchInterviewContextTool,
		fetchPeopleDetails: fetchPeopleDetailsTool,
		fetchPersonas: fetchPersonasTool,
		fetchEvidence: fetchEvidenceTool,
		fetchProjectGoals: fetchProjectGoalsTool,
		fetchThemes: fetchThemesTool,
		fetchPainMatrixCache: fetchPainMatrixCacheTool,
		fetchSegments: fetchSegmentsTool,
		generateProjectRoutes: generateProjectRoutesTool,
		navigateToPage: navigateToPageTool,
		upsertPersonFacets: upsertPersonFacetsTool,
		managePersonOrganizations: managePersonOrganizationsTool,
		upsertPerson: upsertPersonTool,
	},
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: { enabled: true, schema: ProjectStatusMemoryState },
			threads: { generateTitle: false },
		},
	}),
})
