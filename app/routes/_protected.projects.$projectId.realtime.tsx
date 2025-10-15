import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import { InterviewCopilot } from "~/features/realtime/components/InterviewCopilot"
import { getServerClient } from "~/lib/supabase/client.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { projectId } = params

	if (!projectId) {
		throw new Response("Project ID is required", { status: 400 })
	}

	// Get user from supabase auth
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser()

	if (authError || !user) {
		throw new Response("Authentication required", { status: 401 })
	}

	// Fetch project data
	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("*")
		.eq("id", projectId)
		.single()

	if (projectError || !project) {
		throw new Response("Project not found", { status: 404 })
	}

	return {
		project,
		projectId,
		user,
	}
}

export default function RealtimeInterviewPage() {
	const { projectId } = useLoaderData<typeof loader>()

	return (
		<div className="h-screen bg-gray-50">
			<InterviewCopilot projectId={projectId} />
		</div>
	)
}
