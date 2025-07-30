import { type RouteConfig, route } from "@react-router/dev/routes"

export default [
	// index("./features/dashboard/pages/root.tsx"),
	route("dashboard", "./features/dashboard/pages/index.tsx"),

	// layout("./layout.tsx", [
	//   route("new", "./new.tsx"),
	//   route(":id", "./index.tsx"),
	// ]),

	// ...prefix("dashboard", [index("./features/featurex/pages/index.tsx")
	// route("new", "./features/featurex/pages/new.tsx"),
	// route(":id", "./features/featurex/pages/:id.tsx")]),
] satisfies RouteConfig
