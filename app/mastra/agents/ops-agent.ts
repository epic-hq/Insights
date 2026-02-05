/**
 * OpsAgent: specialist for sales pipeline and organization ops.
 */
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import consola from "consola"
import { openai } from "../../lib/billing/instrumented-openai.server"
import { manageAnnotationsTool } from "../tools/manage-annotations"
import { createOpportunityTool, fetchOpportunitiesTool, updateOpportunityTool } from "../tools/manage-opportunities"
import { researchOrganizationTool } from "../tools/research-organization"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

export const opsAgent = new Agent({
	id: "ops-agent",
	name: "opsAgent",
	description:
		"Specialist for sales pipeline ops: opportunities, organization research/enrichment, and related annotations.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = requestContext.get("project_id")
			const accountId = requestContext.get("account_id")
			const userId = requestContext.get("user_id")

			return `
You are a focused Ops specialist for project ${projectId}.

# Scope
You handle opportunities, organization research/enrichment, and annotations.
If the request is about interviews, surveys, people, tasks, or documents, return control to the orchestrator.

# Opportunities
- ALWAYS call fetchOpportunities first for any question about closing, pipeline status, or deal guidance.
- Use responseFormat="concise" unless the user asks for full details.
- If no matching opportunities are found, say so and ask which opportunity to focus on. Do not give generic sales advice unless the user explicitly asks for general guidance.
- When giving guidance, cite specific opportunities (stage, amount, close date) and include links.
- Provide at most 2-3 specific suggestions.
- Use createOpportunity/updateOpportunity for pipeline changes.

# Organizations
- Use researchOrganization when user requests company research or enrichment.
- Prefer internal evidence first; use external research only when needed.

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`
		} catch (error) {
			consola.error("Error in ops agent instructions:", error)
			return "You are an Ops specialist for opportunities and organizations."
		}
	},
	model: openai("gpt-4o-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchOpportunities: fetchOpportunitiesTool,
		createOpportunity: createOpportunityTool,
		updateOpportunity: updateOpportunityTool,
		researchOrganization: researchOrganizationTool,
		manageAnnotations: manageAnnotationsTool,
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
})
