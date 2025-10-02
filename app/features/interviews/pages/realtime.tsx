import { useEffect } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { InterviewCopilot } from "~/features/realtime/components/InterviewCopilot"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
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

	await createPlannedAnswersForInterview(supabase, { projectId, interviewId })

	return { accountId, projectId, interviewId }
}

export default function InterviewRealtimePage() {
	const { projectId, interviewId } = useLoaderData<typeof loader>()

	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			// Show confirmation dialog when user tries to leave the page
			e.preventDefault()
			// Note: Modern browsers ignore custom messages and show their own standard message
			return "Are you sure you want to leave? Any unsaved recording may be lost."
		}

		window.addEventListener("beforeunload", handleBeforeUnload)

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload)
		}
	}, [])

	return (
		// Fill available outlet height from AppLayout, avoid double 100vh under header
		<div className="h-full min-h-0 bg-background">
			<InterviewCopilot projectId={projectId} interviewId={interviewId} />
		</div>
	)
}
