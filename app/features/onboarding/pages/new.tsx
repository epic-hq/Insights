import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate } from "react-router-dom"
import { userContext } from "~/server/user-context"
import { getProjectById } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import OnboardingFlow, { type OnboardingData } from "../components/OnboardingFlow"

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
		accountId,
		id: projectId,
	})

	if (!projectResult.data) {
		throw new Response("Project not found", { status: 404 })
	}

	const project = projectResult.data

	return {
		project,
		accountId,
		projectId,
	}
}

export default function AddInterviewPage() {
	const { project, accountId, projectId } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	const handleOnboardingComplete = async (data: OnboardingData) => {
		// Navigate to project dashboard after adding interview
		if (routes.dashboard) {
			navigate(routes.dashboard())
		} else {
			navigate(`/a/${accountId}/${projectId}`)
		}
	}

	const handleAddMoreInterviews = () => {
		// Stay on this page to add another interview
		window.location.reload()
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
			projectId={projectId}
			existingProject={{
				name: project.name,
				icp: project.description || "",
				role: "",
				goal: "",
				questions: [],
			}}
		/>
	)
}
