import { index, prefix, type RouteConfig, } from "@react-router/dev/routes"

export default [...prefix("aichat", [index("./features/aichat/pages/index.tsx")])] satisfies RouteConfig
