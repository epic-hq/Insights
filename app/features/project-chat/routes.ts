import { route } from "@react-router/dev/routes";

export default [
	route("project-chat", "./features/project-chat/pages/chat.tsx"),
	route("assistant", "./features/project-chat/pages/status-agent.tsx"),
];
