import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate } from "react-router-dom"
import { getProjectById, getProjectSections } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import OnboardingFlow, { type OnboardingData } from "../../onboarding/components/OnboardingFlow"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const projectId = params.projectId
	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	// Get existing project data
	const projectResult = await getProjectById({
		supabase: ctx.supabase,
		id: projectId,
	})

	if (!projectResult.data) {
		throw new Response("Project not found", { status: 404 })
	}

	const project = projectResult.data

	// Get project sections to extract questions
	const sectionsResult = await getProjectSections({
		supabase: ctx.supabase,
		projectId,
	})

	// Extract questions from project sections (support both 'question' and 'questions')
	const questions = (sectionsResult.data || [])
		.filter((section) => section.kind === "goal" || section.kind === "question" || section.kind === "questions")
		.map((section) => section.content_md)
		.filter(Boolean)

	return {
		project,
		accountId,
		projectId,
		questions,
	}
}

export default function InterviewOnboardPage() {
	const { project, accountId, projectId, questions } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	const handleOnboardingComplete = async (_data: OnboardingData) => {
		// Navigate to interviews index after adding interview
		navigate(routes.interviews.index())
	}

	const handleAddMoreInterviews = () => {
		// Stay on this page to add another interview
		window.location.reload()
	}

	const handleViewResults = () => {
		// Navigate to interviews index
		navigate(routes.interviews.index())
	}

	return (
		<OnboardingFlow
			onComplete={handleOnboardingComplete}
			onAddMoreInterviews={handleAddMoreInterviews}
			onViewResults={handleViewResults}
			projectId={projectId}
			existingProject={{
				name: project.name,
				target_orgs: [],
				target_roles: [],
				research_goal: "",
				research_goal_details: "",
				assumptions: [],
				unknowns: [],
				custom_instructions: "",
				questions: questions || [],
			}}
		/>
	)
}
