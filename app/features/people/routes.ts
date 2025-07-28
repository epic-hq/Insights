import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("people", [
		index("./features/people/pages/index.tsx"),
		route("new", "./features/people/pages/new.tsx"),
		route(":personId", "./features/people/pages/detail.tsx"),
		route(":personId/edit", "./features/people/pages/edit.tsx"),
	]),
] satisfies RouteConfig
