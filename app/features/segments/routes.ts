import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	...prefix("segments", [
		index("./features/segments/pages/index.tsx"),
		route(":segmentId", "./features/segments/pages/detail.tsx"),
	]),
] satisfies RouteConfig;
