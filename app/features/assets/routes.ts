import { prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [...prefix("assets", [route("/:assetId", "./features/assets/pages/detail.tsx")])] satisfies RouteConfig;
