import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router"
import { ChevronLeft } from "lucide-react"
import { Button } from "~/components/ui/button"
import { InterviewCopilot } from "~/features/realtime/components/InterviewCopilot"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

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

	return { accountId, projectId, interviewId }
}

export default function InterviewRealtimePage() {
	const { accountId, projectId, interviewId } = useLoaderData<typeof loader>()
	const routes = useProjectRoutesFromIds(accountId, projectId)
	
	return (
		<div className="relative h-screen bg-gray-50">
			{/* Back button */}
			<div className="absolute top-4 left-4 z-10">
				<Link to={routes.interviews.index()}>
					<Button
						variant="outline"
						size="sm"
						className="flex items-center gap-2 bg-background/80 backdrop-blur-sm"
					>
						<ChevronLeft className="h-4 w-4" />
						Back to Interviews
					</Button>
				</Link>
			</div>
			<InterviewCopilot projectId={projectId} interviewId={interviewId} />
		</div>
	)
}
