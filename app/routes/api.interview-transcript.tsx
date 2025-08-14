import type { LoaderFunctionArgs } from "react-router"
import { getInterviewById } from "~/features/interviews/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

export async function loader({ context, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const projectContext = context.get(currentProjectContext)

	const url = new URL(request.url)
	const interviewId = url.searchParams.get("interviewId")

	// Get account and project from context (set by middleware)
	const accountId = ctx.account_id
	const projectId = projectContext?.projectId

	if (!accountId || !projectId || !interviewId) {
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 })
	}

	try {
		// Fetch only transcript data
		const { data: interviewData, error } = await getInterviewById({
			supabase,
			accountId,
			projectId,
			id: interviewId,
		})

		if (error) {
			throw new Response(`Error fetching transcript: ${error.message}`, { status: 500 })
		}

		if (!interviewData) {
			throw new Response("Interview not found", { status: 404 })
		}

		// Return only transcript data to minimize payload
		return {
			transcript: interviewData.transcript,
			transcript_formatted: interviewData.transcript_formatted,
		}
	} catch (error) {
		throw new Response(`Failed to load transcript: ${error.message}`, { status: 500 })
	}
}
