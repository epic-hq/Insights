import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("opportunities", [
		index("./features/opportunities/pages/index.tsx"),
		route("new", "./features/opportunities/pages/new.tsx"),
		route(":opportunityId", "./features/opportunities/pages/opportunityDetail.tsx"),
		route(":opportunityId/edit", "./features/opportunities/pages/edit.tsx"),
	]),
] satisfies RouteConfig
