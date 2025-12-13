import { createTool } from "@mastra/core/tools"
import { HOST } from "~/paths"

/**
 * Generate a shareable link for project documents stored in project_sections.
 * We don't have a dedicated document detail page, so we link to the project edit page
 * with query params to highlight the section.
 */
export const generateDocumentLinkTool = createTool({
	id: "generate-document-link",
	description: "Build a link to a project document (project_sections) using the section ID and kind.",
	inputSchema: {
		type: "object",
		properties: {
			sectionId: { type: "string", description: "project_sections.id of the document" },
			kind: { type: "string", description: "Document kind (e.g., competitive_analysis)" },
		},
		required: ["sectionId", "kind"],
	},
	outputSchema: {
		type: "object",
		properties: {
			success: { type: "boolean" },
			route: { type: "string", nullable: true },
			absoluteRoute: { type: "string", nullable: true },
			error: { type: "string", nullable: true },
		},
	},
	execute: async ({ context, runtimeContext }) => {
		const accountId = runtimeContext?.get?.("account_id") as string
		const projectId = runtimeContext?.get?.("project_id") as string
		const { sectionId, kind } = context || {}

		if (!accountId || !projectId) {
			return { success: false, route: null, absoluteRoute: null, error: "Missing accountId or projectId in context" }
		}
		if (!sectionId || !kind) {
			return { success: false, route: null, absoluteRoute: null, error: "Missing sectionId or kind" }
		}

		// Route to the project edit page with query params to locate the document
		const route = `/a/${accountId}/${projectId}/edit?document=${encodeURIComponent(kind)}&sectionId=${encodeURIComponent(sectionId)}`
		const absoluteRoute = `${HOST}${route}`
		return { success: true, route, absoluteRoute, error: null }
	},
})
