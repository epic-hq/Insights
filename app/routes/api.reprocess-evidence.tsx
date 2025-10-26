import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { tasks } from "@trigger.dev/sdk"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"
import type { extractEvidenceAndPeopleTask } from "~/../../src/trigger/interview/extractEvidenceAndPeople"

/**
 * Reprocess evidence extraction from existing transcript
 * Skips transcription, goes straight to evidence/people/facets extraction
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	consola.log("Reprocess evidence API called")
	const formData = await request.formData()
	const interviewId = formData.get("interview_id") as string

	try {
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}
		const userId = claims.sub

		const { client: userDb } = getServerClient(request)

		if (!interviewId) {
			return Response.json({ error: "interview_id is required" }, { status: 400 })
		}

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
				{ error: "No transcript available. Please upload or transcribe first." },
				{ status: 400 }
			)
		}

		const formattedTranscriptData = safeSanitizeTranscriptPayload(interview.transcript_formatted)
		const admin = createSupabaseAdminClient()

		try {
			const { data: analysisJob, error: analysisJobError } = await admin
				.from("analysis_jobs")
				.insert({
					interview_id: interviewId,
					transcript_data: formattedTranscriptData as any,
					status: "in_progress",
					status_detail: "Re-extracting evidence from transcript",
				})
				.select()
				.single()

			if (analysisJobError || !analysisJob) {
				throw new Error(`Failed to create analysis job: ${analysisJobError?.message}`)
			}

			consola.log("Analysis job created:", analysisJob.id)

			await admin.from("interviews").update({ status: "processing" }).eq("id", interviewId)

			const metadata = {
				accountId: interview.account_id,
				userId: userId ?? interview.updated_by ?? interview.created_by ?? undefined,
				projectId: interview.project_id || undefined,
				interviewTitle: interview.title || undefined,
				interviewDate: interview.interview_date || undefined,
				participantName: interview.participant_pseudonym || undefined,
				duration_sec: interview.duration_sec || undefined,
			}

			consola.info("Triggering evidence extraction directly (skipping transcription)")

			// Extract the necessary fields from transcript_formatted
			const transcriptFormatted = interview.transcript_formatted as any
			const language = transcriptFormatted?.language || transcriptFormatted?.detected_language || "en"

			// Get speaker transcripts with timing
			const speakerTranscriptsRaw = (formattedTranscriptData.speaker_transcripts ?? []) as any[]
			const speakerTranscripts = Array.isArray(speakerTranscriptsRaw) 
				? speakerTranscriptsRaw.map((u: any) => ({
						speaker: u.speaker ?? "",
						text: u.text ?? "",
						start: u.start ?? null,
						end: u.end ?? null,
				  }))
				: []

			consola.info(` Passing ${speakerTranscripts.length} speaker utterances with timing to AI for reprocessing`)

			const handle = await tasks.trigger<typeof extractEvidenceAndPeopleTask>(
				"interview.extract-evidence-and-people",
				{
					interview: interview as any,
					transcriptData: formattedTranscriptData as any,
					fullTranscript: "", // Legacy field, not used in AI extraction
					language,
					metadata,
					analysisJobId: analysisJob.id,
					userCustomInstructions: null,
				}
			)

			await admin.from("analysis_jobs").update({ trigger_run_id: handle.id }).eq("id", analysisJob.id)

			consola.info(`Evidence reprocessing triggered: ${handle.id}`)

			return Response.json({ success: true, runId: handle.id })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			consola.error("Evidence reprocessing failed:", msg)
			await admin.from("interviews").update({ status: "error" }).eq("id", interviewId)
			return Response.json({ error: msg }, { status: 500 })
		}
	} catch (error) {
		consola.error("Reprocess evidence API error:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 })
	}
}
