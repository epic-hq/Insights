/**
 * PeopleAgent: specialist for people/persona CRUD and search workflows.
 */
import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import consola from "consola";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { getSharedPostgresStore } from "../storage/postgres-singleton";
import { fetchPeopleDetailsTool } from "../tools/fetch-people-details";
import { fetchPersonasTool } from "../tools/fetch-personas";
import { generateProjectRoutesTool } from "../tools/generate-project-routes";
import { importPeopleFromTableTool } from "../tools/import-people-from-table";
import { managePeopleTool } from "../tools/manage-people";
import { managePersonOrganizationsTool } from "../tools/manage-person-organizations";
import { navigateToPageTool } from "../tools/navigate-to-page";
import { requestUserInputTool } from "../tools/request-user-input";
import { semanticSearchPeopleTool } from "../tools/semantic-search-people";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";
import { upsertPersonTool } from "../tools/upsert-person";
import { upsertPersonFacetsTool } from "../tools/upsert-person-facets";

export const peopleAgent = new Agent({
	id: "people-agent",
	name: "peopleAgent",
	description:
		"Specialist for people and persona data: searching people, updating contact details and facets, managing org links, and safe deletion.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = requestContext.get("project_id");
			const accountId = requestContext.get("account_id");
			const userId = requestContext.get("user_id");

			return `
You are a focused People specialist for project ${projectId}.

# Scope
You ONLY handle people/persona data: searching people, updating contact info and facets, managing org relationships, and safe deletes.
If the request is about tasks, interviews, themes, evidence, surveys, or documents, return control to the orchestrator.

# Safety Rules (Deletes)
- Follow this sequence:
  1. Search for the person (fetchPeopleDetails or semanticSearchPeople)
  2. If not found, tell the user clearly. Do NOT claim deletion succeeded.
  3. If found and the match is clear (user asked by name, one result matches): execute the delete immediately with managePeople(action="delete", dryRun=false, force=true, confirmName=personName). The user already asked for deletion — that is the confirmation.
  4. If the match is AMBIGUOUS (multiple results, or name doesn't closely match what user asked): list the candidates and ask which one(s) to delete using requestUserInput.
- NEVER claim a delete happened without actually executing managePeople with dryRun=false.
- NEVER do a dry run when the user has clearly identified who to delete. Just delete it.

# Linking & Navigation
- When returning people results, format every person reference as \`[Person Name](url)\` markdown link.
- Tools like fetchPeopleDetails return \`url\` fields — use them directly.
- For entities without tool URLs, call generateProjectRoutes with entityType='person' and the personId.
- Also link personas and organizations when referenced.

# Available Tools
- fetchPeopleDetails: retrieve people + related data
- semanticSearchPeople: find people by traits/roles
- fetchPersonas: list personas
- importPeopleFromTable: import contact spreadsheets into people/org records
- upsertPerson: update contact info
- upsertPersonFacets: update traits/facets
- managePersonOrganizations: manage org links
- managePeople: list/delete with safeguards
- requestUserInput: ask user for confirmation (REQUIRED before ambiguous destructive actions)
- navigateToPage: navigate user's browser to refresh a page after mutations
- generateProjectRoutes: generate URLs for any entity type

# After Mutations
After any create, update, or delete operation, call navigateToPage to refresh the relevant page (e.g., the People list) so the UI reflects the change.

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`;
		} catch (error) {
			consola.error("Error in people agent instructions:", error);
			return "You are a People specialist. Handle people-related requests only.";
		}
	},
	model: openai("gpt-4o-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchPeopleDetails: fetchPeopleDetailsTool,
		semanticSearchPeople: semanticSearchPeopleTool,
		fetchPersonas: fetchPersonasTool,
		importPeopleFromTable: importPeopleFromTableTool,
		upsertPerson: upsertPersonTool,
		upsertPersonFacets: upsertPersonFacetsTool,
		managePersonOrganizations: managePersonOrganizationsTool,
		managePeople: managePeopleTool,
		requestUserInput: requestUserInputTool,
		navigateToPage: navigateToPageTool,
		generateProjectRoutes: generateProjectRoutesTool,
	}),
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			lastMessages: 20,
			observationalMemory: {
				model: "openai/gpt-4.1-mini",
			},
		},
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
});
