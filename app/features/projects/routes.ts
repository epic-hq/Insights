import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("projects", [
		index("./features/projects/pages/index.tsx"),
		route("new", "./features/projects/pages/new.tsx"),
		route(":projectId", "./features/projects/pages/projectDetail.tsx"),
	]),
] satisfies RouteConfig
