import { runs } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"

/**
 * Cancel a running analysis job
 * This will:
 * 1. Cancel the Trigger.dev run
 * 2. Mark the analysis job as canceled
 * 3. Update the interview status to error
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	consola.log("Cancel analysis API called")
	const formData = await request.formData()
	const analysisJobId = formData.get("analysis_job_id") as string
	const interviewId = formData.get("interview_id") as string

	if (!analysisJobId && !interviewId) {
		return Response.json({ error: "analysis_job_id or interview_id is required" }, { status: 400 })
	}

	try {
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { client: userDb } = getServerClient(request)
		const admin = createSupabaseAdminClient()

		// Get the analysis job
		let jobId = analysisJobId
		if (!jobId && interviewId) {
			// Find the latest in-progress job for this interview
			const { data: job } = await userDb
				.from("analysis_jobs")
				.select("id")
				.eq("interview_id", interviewId)
				.eq("status", "in_progress")
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle()

			if (job) {
				jobId = job.id
			}
		}

		if (!jobId) {
			return Response.json({ error: "No active analysis job found" }, { status: 404 })
		}

		// Get the full job details (with admin client for trigger_run_id)
		const { data: analysisJob, error: jobError } = await admin
			.from("analysis_jobs")
			.select("*")
			.eq("id", jobId)
			.single()

		if (jobError || !analysisJob) {
			return Response.json({ error: "Analysis job not found" }, { status: 404 })
		}

		// Verify user has access to this interview
		const { data: interview, error: interviewError } = await userDb
			.from("interviews")
			.select("id")
			.eq("id", analysisJob.interview_id)
			.single()

		if (interviewError || !interview) {
			return Response.json({ error: "Unauthorized or interview not found" }, { status: 403 })
		}

		// Cancel the Trigger.dev run if it exists
		if (analysisJob.trigger_run_id) {
			try {
				consola.info(`Canceling Trigger.dev run ${analysisJob.trigger_run_id}`)
				await runs.cancel(analysisJob.trigger_run_id)
				consola.info(`Successfully canceled run ${analysisJob.trigger_run_id}`)
			} catch (cancelError) {
				consola.warn(`Failed to cancel Trigger.dev run:`, cancelError)
				// Continue anyway to mark job as canceled
			}
		}

		// Update analysis job status
		await admin
			.from("analysis_jobs")
			.update({
				status: "canceled",
				status_detail: "Canceled by user",
				last_error: "Analysis canceled by user",
				updated_at: new Date().toISOString(),
			})
			.eq("id", jobId)

		// Update interview status
		await admin
			.from("interviews")
			.update({
				status: "error",
				updated_at: new Date().toISOString(),
			})
			.eq("id", analysisJob.interview_id)

		consola.info(`Canceled analysis job ${jobId}`)

		return Response.json({ success: true, message: "Analysis canceled successfully" })
	} catch (error) {
		consola.error("Cancel analysis API error:", error)
		return Response.json(
			{ error: error instanceof Error ? error.message : "Failed to cancel analysis" },
			{ status: 500 }
		)
	}
}
