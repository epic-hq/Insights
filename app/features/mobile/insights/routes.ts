import { index, prefix, type RouteConfig } from "@react-router/dev/routes";

export default [...prefix("mobile", [index("./features/mobile/insights/pages/index.tsx")])] satisfies RouteConfig;
