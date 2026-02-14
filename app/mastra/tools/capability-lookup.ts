import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { HOST } from "../../paths";
import { createRouteDefinitions } from "../../utils/route-definitions";

interface Capability {
	name: string;
	description: string;
	route?: (routes: ReturnType<typeof createRouteDefinitions>) => string;
}

const CAPABILITIES: Capability[] = [
	{
		name: "Surveys & Interviews",
		description: "Create surveys/ask links, manage interview prompts, import transcripts and video recordings.",
		route: (routes) => routes.ask.index(),
	},
	{
		name: "Evidence & Themes",
		description: "Search quotes, themes, pain matrices, and conversation lenses across all your interviews.",
		route: (routes) => routes.insights.index(),
	},
	{
		name: "People & Orgs",
		description: "Look up, update, and import people, personas, and organizations.",
		route: (routes) => routes.people.index(),
	},
	{
		name: "Documents",
		description: "Create and manage project documents (positioning, competitive analysis, meeting notes).",
		route: (routes) => routes.sources.index(),
	},
	{
		name: "Tasks & Pipeline",
		description: "Create tasks, manage opportunities, and track follow-ups.",
		route: (routes) => routes.tasks.index(),
	},
	{
		name: "Web Research",
		description: "Fetch URLs, run web research, and import video content when internal data isn't enough.",
	},
];

export const capabilityLookupTool = createTool({
	id: "capability-lookup",
	description:
		"Return a concise list of this agent's capabilities. Use when the user asks 'what can you do' or when clarifying scope. Present the returned summary directly — do NOT add extra sections, templates, or coaching language.",
	inputSchema: z.object({
		query: z.string().nullish().describe("Optional filter string to narrow the capability list."),
	}),
	outputSchema: z.object({
		summary: z.string(),
	}),
	execute: async (input, context?) => {
		const { query } = input;
		const normalized = query?.toLowerCase().trim();
		const filtered = CAPABILITIES.filter((cap) =>
			!normalized
				? true
				: cap.name.toLowerCase().includes(normalized) || cap.description.toLowerCase().includes(normalized)
		);

		const accountId = context?.requestContext?.get?.("account_id") as string | undefined;
		const projectId = context?.requestContext?.get?.("project_id") as string | undefined;
		const routes = accountId && projectId ? createRouteDefinitions(`/a/${accountId}/${projectId}`) : null;

		consola.debug("capability-lookup", {
			query,
			resultCount: filtered.length,
		});

		const lines = filtered.map((cap) => {
			const link = cap.route && routes ? ` → [Open](${HOST}${cap.route(routes)})` : "";
			return `- **${cap.name}**: ${cap.description}${link}`;
		});
		return {
			summary: `I can help with:\n${lines.join("\n")}\n\nJust ask — I'll use the right tools automatically.`,
		};
	},
});
