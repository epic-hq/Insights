import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
	route("facets", "./features/facets/pages/index.tsx"),
	route("facets/explorer", "./features/facets/pages/explorer.tsx"),
] satisfies RouteConfig;
