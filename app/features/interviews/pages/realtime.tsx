import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { userContext } from "~/server/user-context"
import { InterviewCopilot } from "~/features/realtime/components/InterviewCopilot"

export const meta: MetaFunction = () => [{ title: "Interview Realtime | Insights" }]

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const accountId = params.accountId
	const projectId = params.projectId
	const interviewId = params.interviewId

	if (!accountId || !projectId || !interviewId) {
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 })
	}

	// Optional: verify interview exists and belongs to project
	const { data: interview, error } = await supabase
		.from("interviews")
		.select("id, project_id")
		.eq("id", interviewId)
		.eq("project_id", projectId)
		.single()

	if (error || !interview) {
		throw new Response("Interview not found", { status: 404 })
	}

	return { projectId, interviewId }
}

export default function InterviewRealtimePage() {
	const { projectId, interviewId } = useLoaderData<typeof loader>()
	return (
		<div className="h-screen bg-gray-50">
			<InterviewCopilot projectId={projectId} interviewId={interviewId} />
		</div>
	)
}
