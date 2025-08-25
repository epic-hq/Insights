import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
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
			const { error: interviewUpdateError } = await supabase
				.from("interviews")
				.update({
					status: "transcribed",
					transcript: transcriptData.text,
					transcript_formatted: formattedTranscriptData,
					duration_min: transcriptData.audio_duration ? Math.round(transcriptData.audio_duration / 60) : null,
				})
				.eq("id", interviewId)

			if (interviewUpdateError) {
				throw new Error(`Failed to update interview: ${interviewUpdateError.message}`)
			}

			// Mark upload job as complete
			await supabase
				.from("upload_jobs")
				.update({
					status: "done",
					status_detail: "Transcription completed",
				})
				.eq("id", uploadJob.id)

			// Create analysis job and process immediately
			const customInstructions = uploadJob.custom_instructions || ""

			const { data: analysisJob, error: analysisJobError } = await supabase
				.from("analysis_jobs")
				.insert({
					interview_id: interviewId,
					transcript_data: formattedTranscriptData,
					custom_instructions: customInstructions,
					status: "in_progress",
					status_detail: "Processing with AI",
				})
				.select()
				.single()

			if (analysisJobError || !analysisJob) {
				throw new Error(`Failed to create analysis job: ${analysisJobError?.message}`)
			}

			consola.log("Created analysis job, processing immediately:", analysisJob.id)

			// Update interview status to processing before starting analysis
			await supabase.from("interviews").update({ status: "processing" }).eq("id", interviewId)

			// Process analysis immediately using complete processInterviewTranscript function
			try {
				// Get interview details to construct metadata
				const { data: interview, error: interviewFetchError } = await supabase
					.from("interviews")
					.select("*")
					.eq("id", interviewId)
					.single()

				if (interviewFetchError || !interview) {
					throw new Error(`Failed to fetch interview details: ${interviewFetchError?.message}`)
				}

				// Import the webhook-specific processing function that uses admin client
				const { processInterviewTranscriptWithAdminClient } = await import("~/utils/processInterview.server")

				// Construct metadata from interview record (convert null to undefined for type compatibility)
				// Note: interview.account_id is actually user.sub (personal ownership)
				const metadata = {
					accountId: interview.account_id,
					userId: interview.account_id, // This is user.sub for audit fields
					projectId: interview.project_id || undefined,
					interviewTitle: interview.title || undefined,
					interviewDate: interview.interview_date || undefined,
					participantName: interview.participant_pseudonym || undefined,
					durationMin: interview.duration_min || undefined,
					fileName: formattedTranscriptData.original_filename || undefined,
				}

				consola.log("Starting complete interview processing for interview:", interviewId)

				// Call the admin client processing function (no mock request needed)
				await processInterviewTranscriptWithAdminClient({
					metadata,
					mediaUrl: interview.media_url || "",
					transcriptData: formattedTranscriptData,
					userCustomInstructions: customInstructions,
					adminClient: supabase,
					existingInterviewId: interviewId,
				})

				consola.log("Complete interview processing completed for interview:", interviewId)

				// Mark analysis job as complete
				await supabase
					.from("analysis_jobs")
					.update({
						status: "done",
						status_detail: "Analysis completed",
						progress: 100,
					})
					.eq("id", analysisJob.id)

				// Update interview status to ready
				await supabase.from("interviews").update({ status: "ready" }).eq("id", interviewId)

				consola.log("Successfully processed analysis for interview:", interviewId)
			} catch (analysisError) {
				consola.error("Analysis processing failed:", analysisError)

				// Mark analysis job as error
				await supabase
					.from("analysis_jobs")
					.update({
						status: "error",
						status_detail: "Analysis failed",
						last_error: analysisError instanceof Error ? analysisError.message : "Unknown error",
					})
					.eq("id", analysisJob.id)

				// Update interview status to error
				await supabase.from("interviews").update({ status: "error" }).eq("id", interviewId)

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
					status: "error",
				})
				.eq("id", interviewId)

			// Mark upload job as failed
			await supabase
				.from("upload_jobs")
				.update({
					status: "error",
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
