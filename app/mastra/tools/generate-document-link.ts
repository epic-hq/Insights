import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { HOST } from "../../paths";

/**
 * Generate a shareable link for project documents stored in project_sections.
 * We don't have a dedicated document detail page, so we link to the project edit page
 * with query params to highlight the section.
 */
export const generateDocumentLinkTool = createTool({
	id: "generate-document-link",
	description: "Build a link to a project document (project_sections) using the section ID and kind.",
	inputSchema: z.object({
		sectionId: z.string().min(1),
		kind: z.string().min(1),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		route: z.string().nullable(),
		absoluteRoute: z.string().nullable(),
		error: z.string().nullable(),
	}),
	execute: async (input, context?) => {
		const accountId = context?.requestContext?.get?.("account_id") as string;
		const projectId = context?.requestContext?.get?.("project_id") as string;
		const { sectionId, kind } = input || {};

		if (!accountId || !projectId) {
			return { success: false, route: null, absoluteRoute: null, error: "Missing accountId or projectId in context" };
		}
		if (!sectionId || !kind) {
			return { success: false, route: null, absoluteRoute: null, error: "Missing sectionId or kind" };
		}

		// Route to the project edit page with query params to locate the document
		const route = `/a/${accountId}/${projectId}/edit?document=${encodeURIComponent(kind)}&sectionId=${encodeURIComponent(sectionId)}`;
		const absoluteRoute = `${HOST}${route}`;
		return { success: true, route, absoluteRoute, error: null };
	},
});
