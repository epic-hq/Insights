import { index, layout, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	index("./features/marketing/pages/index.tsx"),
	route("/about", "./features/marketing/pages/about.tsx"),
	route("/privacy", "./features/marketing/pages/privacy.tsx"),
	route("/terms", "./features/marketing/pages/terms.tsx"),
	route("index2", "./features/marketing/pages/index2.tsx"),
	route("customer-interviews", "./features/marketing/pages/customer-interviews.tsx"),

	// Blog and Case Studies with shared layout
	layout("./features/marketing/layouts/MarketingLayout.tsx", [
		route("blog", "./features/marketing/pages/blog/index.tsx"),
		route("blog/:blogId", "./features/marketing/pages/blog/[blogId].tsx"),
		route("case-studies", "./features/marketing/pages/case-studies/index.tsx"),
		route("case-studies/:caseStudyId", "./features/marketing/pages/case-studies/[caseStudyId].tsx"),
	]),

	// route("contact", "./features/marketing/pages/contact.tsx"),
	// route("pricing", "./features/marketing/pages/pricing.tsx"),
] satisfies RouteConfig
