// Soft import baml client (works even if new function not generated yet)
import { b } from "baml_client"
import { FileText, MessageSquare } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { Button } from "~/components/ui/button"
import ProjectGoalsScreenRedesigned from "~/features/onboarding/components/ProjectGoalsScreenRedesigned"
import { ProjectSetupChat } from "~/features/projects/components/ProjectSetupChat"
import { getProjectById } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

type TemplatePrefill = {
	template_key: string
	customer_problem: string
	target_orgs: string[]
	target_roles: string[]
	offerings: string
	competitors: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions: string
}

type SignupData = {
	goal?: unknown
	challenges?: unknown
	custom_instructions?: string
} & Record<string, unknown>

function fallbackPrefill(templateKey: string, projectName: string, signup: SignupData): TemplatePrefill {
	const goalFromSignup = (signup?.goal || "").toString().trim()
	const challenges = (signup?.challenges || "").toString().trim()
	const _inferredGoal = goalFromSignup || `Understand customer needs for ${projectName}`

	const pre: TemplatePrefill = {
		template_key: templateKey,
		customer_problem: "",
		target_orgs: [],
		target_roles: [],
		offerings: "",
		competitors: [],
		research_goal: goalFromSignup || "",
		research_goal_details: challenges || "",
		decision_questions: [],
		assumptions: [],
		unknowns: [],
		custom_instructions: "",
	}

	return pre
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const projectId = params.projectId

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	// Verify project exists and user has access
	const projectResult = await getProjectById({
		supabase: ctx.supabase,
		id: projectId,
	})

	if (!projectResult.data) {
		throw new Response("Project not found", { status: 404 })
	}

	// Default template: Understand Customer Needs
	const template_key = "understand_customer_needs"
	const signup: SignupData = { ...(ctx.user_settings?.signup_data || {}) }

	// Allow optional prefill instructions via query param for quick re-runs
	try {
		const url = new URL(request.url)
		const extra = url.searchParams.get("prefillInstructions")
		if (extra && extra.trim().length > 0) {
			signup.custom_instructions = String(extra)
		}
	} catch { }

	let prefill: TemplatePrefill = fallbackPrefill(template_key, projectResult.data.name || "Project", signup)
	try {
		// Try BAML-based prefill if available
		// @ts-expect-error - function may not exist until baml generate runs
		if (b?.FillProjectTemplate) {
			const filled = await b.FillProjectTemplate({
				inputs: {
					template_key,
					signup_data: JSON.stringify(signup || {}),
					project_name: projectResult.data.name || "Project",
				},
			})
			// Basic normalization/guards
			prefill = {
				template_key: filled.template_key || template_key,
				customer_problem: filled.customer_problem || prefill.customer_problem,
				target_orgs: (filled.target_orgs || []).slice(0, 3),
				target_roles: (filled.target_roles || []).slice(0, 8),
				offerings: filled.offerings || prefill.offerings,
				competitors: (filled.competitors || []).slice(0, 8),
				research_goal: filled.research_goal || prefill.research_goal,
				research_goal_details: filled.research_goal_details || prefill.research_goal_details,
				decision_questions: (filled.decision_questions || prefill.decision_questions).slice(0, 6),
				assumptions: (filled.assumptions || prefill.assumptions).slice(0, 8),
				unknowns: (filled.unknowns || prefill.unknowns).slice(0, 8),
				custom_instructions: filled.custom_instructions || prefill.custom_instructions,
			}
		}
	} catch (_e) {
		// Ignore and use fallback
	}

	return {
		project: projectResult.data,
		accountId,
		projectId,
		template_key,
		prefill,
	}
}

// Hide the project status agent sidebar on this page (we have our own chat)
export const handle = {
	hideProjectStatusAgent: true,
}

export default function ProjectSetupPage() {
	const { project, accountId, projectId, template_key, prefill } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)
	const [mode, setMode] = useState<"chat" | "form">("chat")

	const handleNext = () => {
		// After goals, go to questions step inside project context, mark onboarding
		const dest = routes.questions.index()
		const url = dest.includes("?") ? `${dest}&onboarding=1` : `${dest}?onboarding=1`
		navigate(url)
	}

	const handleSetupComplete = () => {
		// Navigate to dashboard or questions after chat-based setup
		navigate(routes.dashboard())
	}

	return (
		<div className="min-h-screen">
			<PageContainer size="lg" padded={false} className="max-w-4xl px-4 py-8">
				{/* Mode Toggle */}
				<div className="mb-6 flex items-center justify-between">
					<div>
						<h1 className="font-semibold text-2xl text-foreground">
							{project?.name ? `Project Context: ${project.name}` : "Project Context"}
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							{mode === "chat"
								? "Chat or blab away, I got you."
								: "Structured input, always in sync with chat."}
						</p>
					</div>
					<div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-1">
						<Button
							variant={mode === "chat" ? "default" : "ghost"}
							size="sm"
							onClick={() => setMode("chat")}
							className="gap-2"
						>
							<MessageSquare className="h-4 w-4" />
							Chat
						</Button>
						<Button
							variant={mode === "form" ? "default" : "ghost"}
							size="sm"
							onClick={() => setMode("form")}
							className="gap-2"
						>
							<FileText className="h-4 w-4" />
							Form
						</Button>
					</div>
				</div>

				{/* Content based on mode */}
				{mode === "chat" ? (
					<ProjectSetupChat
						accountId={accountId}
						projectId={projectId}
						projectName={project?.name || "Project"}
						onSetupComplete={handleSetupComplete}
					/>
				) : (
					<ProjectGoalsScreenRedesigned
						onNext={handleNext}
						project={project}
						projectId={projectId}
						accountId={accountId}
						templateKey={template_key}
						prefill={prefill}
					/>
				)}
			</PageContainer>
		</div>
	)
}
