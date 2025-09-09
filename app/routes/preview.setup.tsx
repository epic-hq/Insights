// Preview route for redesigned setup page
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import ProjectGoalsScreen from "~/features/onboarding/components/ProjectGoalsScreen"
import { getProjectById } from "~/features/projects/db"
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

function fallbackPrefill(templateKey: string, projectName: string, signup: Record<string, unknown>): TemplatePrefill {
	const goalFromSignup = (signup?.goal || "").toString().trim()
	const challenges = (signup?.challenges || "").toString().trim()
	const inferredGoal = goalFromSignup || `Understand customer needs for ${projectName}`

	const pre: TemplatePrefill = {
		template_key: templateKey,
		target_orgs: ["Early-stage SaaS companies", "Mid-market B2B product teams", "Ecommerce brands"],
		target_roles: ["Product Manager", "Head of Growth", "UX Researcher", "Customer Success Lead", "Founder/CEO"],
		research_goal: inferredGoal,
		research_goal_details: challenges
			? `Why now: ${challenges}`
			: "Map customer jobs-to-be-done, outcomes, pains, triggers, and decision criteria to guide product and messaging.",
		decision_questions: [
			"Which outcomes do customers care about most, and why?",
			"What jobs-to-be-done lead customers to hire our solution?",
			"Where are the biggest pains and frictions in their current workflow?",
		],
		assumptions: [
			"Users buy primarily to achieve outcome X, not feature Y.",
			"Price sensitivity is low if the outcome impact is clear.",
			"Onboarding speed is a key driver of early retention.",
		],
		unknowns: [
			"Which 1–2 outcomes matter most enough to switch/upgrade?",
			"Which moments cause the highest friction or drop-off?",
			"Which alternatives are most commonly compared and why?",
		],
		custom_instructions:
			"Speak in plain language. Avoid leading or binary questions. Focus on outcomes, contexts, and tradeoffs. Prefer concrete examples.",
	}

	return pre
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const projectId = params.projectId

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	// Get the actual project for context
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

	const prefill: TemplatePrefill = fallbackPrefill(template_key, projectResult.data.name || "Project", signup)

	return {
		project: projectResult.data,
		accountId,
		projectId,
		template_key,
		prefill,
		isPreview: true,
	}
}

export default function PreviewSetupPage() {
	const { project, projectId, accountId, template_key, prefill } = useLoaderData<typeof loader>()

	const handleNext = () => {
		// For preview, just show an alert
		alert("Preview mode - this would normally navigate to the questions step")
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Preview Banner */}
			<div className="bg-blue-600 p-3 text-center text-white">
				<p className="text-sm">
					🎨 <strong>Preview Mode</strong> - This is the redesigned version of the setup page
				</p>
			</div>
			<div className="mx-auto max-w-4xl px-0 py-8">
				<ProjectGoalsScreen
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
