import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
  ...prefix("themes", [
    index("./features/themes/pages/index.tsx"),
    route(":themeId", "./features/themes/pages/themeDetail.tsx"),
  ]),
] satisfies RouteConfig
