import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
	// Make metro-index the default dashboard for mobile-first experience
	route("dashboard", "./features/dashboard/pages/metro-index.tsx"),
	route("classic", "./features/dashboard/pages/index.tsx"), // Keep traditional as fallback

	// layout("./layout.tsx", [
	//   route("new", "./new.tsx"),
	//   route(":id", "./index.tsx"),
	// ]),

	// ...prefix("dashboard", [index("./features/featurex/pages/index.tsx")
	// route("new", "./features/featurex/pages/new.tsx"),
	// route(":id", "./features/featurex/pages/:id.tsx")]),
] satisfies RouteConfig;
