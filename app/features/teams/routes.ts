import { index, prefix, type RouteConfig } from "@react-router/dev/routes";

export const teamsApiRoutes = [

] satisfies RouteConfig

export const teamsAccountRoutes = [

] satisfies RouteConfig

export default [
	...prefix("/teams", [
		index("./features/teams/pages/list.tsx"),
	])
] satisfies RouteConfig