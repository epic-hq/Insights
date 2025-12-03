import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { extractEvidenceAndPeopleTask } from "~/../../src/trigger/interview/extractEvidenceAndPeople"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

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
			return Response.json({ error: "No transcript available. Please upload or transcribe first." }, { status: 400 })
		}

		const formattedTranscriptData = safeSanitizeTranscriptPayload(interview.transcript_formatted)
		const admin = createSupabaseAdminClient()

		try {
			// Get current conversation_analysis
			const conversationAnalysis = (interview.conversation_analysis as any) || {}

			// Update conversation_analysis for reprocessing
			await admin
				.from("interviews")
				.update({
					status: "processing",
					conversation_analysis: {
						...conversationAnalysis,
						transcript_data: formattedTranscriptData as any,
						status_detail: "Re-extracting evidence from transcript",
						current_step: "evidence",
					},
				})
				.eq("id", interviewId)

			consola.log("Interview updated for evidence reprocessing:", interviewId)

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

			// Check if we should use the v2 modular workflow
			const useV2Workflow = process.env.ENABLE_MODULAR_WORKFLOW === "true"

			let handle: { id: string }

			if (useV2Workflow) {
				// Use v2 orchestrator with resumeFrom: "evidence"
				consola.info("Using v2 orchestrator with resumeFrom: 'evidence'")

				// Generate fresh presigned URL from R2 key if needed
				let mediaUrlForTask = interview.media_url || ""
				if (mediaUrlForTask && !mediaUrlForTask.startsWith("http://") && !mediaUrlForTask.startsWith("https://")) {
					const { createR2PresignedUrl } = await import("~/utils/r2.server")
					const presigned = createR2PresignedUrl({
						key: mediaUrlForTask,
						expiresInSeconds: 24 * 60 * 60, // 24 hours
					})
					if (presigned) {
						mediaUrlForTask = presigned.url
						consola.log(`Generated presigned URL for evidence reprocessing: ${interviewId}`)
					}
				}

				handle = await tasks.trigger("interview.v2.orchestrator", {
					analysisJobId: interviewId, // Use interview ID
					metadata,
					transcriptData: formattedTranscriptData as any,
					mediaUrl: mediaUrlForTask,
					existingInterviewId: interviewId,
					resumeFrom: "evidence", // Skip upload/transcription, start from evidence extraction
				})
			} else {
				// Use v1 task (legacy)
				consola.info("Using v1 extract-evidence-and-people task")

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

				handle = await tasks.trigger<typeof extractEvidenceAndPeopleTask>("interview.extract-evidence-and-people", {
					interview: interview as any,
					transcriptData: formattedTranscriptData as any,
					fullTranscript: "", // Legacy field, not used in AI extraction
					language,
					metadata,
					analysisJobId: interviewId, // Use interview ID
					userCustomInstructions: null,
				})
			}

			// Store trigger_run_id in conversation_analysis
			await admin
				.from("interviews")
				.update({
					conversation_analysis: {
						...conversationAnalysis,
						trigger_run_id: handle.id,
						status_detail: "Extracting evidence from transcript",
					},
				})
				.eq("id", interviewId)

			consola.info(`Evidence reprocessing triggered: ${handle.id} (using ${useV2Workflow ? "v2" : "v1"} workflow)`)

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
