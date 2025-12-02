import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

/**
 * Fix stuck interviews that have transcript but wrong status
 * POST /api/fix-stuck-interview
 * Body: { interviewId: string }
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { interviewId } = await request.json()

		if (!interviewId) {
			return Response.json({ error: "interviewId required" }, { status: 400 })
		}

		const supabase = createSupabaseAdminClient()

		// 1. Check current state
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			consola.error("Interview not found:", interviewError)
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		consola.info("Checking interview state:", {
			id: interview.id,
			status: interview.status,
			hasMedia: !!interview.media_url,
			hasTranscript: !!interview.transcript,
		})

		// 2. If interview has transcript but wrong status, fix it
		if (interview.transcript && interview.status !== "ready") {
			consola.info("Fixing interview status to 'ready'")

			const { error: updateError } = await supabase
				.from("interviews")
				.update({ status: "ready" })
				.eq("id", interviewId)

			if (updateError) {
				consola.error("Failed to update interview:", updateError)
				return Response.json({ error: "Failed to update interview" }, { status: 500 })
			}
		}

		// 3. Fix stuck upload_jobs
		const { data: uploadJobs } = await supabase
			.from("upload_jobs")
			.select("id, status")
			.eq("interview_id", interviewId)
			.in("status", ["pending", "in_progress"])

		if (uploadJobs && uploadJobs.length > 0) {
			consola.info(`Fixing ${uploadJobs.length} stuck upload jobs`)

			const { error: uploadError } = await supabase
				.from("upload_jobs")
				.update({
					status: "done" as const,
					status_detail: "Manually marked as complete",
				})
				.eq("interview_id", interviewId)
				.in("status", ["pending", "in_progress"])

			if (uploadError) {
				consola.error("Failed to update upload jobs:", uploadError)
			}
		}

		// 4. Fix stuck analysis_jobs
		const { data: analysisJobs } = await supabase
			.from("analysis_jobs")
			.select("id, status, current_step")
			.eq("interview_id", interviewId)
			.eq("status", "pending")

		if (analysisJobs && analysisJobs.length > 0) {
			consola.info(`Fixing ${analysisJobs.length} stuck analysis jobs`)

			const { error: analysisError } = await supabase
				.from("analysis_jobs")
				.update({
					status: "done" as const,
					status_detail: "Manually marked as complete",
					current_step: "complete",
				})
				.eq("interview_id", interviewId)
				.eq("status", "pending")

			if (analysisError) {
				consola.error("Failed to update analysis jobs:", analysisError)
			}
		}

		// 5. Return final state
		const { data: finalInterview } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single()

		consola.success("Interview fixed:", {
			id: finalInterview?.id,
			status: finalInterview?.status,
		})

		return Response.json({
			success: true,
			interview: finalInterview,
			message: "Interview status fixed",
		})
	} catch (error) {
		consola.error("Failed to fix interview:", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
