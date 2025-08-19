import { layout, type RouteConfig, route } from "@react-router/dev/routes"
import aiChatRoutes from "./features/aichat/routes"
import annotationsRoutes from "./features/annotations/routes"
import dashboardRoutes from "./features/dashboard/routes"
import homeRoutes from "./features/home/routes"
import insightsRoutes from "./features/insights/routes"
import interviewsRoutes from "./features/interviews/routes"
import marketingRoutes from "./features/marketing/routes"
import mobileRoutes from "./features/mobile/insights/routes"
import onboardingRoutes from "./features/onboarding/routes"
import opportunitiesRoutes from "./features/opportunities/routes"
import peopleRoutes from "./features/people/routes"
import personasRoutes from "./features/personas/routes"
import projectsRoutes from "./features/projects/routes"

const routes = [
	// Public marketing landing page
	...marketingRoutes,

	// Protected area
	layout("./routes/_ProtectedLayout.tsx", [
		// Home dashboard for logged-in users
		...homeRoutes,
		...onboardingRoutes,

		// Account-scoped routes
		route("a/:accountId", "./routes/_protected/accounts.tsx", [
			// Projects under account - REMOVED duplicate layout
			...projectsRoutes,

			// Nested project detail children
			route(":projectId", "./routes/_protected/projects.tsx", [
				// Mobile routes
				...aiChatRoutes,
				...dashboardRoutes,
				...interviewsRoutes,
				...insightsRoutes,
				...opportunitiesRoutes,
				...peopleRoutes,
				...personasRoutes,
				...mobileRoutes,

				// Annotations API routes (need project context)
				...annotationsRoutes,
			]),
		]),
	]),

	// Authentication routes
	route("/auth/callback", "./routes/auth.callback.tsx"),
	route("login", "./routes/(auth)+/login.tsx"),
	route("login_success", "./routes/(auth)+/login_success.tsx"),
	route("login_failure", "./routes/(auth)+/login_failure.tsx"),
	route("register", "./routes/(auth)+/register.tsx"),
	route("/auth/signout", "./routes/auth.signout.tsx"),

	// API routes
	route("api/upload-file", "./routes/api.upload-file.tsx"),
	route("api/upload-from-url", "./routes/api.upload-from-url.tsx"),
	route("api/update-field", "./routes/api.update-field.tsx"),
	route("api/generate-persona-insights", "./routes/api.generate-persona-insights.tsx"),
	route("api/interview-status", "./routes/api.interview-status.tsx"),
	route("api/interview-transcript", "./routes/api.interview-transcript.tsx"),
	route("api/generate-personas", "./routes/api.generate-personas.tsx"),
	route("api/copilotkit", "./features/aichat/api/copilotkit.tsx"),
	route("api/onboarding-start", "./routes/api.onboarding-start.tsx"),
	route("api/assemblyai-webhook", "./routes/api.assemblyai-webhook.tsx"),
	route("api/trigger-analysis", "./routes/api.trigger-analysis.tsx"),
	route("api/daily-brief", "./routes/api.daily-brief.tsx"),
	route("api/generate-questions", "./routes/api.generate-questions.tsx"),
	route("api/project-status", "./routes/api.project-status.tsx"),
	route("api/analyze-project-status", "./routes/api.analyze-project-status.tsx"),
	route("api/user-profile", "./routes/api/user-profile.ts"),

	// Resource routes
	route("/resource/locales", "./routes/resource.locales.ts"),
	route("healthcheck", "./routes/healthcheck.ts"),

	// Test routes
	route("team", "./features/accounts/pages/team.tsx"),
	route("test_register", "./routes/(auth)+/test_register.tsx"),
] satisfies RouteConfig

export default routes
