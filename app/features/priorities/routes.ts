import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	...prefix("priorities", [
		index("./features/priorities/pages/index.tsx"),
		route(":taskId", "./features/priorities/pages/detail.tsx"),
	]),
] satisfies RouteConfig;
