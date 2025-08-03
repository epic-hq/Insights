import { layout, type RouteConfig, route } from "@react-router/dev/routes"
import dashboardRoutes from "./features/dashboard/routes"
import homeRoutes from "./features/home/routes"
import insightsRoutes from "./features/insights/routes"
import interviewsRoutes from "./features/interviews/routes"
import marketingRoutes from "./features/marketing/routes"
import opportunitiesRoutes from "./features/opportunities/routes"
import peopleRoutes from "./features/people/routes"
import personasRoutes from "./features/personas/routes"
import projectsRoutes from "./features/projects/routes"

const routes = [
	...marketingRoutes,
	layout("./routes/_ProtectedLayout.tsx", [
		...homeRoutes,
		route("a/:accountId", "./routes/_protected/accounts.tsx", [
			route(":projectId", "./routes/_protected/projects.tsx", [
				...dashboardRoutes,
				...interviewsRoutes,
				...insightsRoutes,
				...opportunitiesRoutes,
				...peopleRoutes,
				...personasRoutes,
				...projectsRoutes,
			]),
		]),
	]),
	route("api/upload-file", "./routes/api.upload-file.tsx"),
	route("api/generate-persona-insights", "./routes/api.generate-persona-insights.tsx"),
	route("api/interview-status", "./routes/api.interview-status.tsx"),
	route("/resource/locales", "./routes/resource.locales.ts"),
	route("/auth/callback", "./routes/auth.callback.tsx"),
	route("login", "./routes/login.tsx"),
	route("register", "./routes/register.tsx"),
	route("signout", "./routes/auth.signout.tsx"),
	route("api.generate-personas", "./routes/api.generate-personas.tsx"),
] satisfies RouteConfig

export default routes
