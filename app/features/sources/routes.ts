import { index, prefix, type RouteConfig } from "@react-router/dev/routes";

export default [
  ...prefix("sources", [index("./features/sources/pages/index.tsx")]),
] satisfies RouteConfig;
