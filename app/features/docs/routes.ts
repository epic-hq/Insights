import { index, prefix, route } from "@react-router/dev/routes";

export default [
	...prefix("docs", [
		index("./features/docs/pages/index.tsx"),

		// Getting Started
		route("getting-started", "./features/docs/pages/getting-started.tsx"),
		route("research-workflow", "./features/docs/pages/research-workflow.tsx"),

		// CRM & People
		route("importing-people", "./features/docs/pages/importing-people.tsx"),
		route("crm-opportunities", "./features/docs/pages/crm-opportunities.tsx"),
		route("crm-quick-reference", "./features/docs/pages/crm-quick-reference.tsx"),

		// Surveys
		route("sending-surveys", "./features/docs/pages/sending-surveys.tsx"),
		route("survey-branching", "./features/docs/pages/survey-branching.tsx"),

		// Analysis
		route("analyzing-insights", "./features/docs/pages/analyzing-insights.tsx"),
		route("conversation-lenses", "./features/docs/pages/conversation-lenses.tsx"),
		route("product-lens", "./features/docs/pages/product-lens.tsx"),
	]),
];
