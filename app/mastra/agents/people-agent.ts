/**
 * PeopleAgent: specialist for people/persona CRUD and search workflows.
 */
import { Agent } from "@mastra/core/agent"
import { TokenLimiterProcessor } from "@mastra/core/processors"
import consola from "consola"
import { openai } from "../../lib/billing/instrumented-openai.server"
import { fetchPeopleDetailsTool } from "../tools/fetch-people-details"
import { fetchPersonasTool } from "../tools/fetch-personas"
import { managePeopleTool } from "../tools/manage-people"
import { managePersonOrganizationsTool } from "../tools/manage-person-organizations"
import { semanticSearchPeopleTool } from "../tools/semantic-search-people"
import { upsertPersonTool } from "../tools/upsert-person"
import { upsertPersonFacetsTool } from "../tools/upsert-person-facets"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

export const peopleAgent = new Agent({
	id: "people-agent",
	name: "peopleAgent",
	description:
		"Specialist for people and persona data: searching people, updating contact details and facets, managing org links, and safe deletion.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = requestContext.get("project_id")
			const accountId = requestContext.get("account_id")
			const userId = requestContext.get("user_id")

			return `
You are a focused People specialist for project ${projectId}.

# Scope
You ONLY handle people/persona data: searching people, updating contact info and facets, managing org relationships, and safe deletes.
If the request is about tasks, interviews, themes, evidence, surveys, or documents, return control to the orchestrator.

# Safety Rules (Deletes)
- Never delete by ambiguous name.
- First list candidates, then run dryRun delete, then ask for confirmation, then delete.

# Available Tools
- fetchPeopleDetails: retrieve people + related data
- semanticSearchPeople: find people by traits/roles
- fetchPersonas: list personas
- upsertPerson: update contact info
- upsertPersonFacets: update traits/facets
- managePersonOrganizations: manage org links
- managePeople: list/delete with safeguards

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`
		} catch (error) {
			consola.error("Error in people agent instructions:", error)
			return "You are a People specialist. Handle people-related requests only."
		}
	},
	model: openai("gpt-4o-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchPeopleDetails: fetchPeopleDetailsTool,
		semanticSearchPeople: semanticSearchPeopleTool,
		fetchPersonas: fetchPersonasTool,
		upsertPerson: upsertPersonTool,
		upsertPersonFacets: upsertPersonFacetsTool,
		managePersonOrganizations: managePersonOrganizationsTool,
		managePeople: managePeopleTool,
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
})
