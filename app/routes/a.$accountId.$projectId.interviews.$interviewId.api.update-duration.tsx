import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const accountId = params.accountId
	const projectId = params.projectId
	const interviewId = params.interviewId

	if (!accountId || !projectId || !interviewId) {
		return Response.json({ error: "Missing required parameters" }, { status: 400 })
	}

	try {
		const body = await request.json()
		const { duration_seconds } = body

		if (typeof duration_seconds !== "number" || duration_seconds <= 0) {
			return Response.json({ error: "Invalid duration" }, { status: 400 })
		}

		// Convert seconds to minutes (rounded up)
		const duration_min = Math.ceil(duration_seconds / 60)

		// Update the interview with the duration
		const { error } = await supabase
			.from("interviews")
			.update({ duration_min })
			.eq("id", interviewId)
			.eq("project_id", projectId)
		// .eq("account_id", accountId)

		if (error) {
			console.error("Error updating interview duration:", error)
			return Response.json({ error: "Failed to update duration" }, { status: 500 })
		}

		return Response.json({ success: true, duration_min })
	} catch (error) {
		console.error("Error updating interview duration:", error)
		return Response.json({ error: "Failed to update duration" }, { status: 500 })
	}
}