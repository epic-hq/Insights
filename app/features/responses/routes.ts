import { index, prefix, type RouteConfig } from "@react-router/dev/routes";

export default [...prefix("responses", [index("./features/responses/pages/index.tsx")])] satisfies RouteConfig;
