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

// Type for trace.end() payload - using any to handle optional method
type TraceEndPayload = {
	output?: Record<string, unknown>
	level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR"
	statusMessage?: string
}

// Assembly AI validates webhook endpoints with GET requests
export async function loader() {
	consola.info("Assembly AI webhook endpoint validation (GET request)")
	return Response.json({ status: "ok", service: "assemblyai-webhook" }, { status: 200 })
}

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
		const voiceMemoOnly = url.searchParams.get("voiceMemoOnly") === "true"
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

		// Find the interview by AssemblyAI transcript ID in conversation_analysis JSONB
		// (upload_jobs and analysis_jobs tables were consolidated into interviews.conversation_analysis)
		const fetchInterviewSpan = trace?.span?.({
			name: "supabase.interview.fetch",
			metadata: {
				transcriptId: payload.transcript_id,
			},
		})

		// Query interviews where conversation_analysis->transcript_data JSONB contains assemblyai_id
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, status, transcript, conversation_analysis, account_id, project_id, title")
			.contains("conversation_analysis->transcript_data", { assemblyai_id: payload.transcript_id })
			.single()

		if (interviewError || !interview) {
			if (mediaId) {
				consola.warn("Media pipeline webhook received without interview", {
					transcript_id: payload.transcript_id,
					media_id: mediaId,
				})
				return Response.json({ success: true, media_id: mediaId, status: payload.status }, { status: 202 })
			}

			consola.error("Interview query failed for transcript:", payload.transcript_id)
			consola.error("Error details:", {
				error: interviewError,
				hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
				supabaseUrl: process.env.SUPABASE_URL,
			})
			fetchInterviewSpan?.end?.({
				level: "ERROR",
				statusMessage: interviewError?.message ?? "Interview not found",
			})
			traceEndPayload = { level: "ERROR", statusMessage: "Interview not found" }
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		// Extract upload metadata and other data from conversation_analysis JSONB
		const conversationAnalysis = (interview.conversation_analysis as any) || {}
		const transcriptData = conversationAnalysis.transcript_data || {}
		const uploadMetadata = {
			file_name: transcriptData.file_name,
			file_type: transcriptData.file_type,
			external_url: transcriptData.external_url,
		}

		fetchInterviewSpan?.end?.({
			output: {
				interviewId: interview.id,
				status: interview.status,
			},
		})
		trace?.update?.({
			metadata: {
				interviewId: interview.id,
			},
		})

		// Idempotency check - prevent duplicate processing
		// Check multiple conditions to prevent duplicate orchestrator triggers:
		// 1. Interview is already ready (fully processed)
		// 2. Interview is transcribed with transcript (waiting for analysis)
		// 3. Interview is processing AND has trigger_run_id (orchestrator already running)
		// 4. Interview is processing AND has orchestrator_pending (orchestrator being triggered)
		const existingTriggerRunId = conversationAnalysis?.trigger_run_id
		const orchestratorPending = conversationAnalysis?.orchestrator_pending
		if (
			interview.status === "ready" ||
			(interview.status === "transcribed" && interview.transcript) ||
			(interview.status === "processing" && (existingTriggerRunId || orchestratorPending))
		) {
			consola.log("Interview already processed or processing, skipping:", {
				transcriptId: payload.transcript_id,
				status: interview.status,
				existingTriggerRunId,
				orchestratorPending,
			})
			trace?.event?.({
				name: "interview.already-processed",
				metadata: {
					interviewId: interview.id,
					existingTriggerRunId,
					orchestratorPending,
				},
			})
			traceEndPayload = {
				output: {
					interviewId: interview.id,
					status: "already_processed",
					existingTriggerRunId,
					orchestratorPending,
				},
			}
			return Response.json({ success: true, message: "Already processed" })
		}

		const interviewId = interview.id

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
				original_filename: uploadMetadata.file_name,
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

			// Update conversation_analysis metadata to track workflow state
			const updatedConversationAnalysis = {
				...conversationAnalysis,
				current_step: "analysis",
				status_detail: "Transcription completed, ready for analysis",
				completed_steps: [...(conversationAnalysis.completed_steps || []), "transcription"],
			}

			await supabase
				.from("interviews")
				.update({ conversation_analysis: updatedConversationAnalysis as Json })
				.eq("id", interviewId)

			// If this is a voice memo only (no analysis), mark as ready and return
			if (voiceMemoOnly) {
				consola.info("Voice memo transcription complete - skipping analysis", {
					interviewId,
					transcriptId: payload.transcript_id,
				})

				await supabase.from("interviews").update({ status: "ready" }).eq("id", interviewId)

				trace?.event?.({
					name: "voice-memo.completed",
					metadata: {
						interviewId,
						transcriptId: payload.transcript_id,
					},
				})

				traceEndPayload = {
					output: {
						interviewId,
						status: "ready",
						message: "Voice memo transcribed successfully",
					},
				}

				return Response.json({
					success: true,
					interviewId,
					status: "ready",
					message: "Voice memo transcribed successfully",
				})
			}

			const customInstructions = conversationAnalysis.custom_instructions || ""

			// Trigger the analysis orchestrator workflow
			try {
				consola.info("Triggering analysis orchestrator for interview:", interviewId)

				// Generate a unique request ID to prevent duplicate triggers
				// Set this BEFORE triggering so concurrent webhook calls will see it
				const webhookRequestId = `webhook_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

				// Update conversation_analysis to mark workflow as in progress
				// Include orchestrator_pending flag to prevent race conditions
				await supabase
					.from("interviews")
					.update({
						status: "processing" as const,
						conversation_analysis: {
							...updatedConversationAnalysis,
							current_step: "upload",
							status_detail: "Transcription complete, starting analysis",
							orchestrator_pending: webhookRequestId, // Lock to prevent duplicates
						} as Json,
					})
					.eq("id", interviewId)

				// Trigger orchestrator
				const { tasks } = await import("@trigger.dev/sdk")
				const fetchedInterview = await supabase
					.from("interviews")
					.select("account_id, project_id, title, participant_pseudonym, person_id")
					.eq("id", interviewId)
					.single()

				// Fetch linked participant names from interview_people
				// This preserves names entered by users during upload
				let participantName: string | undefined
				const { data: interviewPeople } = await supabase
					.from("interview_people")
					.select("display_name, role, people(name)")
					.eq("interview_id", interviewId)

				if (interviewPeople?.length) {
					// Prefer display_name, then linked person's name
					const participant = interviewPeople.find((p) => p.role !== "interviewer") || interviewPeople[0]
					participantName =
						participant?.display_name || (participant?.people as { name: string | null } | null)?.name || undefined
				}
				// Fallback to participant_pseudonym from interview record
				if (!participantName && fetchedInterview.data?.participant_pseudonym) {
					const pseudonym = fetchedInterview.data.participant_pseudonym
					// Only use if it's not a generic placeholder
					if (pseudonym && !pseudonym.match(/^(Participant|Anonymous)\s*\d*$/i)) {
						participantName = pseudonym
					}
				}

				const metadata = {
					accountId: fetchedInterview.data?.account_id,
					userId: undefined, // No created_by tracking in conversation_analysis
					projectId: fetchedInterview.data?.project_id ?? undefined,
					interviewTitle: fetchedInterview.data?.title ?? undefined,
					fileName: uploadMetadata.file_name ?? undefined,
					participantName, // Pass the linked person's name to BAML extraction
				}

				const useV2Workflow = process.env.ENABLE_MODULAR_WORKFLOW === "true"

				// Use interview ID as idempotency key to prevent duplicate orchestrator runs
				// This ensures only ONE orchestrator runs per interview, even if webhook is called multiple times
				const idempotencyKey = `interview-orchestrator-${interviewId}`

				const handle = useV2Workflow
					? await tasks.trigger(
							"interview.v2.orchestrator",
							{
								analysisJobId: interviewId, // Use interview ID as the job identifier
								metadata,
								transcriptData: formattedTranscriptData,
								mediaUrl: uploadMetadata.external_url || "",
								existingInterviewId: interviewId,
								userCustomInstructions: customInstructions,
							},
							{
								idempotencyKey,
								idempotencyKeyTTL: "24h", // Prevent duplicate runs for 24 hours
							}
						)
					: await tasks.trigger(
							"interview.upload-media-and-transcribe",
							{
								analysisJobId: interviewId, // Use interview ID as the job identifier
								metadata,
								transcriptData: formattedTranscriptData,
								mediaUrl: uploadMetadata.external_url || "",
								existingInterviewId: interviewId,
								userCustomInstructions: customInstructions,
							},
							{
								idempotencyKey,
								idempotencyKeyTTL: "24h",
							}
						)

				// Store trigger_run_id in conversation_analysis
				await supabase
					.from("interviews")
					.update({
						conversation_analysis: {
							...updatedConversationAnalysis,
							trigger_run_id: handle.id,
						} as Json,
					})
					.eq("id", interviewId)

				consola.success("Triggered orchestrator:", handle.id)
				trace?.event?.({
					name: "analysis.orchestrator-triggered",
					metadata: {
						interviewId,
						runId: handle.id,
					},
				})
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

			// Update interview status and conversation_analysis with error
			await supabase
				.from("interviews")
				.update({
					status: "error" as const,
					conversation_analysis: {
						...conversationAnalysis,
						status_detail: "Transcription failed",
						last_error: `AssemblyAI transcription failed with status: ${payload.status}`,
					} as Json,
				})
				.eq("id", interviewId)
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
