import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	...prefix("evidence", [
		index("./features/evidence/pages/index.tsx"),
		route(":evidenceId", "./features/evidence/pages/evidenceDetail.tsx"),
	]),
	// API route for fetching evidence data (used by EvidenceModal)
	route("api/evidence/:evidenceId", "./features/evidence/api/get-evidence.tsx"),
] satisfies RouteConfig;
