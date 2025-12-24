import {
  index,
  prefix,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  ...prefix("people", [
    index("./features/people/pages/index.tsx"),
    route("new", "./features/people/pages/new.tsx"),
    route("api/infer-segments", "./features/people/api/infer-segments.tsx"),
    route("api/update-inline", "./features/people/api/update-inline.tsx"),
    route("api/deduplicate", "./features/people/api/deduplicate.tsx"),
    route(":personId", "./features/people/pages/detail.tsx"),
    route(":personId/edit", "./features/people/pages/edit.tsx"),
  ]),
] satisfies RouteConfig;
