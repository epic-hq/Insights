import { index, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	index("./features/marketing/pages/index.tsx"),
	route("/about", "./features/marketing/pages/about.tsx"),
	route("index2", "./features/marketing/pages/index2.tsx"),
	// route("contact", "./features/marketing/pages/contact.tsx"),
	// route("pricing", "./features/marketing/pages/pricing.tsx"),
] satisfies RouteConfig
