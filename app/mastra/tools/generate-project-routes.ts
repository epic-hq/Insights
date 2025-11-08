import { createTool } from "@mastra/core/tools"
import { PRODUCTION_HOST } from "~/paths"
import { createRouteDefinitions } from "~/utils/route-definitions"

/**
 * Tool to generate project-scoped routes for linking to entities in AI responses
 */
export const generateProjectRoutesTool = createTool({
	id: "generate-project-routes",
	description:
		"Generate URLs for project entities like personas, people, opportunities, etc. Use this to create clickable links in responses.",
	inputSchema: {
		type: "object",
		properties: {
			entityType: {
				type: "string",
				enum: [
					"persona",
					"person",
					"opportunity",
					"organization",
					"theme",
					"evidence",
					"insight",
					"interview",
					"segment",
				],
				description: "The type of entity to generate a route for",
			},
			entityId: {
				type: "string",
				description: "The ID of the entity",
			},
			action: {
				type: "string",
				enum: ["detail", "edit"],
				default: "detail",
				description: "The action/route type to generate (detail page or edit page)",
			},
		},
		required: ["entityType", "entityId"],
	},
	outputSchema: {
		type: "object",
		properties: {
			success: {
				type: "boolean",
				description: "Whether the route generation was successful",
			},
			route: {
				type: "string",
				nullable: true,
				description: "The generated route",
			},
			entityType: {
				type: "string",
				optional: true,
				description: "The type of entity to generate a route for",
			},
			entityId: {
				type: "string",
				optional: true,
				description: "The ID of the entity",
			},
			action: {
				type: "string",
				optional: true,
				description: "The action/route type to generate (detail page or edit page)",
			},
			error: {
				type: "string",
				optional: true,
				description: "Error message if route generation failed",
			},
		},
	},
	execute: async ({ context, runtimeContext }) => {
		const { entityType, entityId, action = "detail" } = context || {}

		// Validate required parameters
		if (!entityType || !entityId) {
			console.warn("generate-project-routes: Missing required parameters", { entityType, entityId, action })
			return {
				success: false,
				error: "Missing required parameters: entityType and entityId are required",
				route: null,
			}
		}

		// Get accountId and projectId from runtime context
		const accountId = runtimeContext?.get?.("account_id") as string
		const projectId = runtimeContext?.get?.("project_id") as string

		if (!accountId || !projectId) {
			console.warn("generate-project-routes: Missing runtime context", { accountId, projectId })
			return {
				success: false,
				error: "Missing accountId or projectId in runtime context",
				route: null,
			}
		}

		try {
			// Use existing route definitions from shared codebase
			const projectPath = `/a/${accountId}/${projectId}`
			const routes = createRouteDefinitions(projectPath)

			let route: string

			switch (entityType) {
				case "persona":
					route = action === "edit" ? routes.personas.edit(entityId) : routes.personas.detail(entityId)
					break
				case "person":
					route = action === "edit" ? routes.people.edit(entityId) : routes.people.detail(entityId)
					break
				case "opportunity":
					route = action === "edit" ? routes.opportunities.edit(entityId) : routes.opportunities.detail(entityId)
					break
				case "organization":
					route = action === "edit" ? routes.organizations.edit(entityId) : routes.organizations.detail(entityId)
					break
				case "theme":
					route = action === "edit" ? routes.themes.edit(entityId) : routes.themes.detail(entityId)
					break
				case "evidence":
					route = action === "edit" ? routes.evidence.edit(entityId) : routes.evidence.detail(entityId)
					break
				case "insight":
					route = action === "edit" ? routes.insights.edit(entityId) : routes.insights.detail(entityId)
					break
				case "interview":
					route = action === "edit" ? routes.interviews.edit(entityId) : routes.interviews.detail(entityId)
					break
				case "segment":
					route = routes.segments.detail(entityId) // segments don't have edit
					break
				default:
					return {
						success: false,
						error: `Unknown entity type: ${entityType}`,
						route: null,
					}
			}

			return {
				success: true,
				route: `${PRODUCTION_HOST}${route}`,
				entityType,
				entityId,
				action,
			}
		} catch (error) {
			console.error("generate-project-routes: Unexpected error", error)
			return {
				success: false,
				error: "Unexpected error generating route",
				route: null,
			}
		}
	},
})
