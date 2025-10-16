import { index, layout, type RouteConfig, route } from "@react-router/dev/routes"
import annotationsRoutes from "./features/annotations/routes"
import dashboardRoutes from "./features/dashboard/routes"
import docsRoutes from "./features/docs/routes"
import evidenceRoutes from "./features/evidence/routes"
import facetsRoutes from "./features/facets/routes"
import homeRoutes from "./features/home/routes"
import insightsRoutes from "./features/insights/routes"
import interviewsRoutes from "./features/interviews/routes"
import marketingRoutes from "./features/marketing/routes"
import mobileRoutes from "./features/mobile/insights/routes"
import opportunitiesRoutes from "./features/opportunities/routes"
import organizationsRoutes from "./features/organizations/routes"
import peopleRoutes from "./features/people/routes"
import personasRoutes from "./features/personas/routes"
import projectChatRoutes from "./features/project-chat/routes"
import projectsRoutes from "./features/projects/routes"
import questionsRoutes from "./features/questions/routes"
import signupChatRoutes from "./features/signup-chat/routes"
import teamsRoutes, { teamsAccountRoutes as teamRoutes } from "./features/teams/routes"
import themesRoutes from "./features/themes/routes"
import voiceRoutes from "./features/voice/routes"

const routes = [
	// Public marketing landing page
	...marketingRoutes,

	// Signup chat (not protected, but requires auth)
	...signupChatRoutes,

	// Protected area
	layout("./routes/_ProtectedLayout.tsx", [
		// Home dashboard for logged-in users
		...homeRoutes,
		...teamsRoutes,
		...docsRoutes,

		// Account-scoped routes
		route("a/:accountId", "./routes/_protected/accounts.tsx", [
			// Projects under account - REMOVED duplicate layout
			...projectsRoutes,
			// Account-scoped team routes
			...teamRoutes,

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
				...organizationsRoutes,
				...peopleRoutes,
				...personasRoutes,
				...themesRoutes,
				...mobileRoutes,
				...questionsRoutes,
				...projectChatRoutes,
				...facetsRoutes,

				// Project-scoped onboarding route
				route("new", "./features/onboarding/pages/new.tsx"),

				// Project setup route
				route("setup", "./features/projects/pages/setup.tsx"),
				// Preview redesigned setup route
				route("setup-preview", "./routes/preview.setup.tsx"),
				// Research workflow route
				route("research-workflow", "./features/questions/pages/research-workflow.tsx"),

				// Project settings route (new, replacing deprecated /projects/:id/edit)
				route("settings", "./features/projects/pages/edit.tsx"),

				// Annotations API routes (need project context)
				...annotationsRoutes,

				// Contextual suggestions API (needs project context)
				route("api/contextual-suggestions", "./routes/api.contextual-suggestions.tsx"),

				// Realtime interviews APIs (project-scoped)
				route("api/interviews/realtime-start", "./routes/api.interviews.realtime-start.tsx"),
				route("api/interviews/realtime-finalize", "./routes/api.interviews.realtime-finalize.tsx"),

				// Project-setup agent chat API (project-scoped)
				route("api/chat/project-setup", "./routes/api.chat.project-setup.tsx"),

				// Interview transcript API (project-scoped)
				route("api/interview-transcript", "./routes/api.interview-transcript.tsx"),
			]),

			// Account-scoped quick record API: creates project + interview
			route("api/interviews/record-now", "./routes/api.interviews.record-now.tsx"),
		]),
	]),

	// Authentication routes
	route("/auth/callback", "./routes/auth.callback.tsx"),
	route("login", "./routes/(auth-new)+/login.tsx"),
	route("login_success", "./routes/(auth)+/login_success.tsx"),
	route("login_failure", "./routes/(auth)+/login_failure.tsx"),
	route("register", "./routes/(auth)+/register.tsx"),
	route("/auth/signout", "./routes/auth.signout.tsx"),
	route("accept-invite", "./routes/accept-invite.tsx"),
	route("invites", "./routes/invites.tsx"),

	// New Auth
	// route("/auth-new/login", "./routes/(auth-new)+/login.tsx"),
	route("/auth-new/oauth", "./routes/(auth-new)+/oauth/route.ts"),

	// API routes
	route("api/upload-file", "./routes/api.upload-file.tsx"),
	route("api/upload-from-url", "./routes/api.upload-from-url.tsx"),
	route("api/update-field", "./routes/api.update-field.tsx"),
	route("api/interview-status", "./routes/api.interview-status.tsx"),
	// route("api/copilotkit", "./features/signup-chat/api/copilotkit.tsx"),
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
	route("api/analyze-research-evidence", "./routes/api.analyze-research-evidence.tsx"),
	route("api/agent-state/:agentId", "./routes/api.agent-state.$agentId.tsx"),
	route("api/user-profile", "./routes/api/user-profile.ts"),
	route("api.analysis-retry", "./routes/api.analysis-retry.tsx"),
	route("api/generate-themes", "./routes/api/generate-themes.tsx"),
	route("api/test-generate-themes", "./routes/api/test-generate-themes.tsx"),
	route("api/generate-persona-insights", "./routes/api/generate-persona-insights.ts"),
	route("api/generate-followup-questions", "./routes/api.generate-followup-questions.tsx"),
	route("api/improve-question", "./routes/api.improve-question.tsx"),
	route("api/questions/:questionId", "./routes/api.questions.$questionId.tsx"),
	route("api/generate-research-structure", "./routes/api.generate-research-structure.tsx"),
	route("api/migrate-research-structure", "./routes/api.migrate-research-structure.tsx"),
	route("api/check-research-structure", "./routes/api.check-research-structure.tsx"),
	route("api/signup-next-turn", "./routes/api.signup-next-turn.tsx"),
	route("api/assemblyai-token", "./routes/api.assemblyai-token.tsx"),
	route("api.research-answers", "./routes/api.research-answers.tsx"),
	route("api/teams/create", "./routes/api.teams.create.tsx"),
	...voiceRoutes,

	// Resource routes
	route("/link", "./routes/link.tsx"),
	route("/resource/locales", "./routes/resource.locales.ts"),
	route("healthcheck", "./routes/healthcheck.ts"),
	route("apple-touch-icon.png", "./routes/apple-touch-icon[.]png.ts"),
	route("apple-touch-icon-precomposed.png", "./routes/apple-touch-icon-precomposed[.]png.ts"),

	// Test routes
	route("test_register", "./routes/(auth)+/test_register.tsx"),
	route("test/upsight", "./routes/test.upsight.tsx"),
	route("test/question-quality", "./routes/test.question-quality.tsx"),
	// route("realtime/quick", "./features/realtime/pages/quick.tsx"),
] satisfies RouteConfig

export default routes
