import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("users", [
		index("./features/users/pages/index.tsx"),
		route(":userId", "./features/users/pages/profile.tsx"),
		route(":userId/edit", "./features/users/pages/edit.tsx"),
	]),
] satisfies RouteConfig
