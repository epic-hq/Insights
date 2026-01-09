/**
 * Ask routes - project-scoped shareable prompts for collecting responses
 * Reuses research-links pages but scoped to current project
 */
import { index, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	// /ask - list of Ask links for this project
	index("./features/research-links/pages/index.tsx"),
	// /ask/new - create new Ask link
	route("new", "./features/research-links/pages/create.tsx"),
	// /ask/:listId/edit - edit existing Ask link
	route(":listId/edit", "./features/research-links/pages/edit.$listId.tsx"),
	// /ask/:listId/responses - view responses
	route(":listId/responses", "./features/research-links/pages/responses.$listId.tsx"),
	// /ask/:listId/responses/:responseId - view single response detail
	route(":listId/responses/:responseId", "./features/research-links/pages/response-detail.$responseId.tsx"),
	// API routes
	route("api/generate-questions", "./features/research-links/api/generate-questions.tsx"),
	route("api/analyze-responses", "./features/research-links/api/analyze-responses.tsx"),
] satisfies RouteConfig
