import { runs } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient, getAuthenticatedUser } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const user = await getAuthenticatedUser(request)
	if (!user) {
		return Response.json({ error: "User not authenticated" }, { status: 401 })
	}

	const formData = await request.formData()
	const runId = formData.get("runId") as string
	const interviewId = formData.get("analysisJobId") as string // analysisJobId is now interviewId

	if (!runId || !interviewId) {
		return Response.json({ error: "Missing runId or interviewId" }, { status: 400 })
	}

	try {
		const adminClient = createSupabaseAdminClient()

		// Get interview and verify conversation_analysis contains the run
		const { data: interview, error: interviewError } = await adminClient
			.from("interviews")
			.select("id, status, conversation_analysis")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		const conversationAnalysis = (interview.conversation_analysis as any) || {}

		// Verify the run ID matches
		if (conversationAnalysis.trigger_run_id !== runId) {
			return Response.json({ error: "Run ID mismatch" }, { status: 400 })
		}

		// Check if the interview is in a cancellable state
		const cancellableStatuses = ["processing", "transcribed"]
		if (!cancellableStatuses.includes(interview.status)) {
			return Response.json({ error: "Interview is not in a cancellable state" }, { status: 400 })
		}

		consola.info(`Cancelling analysis run ${runId} for interview ${interviewId}`)

		// Cancel the Trigger.dev run
		try {
			await runs.cancel(runId)
			consola.info(`Successfully canceled Trigger.dev run ${runId}`)
		} catch (cancelError) {
			consola.warn("Failed to cancel Trigger.dev run:", cancelError)
			// Continue anyway to mark as canceled in our database
		}

		// Update conversation_analysis and interview status
		const { error: updateError } = await adminClient
			.from("interviews")
			.update({
				status: "error",
				conversation_analysis: {
					...conversationAnalysis,
					status_detail: "Canceled by user",
					last_error: "Analysis canceled by user",
					canceled_at: new Date().toISOString(),
				},
				updated_at: new Date().toISOString(),
			})
			.eq("id", interviewId)

		if (updateError) {
			consola.error("Failed to update interview", updateError)
			return Response.json({ error: "Failed to update interview" }, { status: 500 })
		}

		consola.info(`Successfully cancelled analysis run ${runId}`)
		return Response.json({ success: true, message: "Analysis cancelled successfully" })
	} catch (error) {
		consola.error("Failed to cancel analysis run", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: `Failed to cancel analysis: ${message}` }, { status: 500 })
	}
}
