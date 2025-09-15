// Soft import baml client (works even if new function not generated yet)
import { b } from "baml_client"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate } from "react-router-dom"
import ProjectGoalsScreenRedesigned from "~/features/onboarding/components/ProjectGoalsScreenRedesigned"
import { getProjectById } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

type TemplatePrefill = {
	template_key: string
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions: string
}

function fallbackPrefill(templateKey: string, projectName: string, signup: any): TemplatePrefill {
	const goalFromSignup = (signup?.goal || "").toString().trim()
	const challenges = (signup?.challenges || "").toString().trim()
	const inferredGoal = goalFromSignup || `Understand customer needs for ${projectName}`

	const pre: TemplatePrefill = {
		template_key: templateKey,
		target_orgs: [],
		target_roles: [],
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
	const signup = { ...(ctx.user_settings?.signup_data || {}) }

	// Allow optional prefill instructions via query param for quick re-runs
	try {
		const url = new URL(request.url)
		const extra = url.searchParams.get("prefillInstructions")
		if (extra && extra.trim().length > 0) {
			;(signup as any).custom_instructions = String(extra)
		}
	} catch {}

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
				target_orgs: (filled.target_orgs || []).slice(0, 3),
				target_roles: (filled.target_roles || []).slice(0, 8),
				research_goal: filled.research_goal || prefill.research_goal,
				research_goal_details: filled.research_goal_details || prefill.research_goal_details,
				decision_questions: (filled.decision_questions || prefill.decision_questions).slice(0, 6),
				assumptions: (filled.assumptions || prefill.assumptions).slice(0, 8),
				unknowns: (filled.unknowns || prefill.unknowns).slice(0, 8),
				custom_instructions: filled.custom_instructions || prefill.custom_instructions,
			}
		}
	} catch (e) {
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

export default function ProjectSetupPage() {
	const { project, accountId, projectId, template_key, prefill } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	const handleNext = () => {
		// After goals, go to questions step inside project context, mark onboarding
		const dest = routes.questions.index()
		const url = dest.includes("?") ? `${dest}&onboarding=1` : `${dest}?onboarding=1`
		navigate(url)
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="mx-auto max-w-4xl px-4 py-8">
				<ProjectGoalsScreenRedesigned
					onNext={handleNext}
					project={project}
					projectId={projectId}
					accountId={accountId}
					templateKey={template_key}
					prefill={prefill}
				/>
			</div>
		</div>
	)
}
