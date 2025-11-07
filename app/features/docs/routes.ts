import { index, prefix, route } from "@react-router/dev/routes"

export default [
	...prefix("docs", [
		index("./features/docs/pages/index.tsx"),
		route("getting-started", "./features/docs/pages/getting-started.tsx"),
		route("research-workflow", "./features/docs/pages/research-workflow.tsx"),
		route("analyzing-insights", "./features/docs/pages/analyzing-insights.tsx"),
		route("conversation-lenses", "./features/docs/pages/conversation-lenses.tsx"),
		route("product-lens", "./features/docs/pages/product-lens.tsx"),
	]),
]
