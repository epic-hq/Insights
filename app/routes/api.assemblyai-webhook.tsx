import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { Database, Json } from "~/../supabase/types"
import { createSupabaseAdminClient } from "~/lib/supabase/server"

interface AssemblyAIWebhookPayload {
	transcript_id: string
	status: "completed" | "failed" | "error"
	text?: string
	confidence?: number
	audio_duration?: number
	metadata?: {
		interview_id: string
		account_id: string
		project_id: string
		custom_instructions: string
	}
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const payload: AssemblyAIWebhookPayload = await request.json()
		consola.log("Received AssemblyAI webhook:", {
			transcript_id: payload.transcript_id,
			status: payload.status,
		})

		// Use admin client for webhook operations (no user context)
		const supabase = createSupabaseAdminClient()

		// Find the upload job by AssemblyAI transcript ID
		const { data: uploadJob, error: uploadJobError } = await supabase
			.from("upload_jobs")
			.select("*")
			.eq("assemblyai_id", payload.transcript_id)
			.single()

		if (uploadJobError || !uploadJob) {
			consola.error("Upload job query failed for transcript:", payload.transcript_id)
			consola.error("Error details:", {
				error: uploadJobError,
				hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
				supabaseUrl: process.env.SUPABASE_URL,
			})
			return Response.json({ error: "Upload job not found" }, { status: 404 })
		}

		// Idempotency check - prevent duplicate processing
		if (uploadJob.status === "done") {
			consola.log("Upload job already processed, skipping:", payload.transcript_id)
			return Response.json({ success: true, message: "Already processed" })
		}

		const interviewId = uploadJob.interview_id

		if (payload.status === "completed") {
			// Fetch full transcript data from AssemblyAI
			const apiKey = process.env.ASSEMBLYAI_API_KEY
			if (!apiKey) {
				throw new Error("AssemblyAI API key not configured")
			}

			consola.log("AssemblyAI Webhook: Fetching transcript data for transcript:", payload.transcript_id)

			const transcriptResp = await fetch(`https://api.assemblyai.com/v2/transcript/${payload.transcript_id}`, {
				headers: { Authorization: apiKey },
			})

			if (!transcriptResp.ok) {
				throw new Error(`Failed to fetch transcript: ${transcriptResp.status}`)
			}

			const transcriptData = await transcriptResp.json()
			consola.log("AssemblyAI Webhook: Retrieved transcript data, length:", transcriptData.text?.length || 0)

			// Audio file already stored at upload time in onboarding flow
			// No need to download from AssemblyAI since we have the original file in Supabase Storage
			consola.log("Audio file already stored during upload - skipping AssemblyAI download")

			// Create transcript data object matching expected format
			const formattedTranscriptData = {
				full_transcript: transcriptData.text,
				confidence: transcriptData.confidence,
				audio_duration: transcriptData.audio_duration,
				processing_duration: 0,
				file_type: "audio",
				assemblyai_id: payload.transcript_id,
				original_filename: uploadJob.file_name,
				speaker_transcripts: transcriptData.utterances || [],
				topic_detection: transcriptData.iab_categories_result || {},
			}

			// Update interview with transcript data - set to transcribed first
			const updateData: Database["public"]["Tables"]["interviews"]["Update"] = {
				status: "transcribed",
				transcript: transcriptData.text,
				transcript_formatted: formattedTranscriptData as Json,
				duration_sec: transcriptData.audio_duration ? Math.round(transcriptData.audio_duration) : null,
			}

			const { error: interviewUpdateError } = await supabase.from("interviews").update(updateData).eq("id", interviewId)

			if (interviewUpdateError) {
				throw new Error(`Failed to update interview: ${interviewUpdateError.message}`)
			}

			// Mark upload job as complete
			await supabase
				.from("upload_jobs")
				.update({
					status: "done" as const,
					status_detail: "Transcription completed",
				})
				.eq("id", uploadJob.id)

			// Create analysis job and process immediately
			const customInstructions = uploadJob.custom_instructions || ""

			try {
				const { createAndProcessAnalysisJob } = await import("~/utils/processInterviewAnalysis.server")

				await createAndProcessAnalysisJob({
					interviewId,
					transcriptData: formattedTranscriptData,
					customInstructions,
					adminClient: supabase,
					initiatingUserId: uploadJob?.created_by ?? null,
				})

				consola.log("Successfully processed analysis for interview:", interviewId)
			} catch (analysisError) {
				consola.error("Analysis processing failed:", analysisError)
				// Continue webhook processing - don't fail the webhook for analysis errors
				consola.log("Webhook completed despite analysis error")
			}
		} else if (payload.status === "failed" || payload.status === "error") {
			// Handle transcription failure
			consola.error("AssemblyAI transcription failed:", payload.transcript_id)

			// Update interview status
			await supabase
				.from("interviews")
				.update({
					status: "error" as const,
				})
				.eq("id", interviewId)

			// Mark upload job as failed
			await supabase
				.from("upload_jobs")
				.update({
					status: "error" as const,
					status_detail: "Transcription failed",
					last_error: `AssemblyAI transcription failed with status: ${payload.status}`,
				})
				.eq("id", uploadJob.id)
		}

		return Response.json({ success: true })
	} catch (error) {
		consola.error("AssemblyAI webhook processing failed:", error)
		return Response.json(
			{ error: error instanceof Error ? error.message : "Webhook processing failed" },
			{ status: 500 }
		)
	}
}
