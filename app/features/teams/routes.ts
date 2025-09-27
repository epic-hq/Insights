import { index, prefix, RouteConfig } from "@react-router/dev/routes";

export default [
	...prefix("/teams", [
		index("./features/teams/pages/list.tsx"),
	])
] satisfies RouteConfig