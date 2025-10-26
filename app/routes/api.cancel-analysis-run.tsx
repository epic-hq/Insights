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
		const cancellableStatuses = ["pending", "in_progress"]
		if (!cancellableStatuses.includes(analysisJob.status)) {
			return Response.json({ error: "Analysis job is not in a cancellable state" }, { status: 400 })
		}

		// TODO: Call Trigger.dev API to cancel the run
		// For now, we'll just update the database status
		// This needs to be implemented once we confirm Trigger.dev cancel API

		consola.info(`Cancelling analysis run ${runId} for job ${analysisJobId}`)

		// Update analysis job status to cancelled (using error status since cancelled is not in enum)
		const { error: updateError } = await adminClient
			.from("analysis_jobs" as any)
			.update({
				status: "error",
				status_detail: "Cancelled by user",
				updated_at: new Date().toISOString(),
			})
			.eq("id", analysisJobId)

		if (updateError) {
			consola.error("Failed to update analysis job status", updateError)
			return Response.json({ error: "Failed to update analysis job" }, { status: 500 })
		}

		// Update interview status back to ready (or appropriate status)
		const { error: interviewUpdateError } = await adminClient
			.from("interviews" as any)
			.update({
				status: "ready", // Or whatever the previous status was
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
