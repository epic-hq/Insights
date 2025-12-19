/**
 * API endpoint to check and resume stuck transcriptions
 *
 * When AssemblyAI webhook fails (e.g., ngrok tunnel down), interviews get stuck
 * in "transcribing" state. This endpoint polls AssemblyAI directly and continues
 * processing if the transcription is complete.
 *
 * Called by ProcessingScreen when an interview appears stuck.
 */

import { tasks } from "@trigger.dev/sdk/v3"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { Json } from "~/../supabase/types"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { interviewId } = await request.json()

		if (!interviewId) {
			return Response.json({ error: "Missing interviewId" }, { status: 400 })
		}

		const supabase = createSupabaseAdminClient()

		// Fetch interview with transcription metadata
		const { data: interview, error: fetchError } = await supabase
			.from("interviews")
			.select("id, status, transcript, conversation_analysis, account_id, project_id, title, participant_pseudonym")
			.eq("id", interviewId)
			.single()

		if (fetchError || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		const conversationAnalysis = (interview.conversation_analysis as Record<string, unknown>) || {}
		const transcriptData = (conversationAnalysis.transcript_data as Record<string, unknown>) || {}
		const assemblyaiId = transcriptData.assemblyai_id as string | undefined

		// Check if already processed
		if (interview.status === "ready" || interview.status === "transcribed") {
			return Response.json({
				success: true,
				status: interview.status,
				message: "Already processed",
			})
		}

		// Check if there's a pending AssemblyAI transcription
		if (!assemblyaiId) {
			return Response.json({
				success: false,
				status: interview.status,
				message: "No pending transcription found",
			})
		}

		// Check if orchestrator is already running
		const existingRunId = conversationAnalysis.trigger_run_id as string | undefined
		if (existingRunId) {
			return Response.json({
				success: true,
				status: "processing",
				runId: existingRunId,
				message: "Orchestrator already running",
			})
		}

		// Poll AssemblyAI for transcription status
		const apiKey = process.env.ASSEMBLYAI_API_KEY
		if (!apiKey) {
			return Response.json({ error: "AssemblyAI not configured" }, { status: 500 })
		}

		consola.info(`[check-transcription] Polling AssemblyAI for ${assemblyaiId}`)

		const assemblyResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${assemblyaiId}`, {
			headers: { Authorization: apiKey },
		})

		if (!assemblyResponse.ok) {
			return Response.json({ error: `AssemblyAI request failed: ${assemblyResponse.status}` }, { status: 500 })
		}

		const assemblyData = await assemblyResponse.json()
		consola.info(`[check-transcription] AssemblyAI status: ${assemblyData.status}`)

		if (assemblyData.status === "queued" || assemblyData.status === "processing") {
			// Still processing, nothing to do
			return Response.json({
				success: true,
				status: "transcribing",
				assemblyStatus: assemblyData.status,
				message: "Transcription still in progress",
			})
		}

		if (assemblyData.status === "error") {
			// Transcription failed
			await supabase
				.from("interviews")
				.update({
					status: "error" as const,
					conversation_analysis: {
						...conversationAnalysis,
						status_detail: "Transcription failed",
						last_error: assemblyData.error || "AssemblyAI transcription failed",
					} as Json,
				})
				.eq("id", interviewId)

			return Response.json({
				success: false,
				status: "error",
				message: assemblyData.error || "Transcription failed",
			})
		}

		if (assemblyData.status === "completed") {
			consola.info(`[check-transcription] Transcription complete, resuming processing for ${interviewId}`)

			// Format transcript data
			const formattedTranscriptData = safeSanitizeTranscriptPayload({
				full_transcript: assemblyData.text,
				confidence: assemblyData.confidence,
				audio_duration: assemblyData.audio_duration,
				processing_duration: 0,
				file_type: "audio",
				assembly_id: assemblyaiId,
				original_filename: transcriptData.file_name as string | undefined,
				speaker_transcripts: assemblyData.utterances || [],
				topic_detection: assemblyData.iab_categories_result || {},
				sentiment_analysis_results: assemblyData.sentiment_analysis_results || [],
				auto_chapters: assemblyData.auto_chapters || assemblyData.chapters || [],
				language_code: assemblyData.language_code,
			})

			// Update interview with transcript
			await supabase
				.from("interviews")
				.update({
					status: "transcribed" as const,
					transcript: assemblyData.text,
					transcript_formatted: formattedTranscriptData as Json,
					duration_sec: assemblyData.audio_duration ? Math.round(assemblyData.audio_duration) : null,
				})
				.eq("id", interviewId)

			// Check if this is a voice memo (skip analysis)
			const isVoiceMemo = conversationAnalysis.voice_memo_only === true
			if (isVoiceMemo) {
				await supabase
					.from("interviews")
					.update({ status: "ready" as const })
					.eq("id", interviewId)

				return Response.json({
					success: true,
					status: "ready",
					message: "Voice memo transcription complete",
				})
			}

			// Trigger orchestrator for full analysis
			const customInstructions = (conversationAnalysis.custom_instructions as string) || ""
			const uploadMetadata = {
				file_name: transcriptData.file_name as string | undefined,
				external_url: transcriptData.external_url as string | undefined,
			}

			// Fetch participant info
			let participantName: string | undefined
			const { data: interviewPeople } = await supabase
				.from("interview_people")
				.select("display_name, role, people(name)")
				.eq("interview_id", interviewId)

			if (interviewPeople?.length) {
				const participant = interviewPeople.find((p) => p.role !== "interviewer") || interviewPeople[0]
				participantName =
					participant?.display_name || (participant?.people as { name: string | null } | null)?.name || undefined
			}
			if (!participantName && interview.participant_pseudonym) {
				const pseudonym = interview.participant_pseudonym
				if (!pseudonym.match(/^(Participant|Anonymous)\s*\d*$/i)) {
					participantName = pseudonym
				}
			}

			const metadata = {
				accountId: interview.account_id,
				userId: undefined,
				projectId: interview.project_id ?? undefined,
				interviewTitle: interview.title ?? undefined,
				fileName: uploadMetadata.file_name,
				participantName,
			}

			// Update status before triggering
			await supabase
				.from("interviews")
				.update({
					status: "processing" as const,
					conversation_analysis: {
						...conversationAnalysis,
						current_step: "upload",
						status_detail: "Transcription complete (via polling), starting analysis",
						completed_steps: [...((conversationAnalysis.completed_steps as string[]) || []), "transcription"],
					} as Json,
				})
				.eq("id", interviewId)

			// Trigger v2 orchestrator with idempotency key
			const idempotencyKey = `interview-orchestrator-${interviewId}`

			const handle = await tasks.trigger(
				"interview.v2.orchestrator",
				{
					analysisJobId: interviewId,
					metadata,
					transcriptData: formattedTranscriptData,
					mediaUrl: uploadMetadata.external_url || "",
					existingInterviewId: interviewId,
					userCustomInstructions: customInstructions,
				},
				{ idempotencyKey, idempotencyKeyTTL: "24h" }
			)

			// Store trigger run ID
			await supabase
				.from("interviews")
				.update({
					conversation_analysis: {
						...conversationAnalysis,
						trigger_run_id: handle.id,
						current_step: "upload",
						status_detail: "Analysis started",
						completed_steps: [...((conversationAnalysis.completed_steps as string[]) || []), "transcription"],
					} as Json,
				})
				.eq("id", interviewId)

			consola.success(`[check-transcription] Triggered orchestrator: ${handle.id}`)

			return Response.json({
				success: true,
				status: "processing",
				runId: handle.id,
				message: "Resumed processing via polling fallback",
			})
		}

		// Unknown status
		return Response.json({
			success: false,
			status: interview.status,
			assemblyStatus: assemblyData.status,
			message: `Unknown AssemblyAI status: ${assemblyData.status}`,
		})
	} catch (error) {
		consola.error("[check-transcription] Error:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Check failed" }, { status: 500 })
	}
}
