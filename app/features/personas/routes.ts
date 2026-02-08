import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	...prefix("personas", [
		index("./features/personas/pages/index.tsx"),
		route("new", "./features/personas/pages/new.tsx"),
		route(":personaId", "./features/personas/pages/personaDetail.tsx"),
		route(":personaId/edit", "./features/personas/pages/edit.tsx"),
		// API routes with project context
		route("api/generate-personas", "./features/personas/api/generate-personas.tsx"),
		route(":personaId/interviews/:interviewId", "./features/personas/pages/interview.tsx"),
		route("mock1", "./features/personas/components/persona_visualization_mockup1.tsx"),
		route("wip", "./features/personas/components/persona_visualization_mockup2.tsx"),
		route(":personaId/wipdetail", "./features/personas/pages/personaDetail_wip.tsx"),
		route("mock3", "./features/personas/components/persona_visualization_mockup3.tsx"),
		route("mock4", "./features/personas/components/persona_visualization_mockup4.tsx"),
		route("mock5", "./features/personas/components/persona_visualization_mockup5.tsx"),
		route("mock6", "./features/personas/components/persona_spectrum_db.tsx"),
	]),
] satisfies RouteConfig;
