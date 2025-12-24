import {
  index,
  prefix,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  ...prefix("organizations", [
    index("./features/organizations/pages/index.tsx"),
    route("new", "./features/organizations/pages/new.tsx"),
    route(":organizationId", "./features/organizations/pages/detail.tsx"),
    route(":organizationId/edit", "./features/organizations/pages/edit.tsx"),
    route(
      ":organizationId/research",
      "./features/organizations/pages/research.tsx",
    ),
  ]),
] satisfies RouteConfig;
