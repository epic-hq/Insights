import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("research-links", [
		index("./features/research-links/pages/index.tsx"),
		// New stepper-based create wizard (replaces old form)
		route("new", "./features/research-links/pages/create.tsx"),
		// Keep old form at /new-advanced for power users
		route("new-advanced", "./features/research-links/pages/new.tsx"),
		route(":listId/edit", "./features/research-links/pages/edit.$listId.tsx"),
		route(":listId/responses", "./features/research-links/pages/responses.$listId.tsx"),
		// API routes
		route("api/generate-questions", "./features/research-links/api/generate-questions.tsx"),
		route("api/generate-from-voice", "./features/research-links/api/generate-from-voice.tsx"),
		route("api/suggest-surveys", "./features/research-links/api/suggest-surveys.tsx"),
	]),
] satisfies RouteConfig
