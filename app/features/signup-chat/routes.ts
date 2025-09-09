import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	route("/signup-chat", "./features/signup-chat/pages/signup-chat.tsx"),
	route("/signup-chat/completed", "./features/signup-chat/pages/chat-completed.tsx"),
	route("/signup-chat/ai-sdk", "./features/signup-chat/pages/ai-sdk-chat.tsx"),
	route("api/chat/signup", "./features/signup-chat/api/signup-agent.tsx"),
	route("/signup-chat/assistant-ui", "./features/signup-chat/pages/assistant-ui-chat.tsx"),
	...prefix("aichat", [layout("./features/signup-chat/layout.tsx", [index("./features/signup-chat/pages/chat.tsx")])]),
] satisfies RouteConfig
