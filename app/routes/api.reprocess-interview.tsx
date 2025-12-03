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

		// 3. Create transcript data object (or trigger transcription if needed)
		let transcriptData: Record<string, unknown>

		if (interview.transcript) {
			// Have transcript - use it directly
			const formatted = interview.transcript_formatted as Record<string, unknown> | null

			// Check if formatted data is usable (has speaker_transcripts with data)
			const hasUsableFormatted =
				formatted &&
				Array.isArray(formatted.speaker_transcripts) &&
				formatted.speaker_transcripts.length > 0

			consola.info("Reprocess: Checking formatted transcript", {
				hasFormatted: !!formatted,
				hasUsableFormatted,
				formattedKeys: formatted ? Object.keys(formatted) : [],
				hasSpeakerTranscripts: formatted ? 'speaker_transcripts' in formatted : false,
				speakerTranscriptsLength: formatted && Array.isArray(formatted.speaker_transcripts)
					? formatted.speaker_transcripts.length
					: 0,
				hasFullTranscript: formatted ? 'full_transcript' in formatted : false,
				transcriptLength: interview.transcript?.length ?? 0,
			})

			transcriptData = hasUsableFormatted
				? {
						...formatted,
						// Ensure full_transcript is populated for backwards compatibility
						full_transcript: formatted.full_transcript || interview.transcript,
					}
				: {
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

			consola.info("Reprocess: Prepared transcriptData", {
				hasFormattedTranscript: !!formatted,
				fullTranscriptLength: (transcriptData.full_transcript as string)?.length ?? 0,
				hasSpeakerTranscripts: 'speaker_transcripts' in transcriptData,
				speakerTranscriptsCount: Array.isArray(transcriptData.speaker_transcripts)
					? transcriptData.speaker_transcripts.length
					: 0,
				keys: Object.keys(transcriptData),
			})
		} else if (interview.media_url) {
			// No transcript but have media - need to transcribe first via Trigger.dev
			consola.info("No transcript found - triggering Trigger.dev pipeline with media URL")
			transcriptData = {
				needs_transcription: true,
				media_url: interview.media_url,
				file_type: "media",
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
