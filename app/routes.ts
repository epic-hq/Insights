import { index, layout, type RouteConfig, route } from "@react-router/dev/routes"
import annotationsRoutes from "./features/annotations/routes"
import dashboardRoutes from "./features/dashboard/routes"
import docsRoutes from "./features/docs/routes"
import evidenceRoutes from "./features/evidence/routes"
import facetsRoutes from "./features/facets/routes"
import homeRoutes from "./features/home/routes"
import insightsRoutes from "./features/insights/routes"
import interviewsRoutes from "./features/interviews/routes"
import lensesRoutes from "./features/lenses/routes"
import marketingRoutes from "./features/marketing/routes"
import mobileRoutes from "./features/mobile/insights/routes"
import opportunitiesRoutes from "./features/opportunities/routes"
import organizationsRoutes from "./features/organizations/routes"
import peopleRoutes from "./features/people/routes"
import personasRoutes from "./features/personas/routes"
import prioritiesRoutes from "./features/priorities/routes"
import projectChatRoutes from "./features/project-chat/routes"
import projectsRoutes from "./features/projects/routes"
import questionsRoutes from "./features/questions/routes"
import segmentsRoutes from "./features/segments/routes"
import signupChatRoutes from "./features/signup-chat/routes"
import teamsRoutes, { teamsAccountRoutes as teamRoutes } from "./features/teams/routes"
import themesRoutes from "./features/themes/routes"
import voiceRoutes from "./features/voice/routes"

const routes = [
	// Public marketing landing page
	...marketingRoutes,

	// Welcome/Feature tour (public, redirects based on auth state)
	route("welcome", "./features/onboarding/pages/welcome.tsx"),

	// Signup chat (not protected, but requires auth)
	...signupChatRoutes,

	// Protected area
	layout("./routes/_ProtectedLayout.tsx", [
		// Home dashboard for logged-in users
		...homeRoutes,
		...teamsRoutes,
		...docsRoutes,

		// Protected API routes
		route("api/tasks/deduplicate", "./routes/api.tasks.deduplicate.ts"),
		route("api/similar-themes", "./routes/api.similar-themes.tsx"),
		route("api/delete-empty-themes", "./routes/api.delete-empty-themes.tsx"),

		// Account-scoped routes
		route("a/:accountId", "./routes/_protected/accounts.tsx", [
			// Account home/dashboard
			route("home", "./features/home/pages/index.tsx"),
			route("settings", "./features/accounts/pages/settings.tsx"),
			// Projects under account - REMOVED duplicate layout
			...projectsRoutes,
			// Account-scoped team routes
			...teamRoutes,
			route("api/sales/create-workspace", "./routes/api.sales.create-workspace.tsx"),

			// Nested project detail children - Layout route with sidebar
			route(":projectId", "./routes/_protected/projects.tsx", [
				// Default index: Dashboard V3
				index("./features/dashboard-v3/pages/index.tsx"),
				// Legacy project status screen
				route("project-status", "./features/projects/pages/project-index.tsx"),
				// Mobile routes
				...dashboardRoutes,
				route("sales-lenses", "./routes/_protected.projects.$projectId.sales-lenses.tsx"),
				...interviewsRoutes,
				...insightsRoutes,
				...evidenceRoutes,
				...opportunitiesRoutes,
				...organizationsRoutes,
				...peopleRoutes,
				...personasRoutes,
				...segmentsRoutes,
				...themesRoutes,
				...mobileRoutes,
				...questionsRoutes,
				...projectChatRoutes,
				...facetsRoutes,
				...lensesRoutes,
				...prioritiesRoutes,

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
				route("api/interviews/realtime-upload", "./routes/api.interviews.realtime-upload.tsx"),
				route("api/interviews/realtime-finalize", "./routes/api.interviews.realtime-finalize.tsx"),

				// Project-setup agent chat API (project-scoped)
				route("api/chat/project-setup", "./routes/api.chat.project-setup.tsx"),
				// Project status agent chat API (project-scoped)
				route("api/chat/project-status", "./routes/api.chat.project-status.tsx"),
				// Interview insight agent chat API (project-scoped)
				route("api/chat/interview/:interviewId", "./routes/api.chat.interview.$interviewId.tsx"),
				route("api/chat/project-status/history", "./routes/api.chat.project-status.history.tsx"),

				// Interview transcript API (project-scoped)
				route("api/interview-transcript", "./routes/api.interview-transcript.tsx"),
			]),

			// Account-scoped quick record API: creates project + interview
			route("api/interviews/record-now", "./routes/api.interviews.record-now.tsx"),
			route("api/people/search", "./routes/api.people.search.tsx"),
		]),
	]),

	// Authentication routes
	route("login", "./routes/login.tsx"),
	route("sign-up", "./routes/sign-up.tsx"),
	route("/auth/oauth", "./routes/(auth)+/oauth/route.ts"),
	route("/auth/callback", "./routes/auth.callback.tsx"),
	route("forgot-password", "./routes/forgot-password.tsx"),
	route("login_success", "./routes/(auth)+/login_success.tsx"),
	route("login_failure", "./routes/(auth)+/login_failure.tsx"),
	route("/auth/signout", "./routes/auth.signout.tsx"),
	route("accept-invite", "./routes/accept-invite.tsx"),
	route("invites", "./routes/invites.tsx"),

	// API routes
	route("api/upload-file", "./routes/api.upload-file.tsx"),
	route("api/upload-from-url", "./routes/api.upload-from-url.tsx"),
	route("api/upload-image", "./routes/api.upload-image.tsx"),
	route("api/notes/create", "./routes/api.notes.create.tsx"),
	route("api/update-field", "./routes/api.update-field.tsx"),
	route("api/update-person-facet-summary", "./routes/api.update-person-facet-summary.tsx"),
	route("api/update-lens", "./routes/api.update-lens.tsx"),
	route("api/update-slot", "./routes/api.update-slot.tsx"),
	route("api/update-stakeholder", "./routes/api.update-stakeholder.tsx"),
	route("api/update-opportunity", "./routes/api.update-opportunity.tsx"),
	route("api/update-next-step", "./routes/api.update-next-step.tsx"),
	route("api/opportunity-advisor", "./routes/api.opportunity-advisor.tsx"),
	route("api/update-user-project-preference", "./routes/api.update-user-project-preference.tsx"),
	route("api/interview-status", "./routes/api.interview-status.tsx"),
	route("api/onboarding-start", "./routes/api.onboarding-start.tsx"),
	route("api/evaluate-question", "./routes/api.evaluate-question.tsx"),
	route("api/create-project", "./routes/api.create-project.tsx"),
	route("api/save-project-goals", "./routes/api.save-project-goals.tsx"),
	route("api/load-project-goals", "./routes/api.load-project-goals.tsx"),
	route("api/assemblyai-webhook", "./routes/api.assemblyai-webhook.tsx"),
	route("api/trigger-analysis", "./routes/api.trigger-analysis.tsx"),
	route("api/trigger-run-token", "./routes/api.trigger-run-token.tsx"),
	route("api/daily-brief", "./routes/api.daily-brief.tsx"),
	route("api/generate-questions", "./routes/api.generate-questions.tsx"),
	route("api/project-status", "./routes/api.project-status.tsx"),
	route("api/analyze-project-status", "./routes/api.analyze-project-status.tsx"),
	route("api/analyze-research-evidence", "./routes/api.analyze-research-evidence.tsx"),
	route("api/agent-state/:agentId", "./routes/api.agent-state.$agentId.tsx"),
	route("api/media/signed-url", "./routes/api.media.signed-url.tsx"),
	route("api/user-profile", "./routes/api/user-profile.ts"),
	route("api.analysis-retry", "./routes/api.analysis-retry.tsx"),
	route("api/generate-themes", "./routes/api/generate-themes.tsx"),
	route("api/generate-persona-insights", "./routes/api/generate-persona-insights.ts"),
	route("api/generate-icp-recommendations", "./routes/api.generate-icp-recommendations.ts"),
	route("api/create-persona-from-icp", "./routes/api.create-persona-from-icp.ts"),
	route("api/generate-followup-questions", "./routes/api.generate-followup-questions.tsx"),
	route("api/improve-question", "./routes/api.improve-question.tsx"),
	route("api/questions/:questionId", "./routes/api.questions.$questionId.tsx"),
	route("api/questions/save-debug", "./routes/api.questions.save-debug.tsx"),
	route("api/generate-research-structure", "./routes/api.generate-research-structure.tsx"),
	route("api/migrate-research-structure", "./routes/api.migrate-research-structure.tsx"),
	route("api/check-research-structure", "./routes/api.check-research-structure.tsx"),
	route("api/signup-next-turn", "./routes/api.signup-next-turn.tsx"),
	route("api/assemblyai-token", "./routes/api.assemblyai-token.tsx"),
	route("api.livekit-token", "./routes/api.livekit-token.tsx"),
	route("api/process", "./routes/api.process.tsx"),
	route("api.research-answers", "./routes/api.research-answers.tsx"),
	route("api/teams/create", "./routes/api.teams.create.tsx"),
	route("api.reprocess-evidence", "./routes/api.reprocess-evidence.tsx"),
	route("api.reanalyze-themes", "./routes/api.reanalyze-themes.tsx"),
	route("api/cancel-analysis", "./routes/api.cancel-analysis.tsx"),
	route("api.cancel-analysis-run", "./routes/api.cancel-analysis-run.tsx"),
	route("api/enrich-themes", "./routes/api.enrich-themes.tsx"),
	route("api/consolidate-themes", "./routes/api.consolidate-themes.tsx"),
	route("api/reprocess-interview", "./routes/api.reprocess-interview.tsx"),
	route("api/fix-stuck-interview", "./routes/api.fix-stuck-interview.tsx"),
	route("api.generate-sales-lens", "./routes/api.generate-sales-lens.tsx"),
	route("api/apply-lens", "./routes/api.apply-lens.tsx"),
	route("api/lens-templates", "./routes/api.lens-templates.tsx"),
	route("api/update-lens-analysis-field", "./routes/api.update-lens-analysis-field.tsx"),
	route("api/update-lens-entity", "./routes/api.update-lens-entity.tsx"),
	route("api/regenerate-ai-summary", "./routes/api.regenerate-ai-summary.tsx"),
	route("api/link-interview-participant", "./routes/api.link-interview-participant.tsx"),
	route("api/generate-thumbnails", "./routes/api.generate-thumbnails.tsx"),
	// Lens architecture test routes
	route("api/test-user-groups", "./routes/api.test-user-groups.tsx"),
	route("api/test-pain-matrix", "./routes/api.test-pain-matrix.tsx"),

	...voiceRoutes,

	// Resource routes
	route("/link", "./routes/link.tsx"),
	route("/resource/locales", "./routes/resource.locales.ts"),
	route("healthcheck", "./routes/healthcheck.ts"),
	route("apple-touch-icon.png", "./routes/apple-touch-icon[.]png.ts"),
	route("apple-touch-icon-precomposed.png", "./routes/apple-touch-icon-precomposed[.]png.ts"),

	// Test routes
	route("test/upsight", "./routes/test.upsight.tsx"),
	route("test/question-quality", "./routes/test.question-quality.tsx"),
	// route("realtime/quick", "./features/realtime/pages/quick.tsx"),
	route("timeline", "./components/ui/timeline.tsx"),
] satisfies RouteConfig

export default routes
