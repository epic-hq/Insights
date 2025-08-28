import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate, useRevalidator } from "react-router-dom"
import OnboardingFlow, { type OnboardingData } from "~/features/onboarding/components/OnboardingFlow"
import { getProjectById, getProjectSections } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import { createRouteDefinitions } from "~/utils/route-definitions"

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

	// Extract questions from project sections
	const questions = (sectionsResult.data || [])
		.filter((section) => section.kind === "goal" || section.kind === "question")
		.map((section) => section.content_md)
		.filter(Boolean)

	return {
		project,
		accountId,
		projectId,
		questions,
	}
}

export default function AddInterviewPage() {
	const { project, accountId, projectId, questions } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	const handleOnboardingComplete = async (data: OnboardingData) => {
		// Use the new project ID if available, otherwise fall back to existing
		const newProjectId = data.projectId || projectId
		const interviewId = data.interviewId

		// Create routes for the new project context using server-side pattern
		const newProjectPath = `/a/${accountId}/${newProjectId}`
		const newRoutes = createRouteDefinitions(newProjectPath)

		if (interviewId) {
			// Navigate to the newly created interview detail
			navigate(newRoutes.interviews.detail(interviewId))
		} else {
			// Fallback to project dashboard
			navigate(newRoutes.projects.detail(newProjectId))
		}
	}

	const handleAddMoreInterviews = () => {
		// Stay on this page to add another interview - use smooth revalidation
		revalidator.revalidate()
	}

	const handleRefresh = () => {
		// Smooth refresh without full page reload using React Router 7 revalidator
		revalidator.revalidate()
	}

	const handleViewResults = () => {
		// Navigate to project dashboard
		if (routes.dashboard) {
			navigate(routes.dashboard())
		} else {
			navigate(`/a/${accountId}/${projectId}`)
		}
	}

	return (
		<OnboardingFlow
			onComplete={handleOnboardingComplete}
			onAddMoreInterviews={handleAddMoreInterviews}
			onViewResults={handleViewResults}
			onRefresh={handleRefresh}
			projectId={projectId}
			accountId={accountId}
			existingProject={{
				name: project.name,
				icp: project.description || "",
				role: "",
				goal: "",
				questions: questions || [],
			}}
		/>
	)
}
