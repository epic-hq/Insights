import { type RouteConfig, route } from "@react-router/dev/routes";

const annotationsRoutes = [
	// API routes for annotations system
	route("api/annotations", "./features/annotations/api/annotations.tsx"),
	route("api/votes", "./features/annotations/api/votes.tsx"),
	route("api/entity-flags", "./features/annotations/api/entity-flags.tsx"),
] satisfies RouteConfig;

export default annotationsRoutes;
