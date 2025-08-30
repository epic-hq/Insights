import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate } from "react-router-dom"
import ProjectGoalsScreen from "~/features/onboarding/components/ProjectGoalsScreen"
import { getProjectById } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export async function loader({ context, params }: LoaderFunctionArgs) {
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

	return {
		project: projectResult.data,
		accountId,
		projectId,
	}
}

export default function ProjectSetupPage() {
	const { project, accountId, projectId } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	const handleNext = () => {
		// Navigate back to project detail or dashboard
		navigate(routes.projects.detail())
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="mx-auto max-w-4xl px-4 py-8">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-gray-900">Project Setup</h1>
					<p className="mt-2 text-gray-600">
						Configure your research goals and target market for <strong>{project.name}</strong>
					</p>
				</div>

				<ProjectGoalsScreen onNext={handleNext} projectId={projectId} />
			</div>
		</div>
	)
}
