import { index, type RouteConfig, } from "@react-router/dev/routes"

export default [
	index("./features/marketing/pages/index.tsx"),
	// route("onboard", "./features/marketing/pages/onboard.tsx"),
	// route("contact", "./features/marketing/pages/contact.tsx"),
	// route("pricing", "./features/marketing/pages/pricing.tsx"),
] satisfies RouteConfig
