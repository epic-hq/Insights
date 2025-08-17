import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("interviews", [
		route("onboard", "./features/interviews/pages/onboard.tsx"),
		index("./features/interviews/pages/index.tsx"),
		route("new", "./features/interviews/pages/new.tsx"),
		route("/:interviewId", "./features/interviews/pages/detail.tsx"),
		route("/:interviewId/edit", "./features/interviews/pages/edit.tsx"),
	]),
] satisfies RouteConfig
