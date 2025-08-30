import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	route("/signup-chat", "./features/signup-chat/pages/signup-chat.tsx"),
	...prefix("aichat", [layout("./features/signup-chat/layout.tsx", [index("./features/signup-chat/pages/chat.tsx")])]),
] satisfies RouteConfig
