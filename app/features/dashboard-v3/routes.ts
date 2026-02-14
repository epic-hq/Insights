import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
	// V3 dashboard route
	route("dashboard-v3", "./features/dashboard-v3/pages/index.tsx"),
] satisfies RouteConfig;
