import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { Json } from "~/../supabase/types"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	consola.log("Analysis retry API called ")
	const formData = await request.formData()
	const interviewId = formData.get("interview_id")
	const customInstructions = formData.get("custom_instructions")

	try {
		// Get user ID from JWT claims (fast) with DB fallback
		const { getAuthenticatedUser } = await import("~/lib/supabase/server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}
		const userId = claims.sub

		const { client: userDb } = getServerClient(request)

		consola.log("Analysis retry API called ", interviewId, customInstructions)
		if (!interviewId) {
			return Response.json({ error: "interview_id is required" }, { status: 400 })
		}

		// RLS-guarded fetch: ensure the user can see/control this interview
		const { data: interview, error: interviewErr } = await userDb
			.from("interviews")
			.select("*")
			.eq("id", interviewId)
			.single()

		if (interviewErr || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		if (!interview.transcript_formatted) {
			return Response.json(
				{ error: "No transcript available to analyze. Please re-upload or re-transcribe." },
				{ status: 400 }
			)
		}

		const formattedTranscriptData = safeSanitizeTranscriptPayload(interview.transcript_formatted)

		// Create a new analysis job
		const admin = createSupabaseAdminClient()
		const { data: analysisJob, error: analysisJobError } = await admin
			.from("analysis_jobs")
			.insert({
				interview_id: interviewId,
				transcript_data: formattedTranscriptData as unknown as Json,
				custom_instructions: customInstructions,
				status: "in_progress",
				status_detail: "User-triggered retry",
			})
			.select()
			.single()

		if (analysisJobError || !analysisJob) {
			throw new Error(`Failed to create analysis job: ${analysisJobError?.message}`)
		}

		// Move interview into processing state
		await admin.from("interviews").update({ status: "processing" }).eq("id", interviewId)

		// Build metadata expected by the processor
		const metadata = {
			accountId: interview.account_id,
			userId,
			projectId: interview.project_id || undefined,
			interviewTitle: interview.title || undefined,
			interviewDate: interview.interview_date || undefined,
			participantName: interview.participant_pseudonym || undefined,
			duration_sec: interview.duration_sec || undefined,
			fileName: (formattedTranscriptData as { original_filename?: string }).original_filename || undefined,
		}

		// Kick off processing
		const { processInterviewTranscriptWithAdminClient } = await import("~/utils/processInterview.server")

		try {
			await processInterviewTranscriptWithAdminClient({
				metadata,
				mediaUrl: interview.media_url || "",
				transcriptData: formattedTranscriptData as unknown as Record<string, unknown>,
				userCustomInstructions: customInstructions,
				adminClient: admin,
				existingInterviewId: interviewId,
			})

			// Success: mark job + interview
			await admin
				.from("analysis_jobs")
				.update({ status: "done", status_detail: "Analysis completed", progress: 100 })
				.eq("id", analysisJob.id)

			await admin.from("interviews").update({ status: "ready" }).eq("id", interviewId)

			return Response.json({ success: true })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			consola.error("User-triggered analysis retry failed:", msg)

			await admin
				.from("analysis_jobs")
				.update({ status: "error", status_detail: "Analysis failed", last_error: msg })
				.eq("id", analysisJob.id)

			await admin.from("interviews").update({ status: "error" }).eq("id", interviewId)

			return Response.json({ error: msg }, { status: 500 })
		}
	} catch (error) {
		consola.error("Retry API error:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 })
	}
}
