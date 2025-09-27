import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"
export const teamsApiRoutes = [] satisfies RouteConfig

export const teamsAccountRoutes = [
	// Account-scoped team management under /a/:accountId
	// Note: parent account route is defined in app/routes.ts
	// This child path will be appended inside that layout
	// e.g. /a/:accountId/team/manage
	route("team/manage", "./features/teams/pages/manage-members.tsx"),
] satisfies RouteConfig

export default [...prefix("/teams", [index("./features/teams/pages/list.tsx")])] satisfies RouteConfig
