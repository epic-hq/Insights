import { index, layout, type RouteConfig, route } from "@react-router/dev/routes"
import annotationsRoutes from "./features/annotations/routes"
import dashboardRoutes from "./features/dashboard/routes"
import evidenceRoutes from "./features/evidence/routes"
import homeRoutes from "./features/home/routes"
import insightsRoutes from "./features/insights/routes"
import interviewsRoutes from "./features/interviews/routes"
import marketingRoutes from "./features/marketing/routes"
import mobileRoutes from "./features/mobile/insights/routes"
import opportunitiesRoutes from "./features/opportunities/routes"
import peopleRoutes from "./features/people/routes"
import personasRoutes from "./features/personas/routes"
import projectsRoutes from "./features/projects/routes"
import questionsRoutes from "./features/questions/routes"
import signupChatRoutes from "./features/signup-chat/routes"
import themesRoutes from "./features/themes/routes"

const routes = [
	// Public marketing landing page
	...marketingRoutes,

	// Signup chat (not protected, but requires auth)
	...signupChatRoutes,

	// Protected area
	layout("./routes/_ProtectedLayout.tsx", [
		// Home dashboard for logged-in users
		...homeRoutes,

		// Account-scoped routes
		route("a/:accountId", "./routes/_protected/accounts.tsx", [
			// Projects under account - REMOVED duplicate layout
			...projectsRoutes,

			// Nested project detail children
			route(":projectId", "./routes/_protected/projects.tsx", [
				// Default index: show Project Status screen
				index("./features/projects/pages/project-index.tsx"),
				// Mobile routes
				...dashboardRoutes,
				...interviewsRoutes,
				...insightsRoutes,
				...evidenceRoutes,
				...opportunitiesRoutes,
				...peopleRoutes,
				...personasRoutes,
				...themesRoutes,
				...mobileRoutes,
				...questionsRoutes,

				// Project-scoped onboarding route
				route("new", "./features/onboarding/pages/new.tsx"),

				// Project setup route
				route("setup", "./features/projects/pages/setup.tsx"),

				// Project settings route (new, replacing deprecated /projects/:id/edit)
				route("settings", "./features/projects/pages/edit.tsx"),

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
	route("api/interview-status", "./routes/api.interview-status.tsx"),
	route("api/interview-transcript", "./routes/api.interview-transcript.tsx"),
	route("api/copilotkit", "./features/signup-chat/api/copilotkit.tsx"),
	route("api/onboarding-start", "./routes/api.onboarding-start.tsx"),
	route("api/evaluate-question", "./routes/api.evaluate-question.tsx"),
	route("api/create-project", "./routes/api.create-project.tsx"),
	route("api/save-project-goals", "./routes/api.save-project-goals.tsx"),
	route("api/load-project-goals", "./routes/api.load-project-goals.tsx"),
	route("api/assemblyai-webhook", "./routes/api.assemblyai-webhook.tsx"),
	route("api/trigger-analysis", "./routes/api.trigger-analysis.tsx"),
	route("api/daily-brief", "./routes/api.daily-brief.tsx"),
	route("api/generate-questions", "./routes/api.generate-questions.tsx"),
	route("api/project-status", "./routes/api.project-status.tsx"),
	route("api/analyze-project-status", "./routes/api.analyze-project-status.tsx"),
	route("api/agent-state/:agentId", "./routes/api.agent-state.$agentId.tsx"),
	route("api/user-profile", "./routes/api/user-profile.ts"),
	route("api.analysis-retry", "./routes/api.analysis-retry.tsx"),
	route("api/generate-themes", "./routes/api/generate-themes.tsx"),
	route("api/test-generate-themes", "./routes/api/test-generate-themes.tsx"),
	route("api/generate-persona-insights", "./routes/api/generate-persona-insights.ts"),
	route("api/generate-followup-questions", "./routes/api.generate-followup-questions.tsx"),
	route("api/signup-next-turn", "./routes/api.signup-next-turn.tsx"),

	// Resource routes
	route("/resource/locales", "./routes/resource.locales.ts"),
	route("healthcheck", "./routes/healthcheck.ts"),

	// Test routes
	route("team", "./features/accounts/pages/team.tsx"),
	route("test_register", "./routes/(auth)+/test_register.tsx"),
	route("test/upsight", "./routes/test.upsight.tsx"),
	route("test/question-quality", "./routes/test.question-quality.tsx"),
] satisfies RouteConfig

export default routes
