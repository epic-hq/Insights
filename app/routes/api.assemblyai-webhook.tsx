import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

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
			status: payload.status 
		})

		// Use service role client for webhook operations (no user context)
		const { client: supabase } = getServerClient(request, { useServiceRole: true })

		// Find the upload job by AssemblyAI transcript ID
		const { data: uploadJob, error: uploadJobError } = await supabase
			.from("upload_jobs")
			.select("*")
			.eq("assemblyai_id", payload.transcript_id)
			.single()

		if (uploadJobError || !uploadJob) {
			consola.error("Upload job not found for transcript:", payload.transcript_id, uploadJobError)
			return Response.json({ error: "Upload job not found" }, { status: 404 })
		}

		const interviewId = uploadJob.interview_id

		if (payload.status === "completed") {
			// Fetch full transcript data from AssemblyAI
			const apiKey = process.env.ASSEMBLYAI_API_KEY
			if (!apiKey) {
				throw new Error("AssemblyAI API key not configured")
			}

			const transcriptResp = await fetch(`https://api.assemblyai.com/v2/transcript/${payload.transcript_id}`, {
				headers: { Authorization: apiKey }
			})

			if (!transcriptResp.ok) {
				throw new Error(`Failed to fetch transcript: ${transcriptResp.status}`)
			}

			const transcriptData = await transcriptResp.json()
			consola.log("Retrieved transcript data, length:", transcriptData.text?.length || 0)

			// Create transcript data object matching expected format
			const formattedTranscriptData = {
				full_transcript: transcriptData.text,
				confidence: transcriptData.confidence,
				audio_duration: transcriptData.audio_duration,
				processing_duration: 0,
				file_type: 'audio',
				assemblyai_id: payload.transcript_id,
				original_filename: uploadJob.file_name
			}

			// Update interview with transcript data
			const { error: interviewUpdateError } = await supabase
				.from("interviews")
				.update({
					status: "transcribed",
					transcript: transcriptData.text,
					transcript_formatted: formattedTranscriptData,
					duration_min: transcriptData.audio_duration 
						? Math.round(transcriptData.audio_duration / 60) 
						: null
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
					status_detail: "Transcription completed"
				})
				.eq("id", uploadJob.id)

			// Create analysis job to trigger insight extraction
			const customInstructions = uploadJob.custom_instructions || ""
			
			const { error: analysisJobError } = await supabase
				.from("analysis_jobs")
				.insert({
					interview_id: interviewId,
					transcript_data: formattedTranscriptData,
					custom_instructions: customInstructions,
					status: 'pending',
					status_detail: 'Queued for analysis'
				})

			if (analysisJobError) {
				throw new Error(`Failed to create analysis job: ${analysisJobError.message}`)
			}

			consola.log("Successfully processed webhook and queued analysis for interview:", interviewId)

		} else if (payload.status === "failed" || payload.status === "error") {
			// Handle transcription failure
			consola.error("AssemblyAI transcription failed:", payload.transcript_id)

			// Update interview status
			await supabase
				.from("interviews")
				.update({
					status: "error"
				})
				.eq("id", interviewId)

			// Mark upload job as failed
			await supabase
				.from("upload_jobs")
				.update({
					status: "error",
					status_detail: "Transcription failed",
					last_error: `AssemblyAI transcription failed with status: ${payload.status}`
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