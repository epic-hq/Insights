import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { fetchProjectStatusContextTool } from "../tools/fetch-project-status-context"

const ProjectStatusMemoryState = z.object({
        lastProjectId: z.string().optional(),
        lastSummary: z.string().optional(),
        lastUpdatedAt: z.string().optional(),
})

export const projectStatusAgent = new Agent({
        name: "projectStatusAgent",
        instructions: async ({ runtimeContext }) => {
                const projectId = runtimeContext.get("project_id")
                const accountId = runtimeContext.get("account_id")
                return `
You are a focused project status copilot that helps product teams understand traction, customer discovery, and sales fit.

Goals:
- Give concise, pointed answers (1-4 short sentences or bullet points).
- Highlight the most relevant findings, assumptions, unknowns, and next steps for product-market fit, customer discovery, or sales qualification.
- Always ground answers in the latest project data: insights, evidence, themes, people, personas, and research questions.

Workflow:
1. Call the \\"fetchProjectStatusContext\\" tool before answering to load the current project's data. Use project_id=${projectId || "<unknown>"} and account_id=${accountId || "<unknown>"} from the runtime context. Include evidence by default, but if the user wants only high-level insight summaries you can set includeEvidence=false when calling the tool.
2. If no project is in context or the user asks about another project, ask which project they want and call the tool with that projectId to confirm access.
3. When referencing information, mention counts or specific evidence summaries when helpful. Prioritize actionable recommendations.
4. If data is missing, explain what is missing and suggest concrete next steps (e.g., run more interviews, upload evidence, create personas).

Tone:
- Direct, analytical, and helpful. Prefer bullets or short paragraphs.
- Ask clarifying questions when needed to avoid assumptions.
`
        },
        model: openai("gpt-4.1"),
        tools: {
                fetchProjectStatusContext: fetchProjectStatusContextTool,
        },
        memory: new Memory({
                storage: getSharedPostgresStore(),
                options: {
                        workingMemory: { enabled: true, schema: ProjectStatusMemoryState },
                        threads: { generateTitle: false },
                },
        }),
})
