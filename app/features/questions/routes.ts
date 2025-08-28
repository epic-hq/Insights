import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("questions", [
		index("./features/questions/pages/index.tsx")
	]),
] satisfies RouteConfig
