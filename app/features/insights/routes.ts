import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("insights", [
		index("./features/insights/pages/index.tsx"),
		route("map", "./features/insights/pages/map.tsx"),
		route("auto", "./features/insights/pages/auto-insights.tsx"),
		route("new", "./features/insights/pages/new.tsx"),
		route(":insightId", "./features/insights/pages/insightDetail.tsx"),
		route(":insightId/edit", "./features/insights/pages/edit.tsx"),
		route("api/update-field", "./features/insights/api/update-field.tsx"),
	]),
] satisfies RouteConfig
