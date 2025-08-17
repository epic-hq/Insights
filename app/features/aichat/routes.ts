import { index, layout, prefix, type RouteConfig } from "@react-router/dev/routes"

export default [
	...prefix("aichat", [layout("./features/aichat/layout.tsx", [index("./features/aichat/pages/chat.tsx")])]),
] satisfies RouteConfig
