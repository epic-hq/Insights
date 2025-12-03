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
	const analysisJobId = formData.get("analysisJobId") as string

	if (!runId || !analysisJobId) {
		return Response.json({ error: "Missing runId or analysisJobId" }, { status: 400 })
	}

	try {
		const adminClient = createSupabaseAdminClient()

		// Verify the analysis job belongs to the user and get interview info
		const { data: analysisJob, error: jobError } = await adminClient
			.from("analysis_jobs" as any)
			.select("id, interview_id, status, trigger_run_id")
			.eq("id", analysisJobId)
			.single()

		if (jobError || !analysisJob) {
			return Response.json({ error: "Analysis job not found" }, { status: 404 })
		}

		// Verify the run ID matches
		if (analysisJob.trigger_run_id !== runId) {
			return Response.json({ error: "Run ID mismatch" }, { status: 400 })
		}

		// Check if the analysis job is in a cancellable state
		const cancellableStatuses = ["pending", "in_progress", "queued"]
		if (!cancellableStatuses.includes(analysisJob.status)) {
			return Response.json({ error: "Analysis job is not in a cancellable state" }, { status: 400 })
		}

		consola.info(`Cancelling analysis run ${runId} for job ${analysisJobId}`)

		// Cancel the Trigger.dev run
		try {
			await runs.cancel(runId)
			consola.info(`Successfully canceled Trigger.dev run ${runId}`)
		} catch (cancelError) {
			consola.warn("Failed to cancel Trigger.dev run:", cancelError)
			// Continue anyway to mark job as canceled in our database
		}

		// Update analysis job status to canceled
		const { error: updateError } = await adminClient
			.from("analysis_jobs" as any)
			.update({
				status: "canceled",
				status_detail: "Canceled by user",
				last_error: "Analysis canceled by user",
				updated_at: new Date().toISOString(),
			})
			.eq("id", analysisJobId)

		if (updateError) {
			consola.error("Failed to update analysis job status", updateError)
			return Response.json({ error: "Failed to update analysis job" }, { status: 500 })
		}

		// Update interview status to error
		const { error: interviewUpdateError } = await adminClient
			.from("interviews" as any)
			.update({
				status: "error",
				updated_at: new Date().toISOString(),
			})
			.eq("id", analysisJob.interview_id)

		if (interviewUpdateError) {
			consola.warn("Failed to update interview status after cancellation", interviewUpdateError)
			// Don't fail the request for this
		}

		consola.info(`Successfully cancelled analysis run ${runId}`)
		return Response.json({ success: true, message: "Analysis cancelled successfully" })
	} catch (error) {
		consola.error("Failed to cancel analysis run", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: `Failed to cancel analysis: ${message}` }, { status: 500 })
	}
}
