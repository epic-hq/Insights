import { runs } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"

/**
 * Cancel a running analysis job
 * This will:
 * 1. Cancel the Trigger.dev run
 * 2. Update conversation_analysis metadata
 * 3. Update the interview status to error
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	consola.log("Cancel analysis API called")
	const formData = await request.formData()
	const interviewId = formData.get("interview_id") as string

	if (!interviewId) {
		return Response.json({ error: "interview_id is required" }, { status: 400 })
	}

	try {
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { client: userDb } = getServerClient(request)
		const admin = createSupabaseAdminClient()

		// Verify user has access to this interview and get conversation_analysis
		const { data: interview, error: interviewError } = await userDb
			.from("interviews")
			.select("id, status, conversation_analysis")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			return Response.json({ error: "Unauthorized or interview not found" }, { status: 403 })
		}

		// Check if interview is in a cancellable state
		if (interview.status !== "processing") {
			return Response.json({ error: "No active analysis to cancel" }, { status: 400 })
		}

		const conversationAnalysis = (interview.conversation_analysis as any) || {}
		const triggerRunId = conversationAnalysis.trigger_run_id

		// Cancel the Trigger.dev run if it exists
		if (triggerRunId) {
			try {
				consola.info(`Canceling Trigger.dev run ${triggerRunId}`)
				await runs.cancel(triggerRunId)
				consola.info(`Successfully canceled run ${triggerRunId}`)
			} catch (cancelError) {
				consola.warn("Failed to cancel Trigger.dev run:", cancelError)
				// Continue anyway to mark as canceled
			}
		}

		// Update conversation_analysis and interview status
		await admin
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

		consola.info(`Canceled analysis for interview ${interviewId}`)

		return Response.json({ success: true, message: "Analysis canceled successfully" })
	} catch (error) {
		consola.error("Cancel analysis API error:", error)
		return Response.json(
			{ error: error instanceof Error ? error.message : "Failed to cancel analysis" },
			{ status: 500 }
		)
	}
}
