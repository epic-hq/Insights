import { index, prefix, type RouteConfig } from "@react-router/dev/routes"

export default [
	...prefix("aichat", [
		index("./features/aichat/pages/chat.tsx"),
		// route("chat", "./features/aichat/pages/chat.tsx"),
	]),
] satisfies RouteConfig
