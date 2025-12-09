import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server"

/**
 * Reprocess an interview that has transcript but no analysis
 * OR re-transcribe if media exists but no transcript
 * POST /api/reprocess-interview
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

		// 1. Get interview details
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, title, transcript, transcript_formatted, media_url, account_id, project_id, created_by")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			consola.error("Interview not found:", interviewError)
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		// Check if we have transcript OR media to work with
		if (!interview.transcript && !interview.media_url) {
			return Response.json(
				{
					error: "Interview has neither transcript nor media to process",
				},
				{ status: 400 }
			)
		}

		consola.info("Reprocessing interview:", {
			id: interview.id,
			title: interview.title,
			hasTranscript: !!interview.transcript,
			hasFormattedTranscript: !!interview.transcript_formatted,
			hasMedia: !!interview.media_url,
		})

		// 2. Update interview status to processing
		await supabase.from("interviews").update({ status: "processing" }).eq("id", interviewId)

		// 3. ALWAYS re-transcribe from media if available, otherwise use transcript
		let transcriptData: Record<string, unknown>

		if (interview.media_url) {
			// ALWAYS re-transcribe from media when reprocessing
			// This ensures fresh, accurate transcripts with proper speaker diarization
			consola.info("Reprocess: Re-transcribing from media_url", {
				hasTranscript: !!interview.transcript,
				mediaUrl: `${interview.media_url.substring(0, 50)}...`,
			})

			transcriptData = {
				needs_transcription: true,
				media_url: interview.media_url,
				file_type: "media",
			}
		} else if (interview.transcript) {
			// No media available - use existing transcript as fallback
			consola.info("Reprocess: No media available, using existing transcript", {
				transcriptLength: interview.transcript.length,
			})

			transcriptData = {
				full_transcript: interview.transcript,
				speaker_transcripts: [
					{
						speaker: "Speaker",
						text: interview.transcript,
						start: 0,
						end: null,
					},
				],
				confidence: 0.9,
				audio_duration: 0,
				processing_duration: 0,
				file_type: "text",
			}
		} else {
			// This shouldn't happen due to earlier check, but for type safety
			throw new Error("No transcript or media available")
		}

		// 4. Trigger analysis pipeline (will handle transcription if needed)
		const result = await createAndProcessAnalysisJob({
			interviewId: interview.id,
			transcriptData,
			customInstructions: "",
			adminClient: supabase,
			mediaUrl: interview.media_url || "",
			initiatingUserId: interview.created_by,
			langfuseParent: undefined,
		})

		const needsTranscription = !interview.transcript && !!interview.media_url

		consola.success("Interview reprocessing started:", {
			interviewId: interview.id,
			runId: result.runId,
			needsTranscription,
		})

		return Response.json({
			success: true,
			interviewId: interview.id,
			runId: result.runId,
			needsTranscription,
			message: needsTranscription
				? "Interview transcription and analysis started via Trigger.dev"
				: "Interview analysis started with existing transcript",
		})
	} catch (error) {
		consola.error("Failed to reprocess interview:", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
