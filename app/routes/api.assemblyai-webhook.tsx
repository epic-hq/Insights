import consola from "consola"
import type { LangfuseTraceClient } from "langfuse"
import type { ActionFunctionArgs } from "react-router"
import type { Database, Json } from "~/../supabase/types"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

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

type TraceEndPayload = Parameters<LangfuseTraceClient["end"]>[0]

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const langfuse = getLangfuseClient()
	let trace: LangfuseTraceClient | undefined
	let traceEndPayload: TraceEndPayload | undefined

	try {
		const url = new URL(request.url)
		const mediaId = url.searchParams.get("media_id")
		const payload: AssemblyAIWebhookPayload = await request.json()
		consola.log("Received AssemblyAI webhook:", {
			transcript_id: payload.transcript_id,
			status: payload.status,
		})

		trace = (langfuse as any).trace?.({
			name: "webhook.assemblyai",
			metadata: {
				transcriptId: payload.transcript_id,
				status: payload.status,
			},
			input: {
				hasText: Boolean(payload.text),
				audioDuration: payload.audio_duration ?? null,
			},
		})

		// Use admin client for webhook operations (no user context)
		const supabase = createSupabaseAdminClient()

		// Find the upload job by AssemblyAI transcript ID
		const fetchUploadJobSpan = trace?.span?.({
			name: "supabase.upload-job.fetch",
			metadata: {
				transcriptId: payload.transcript_id,
			},
		})
		const { data: uploadJob, error: uploadJobError } = await supabase
			.from("upload_jobs")
			.select("*")
			.eq("assemblyai_id", payload.transcript_id)
			.single()

		if (uploadJobError || !uploadJob) {
			if (mediaId) {
				consola.warn("Media pipeline webhook received without upload job", {
					transcript_id: payload.transcript_id,
					media_id: mediaId,
				})
				return Response.json({ success: true, media_id: mediaId, status: payload.status }, { status: 202 })
			}

			consola.error("Upload job query failed for transcript:", payload.transcript_id)
			consola.error("Error details:", {
				error: uploadJobError,
				hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
				supabaseUrl: process.env.SUPABASE_URL,
			})
			fetchUploadJobSpan?.end?.({
				level: "ERROR",
				statusMessage: uploadJobError?.message ?? "Upload job not found",
			})
			traceEndPayload = { level: "ERROR", statusMessage: "Upload job not found" }
			return Response.json({ error: "Upload job not found" }, { status: 404 })
		}
		fetchUploadJobSpan?.end?.({
			output: {
				uploadJobId: uploadJob.id,
				interviewId: uploadJob.interview_id,
				status: uploadJob.status,
			},
		})
		trace?.update?.({
			metadata: {
				interviewId: uploadJob.interview_id,
			},
		})

		// Idempotency check - prevent duplicate processing
		if (uploadJob.status === "done") {
			consola.log("Upload job already processed, skipping:", payload.transcript_id)
			trace?.event?.({
				name: "upload-job.already-processed",
				metadata: {
					uploadJobId: uploadJob.id,
				},
			})
			traceEndPayload = {
				output: {
					uploadJobId: uploadJob.id,
					status: "already_processed",
				},
			}
			return Response.json({ success: true, message: "Already processed" })
		}

		const interviewId = uploadJob.interview_id

		if (payload.status === "completed") {
			// Fetch full transcript data from AssemblyAI
			const apiKey = process.env.ASSEMBLYAI_API_KEY
			if (!apiKey) {
				traceEndPayload = { level: "ERROR", statusMessage: "AssemblyAI API key not configured" }
				throw new Error("AssemblyAI API key not configured")
			}

			consola.log("AssemblyAI Webhook: Fetching transcript data for transcript:", payload.transcript_id)

			const transcriptFetchSpan = trace?.span?.({
				name: "assembly.transcript.fetch",
				metadata: {
					transcriptId: payload.transcript_id,
					interviewId,
				},
			})
			const transcriptResp = await fetch(`https://api.assemblyai.com/v2/transcript/${payload.transcript_id}`, {
				headers: { Authorization: apiKey },
			})

			if (!transcriptResp.ok) {
				const statusMessage = `Failed to fetch transcript: ${transcriptResp.status}`
				transcriptFetchSpan?.end?.({
					level: "ERROR",
					statusMessage,
				})
				traceEndPayload = { level: "ERROR", statusMessage }
				throw new Error(statusMessage)
			}

			const transcriptData = await transcriptResp.json()
			consola.log("AssemblyAI Webhook: Retrieved transcript data, length:", transcriptData.text?.length || 0)
			transcriptFetchSpan?.end?.({
				output: {
					length: transcriptData.text?.length ?? 0,
					audioDuration: transcriptData.audio_duration ?? null,
				},
			})

			// Audio file already stored at upload time in onboarding flow
			// No need to download from AssemblyAI since we have the original file in Cloudflare R2
			consola.log("Audio file already stored during upload - skipping AssemblyAI download")

			// Create transcript data object matching expected format
			const formattedTranscriptData = safeSanitizeTranscriptPayload({
				full_transcript: transcriptData.text,
				confidence: transcriptData.confidence,
				audio_duration: transcriptData.audio_duration,
				processing_duration: 0,
				file_type: "audio",
				assembly_id: payload.transcript_id,
				original_filename: uploadJob.file_name,
				speaker_transcripts: transcriptData.utterances || [],
				topic_detection: transcriptData.iab_categories_result || {},
				sentiment_analysis_results: transcriptData.sentiment_analysis_results || [],
				auto_chapters: transcriptData.auto_chapters || transcriptData.chapters || [],
				language_code: transcriptData.language_code,
			})

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

			const customInstructions = uploadJob.custom_instructions || ""

			// Check if analysis_job already exists (from onboarding flow)
			const { data: existingAnalysisJob } = await supabase
				.from("analysis_jobs")
				.select("id, status, current_step")
				.eq("interview_id", interviewId)
				.eq("status", "pending")
				.eq("current_step", "transcription")
				.maybeSingle()

			try {
				if (existingAnalysisJob) {
					// Update existing job and trigger orchestrator
					consola.info("Found existing analysis_job, updating:", existingAnalysisJob.id)

					await supabase
						.from("analysis_jobs")
						.update({
							transcript_data: formattedTranscriptData,
							status: "in_progress" as const,
							status_detail: "Transcription complete, starting analysis",
							current_step: "upload",
						})
						.eq("id", existingAnalysisJob.id)

					// Trigger orchestrator
					const { tasks } = await import("@trigger.dev/sdk")
					const { data: interview } = await supabase
						.from("interviews")
						.select("account_id, project_id, title")
						.eq("id", interviewId)
						.single()

					const metadata = {
						accountId: interview?.account_id,
						userId: uploadJob.created_by ?? undefined,
						projectId: interview?.project_id ?? undefined,
						interviewTitle: interview?.title ?? undefined,
						fileName: uploadJob.file_name ?? undefined,
					}

					const useV2Workflow = process.env.ENABLE_MODULAR_WORKFLOW === "true"

					const handle = useV2Workflow
						? await tasks.trigger("interview.v2.orchestrator", {
								analysisJobId: existingAnalysisJob.id,
								metadata,
								transcriptData: formattedTranscriptData,
								mediaUrl: uploadJob.external_url || "",
								existingInterviewId: interviewId,
								userCustomInstructions: customInstructions,
						  })
						: await tasks.trigger("interview.upload-media-and-transcribe", {
								analysisJobId: existingAnalysisJob.id,
								metadata,
								transcriptData: formattedTranscriptData,
								mediaUrl: uploadJob.external_url || "",
								existingInterviewId: interviewId,
								userCustomInstructions: customInstructions,
						  })

					await supabase
						.from("analysis_jobs")
						.update({ trigger_run_id: handle.id })
						.eq("id", existingAnalysisJob.id)

					consola.success("Triggered orchestrator:", handle.id)
					trace?.event?.({
						name: "analysis.orchestrator-triggered",
						metadata: {
							interviewId,
							analysisJobId: existingAnalysisJob.id,
							runId: handle.id,
						},
					})
				} else {
					// No existing job - create new one (backwards compatibility)
					consola.info("No existing analysis_job, creating new one")

					const { createAndProcessAnalysisJob } = await import("~/utils/processInterviewAnalysis.server")

					await createAndProcessAnalysisJob({
						interviewId,
						transcriptData: formattedTranscriptData,
						customInstructions,
						adminClient: supabase,
						initiatingUserId: uploadJob?.created_by ?? null,
						langfuseParent: trace,
					})

					consola.log("createAndProcessAnalysisJob for interview:", interviewId)
					trace?.event?.({
						name: "analysis.processed",
						metadata: {
							interviewId,
						},
					})
				}
			} catch (analysisError) {
				consola.error("Analysis job processing failed:", analysisError)
				// Continue webhook processing - don't fail the webhook for analysis errors
				consola.log("Webhook completed despite analysis error")
				trace?.event?.({
					name: "analysis.process.error",
					metadata: {
						interviewId,
						message: analysisError instanceof Error ? analysisError.message : String(analysisError),
					},
				})
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

		traceEndPayload = {
			output: {
				interviewId,
				transcriptId: payload.transcript_id,
				status: payload.status,
			},
		}

		return Response.json({ success: true })
	} catch (error) {
		consola.error("AssemblyAI webhook processing failed:", error)
		const message = error instanceof Error ? error.message : "Webhook processing failed"
		traceEndPayload = { level: "ERROR", statusMessage: message }
		return Response.json({ error: message }, { status: 500 })
	} finally {
		trace?.end?.(traceEndPayload)
	}
}
