import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("personas", [
		index("./features/personas/pages/index.tsx"),
		route("new", "./features/personas/pages/new.tsx"),
		route(":personaId", "./features/personas/pages/personaDetail.tsx"),
		route(":personaId/edit", "./features/personas/pages/edit.tsx"),
		route(":personaId/interviews/:interviewId", "./features/personas/pages/interview.tsx"),
	]),
] satisfies RouteConfig