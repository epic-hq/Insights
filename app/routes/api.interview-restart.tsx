/**
 * Smart interview restart endpoint
 *
 * One endpoint that handles ALL recovery cases:
 * - Stuck in processing state → reset and restart
 * - Has media but no transcript → submit to AssemblyAI
 * - Has transcript but no analysis → run analysis
 *
 * POST /api/interview-restart
 * Body: { interviewId: string }
 */

import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import type { Json } from "~/../supabase/types";
import { createSupabaseAdminClient, getAuthenticatedUser } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		// Auth check
		const { user } = await getAuthenticatedUser(request);
		if (!user?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { interviewId } = await request.json();
		if (!interviewId) {
			return Response.json({ error: "interviewId required" }, { status: 400 });
		}

		const supabase = createSupabaseAdminClient();

		// Get full interview state
		const { data: interview, error: fetchError } = await supabase
			.from("interviews")
			.select(
				"id, title, status, media_url, transcript, source_type, account_id, project_id, participant_pseudonym, conversation_analysis"
			)
			.eq("id", interviewId)
			.single();

		if (fetchError || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 });
		}

		consola.info("[interview-restart] Current state:", {
			id: interview.id,
			status: interview.status,
			hasMedia: !!interview.media_url,
			hasTranscript: !!interview.transcript,
			sourceType: interview.source_type,
		});

		const conversationAnalysis = (interview.conversation_analysis as Record<string, unknown>) || {};

		// Case 1: Already completed
		if (interview.status === "ready" && interview.transcript) {
			return Response.json({
				success: true,
				action: "none",
				status: "ready",
				message: "Interview is already complete",
			});
		}

		// Case 2: Has media, needs transcription
		const isAudioVideo = interview.source_type === "audio_upload" || interview.source_type === "video_upload";

		if (interview.media_url && isAudioVideo && !interview.transcript) {
			consola.info("[interview-restart] Submitting to AssemblyAI...");

			// Generate presigned URL for AssemblyAI
			const { createR2PresignedReadUrl } = await import("~/utils/r2.server");
			const presignedUrl = createR2PresignedReadUrl(interview.media_url, 3600);

			if (!presignedUrl) {
				return Response.json({ error: "Failed to generate presigned URL" }, { status: 500 });
			}

			const apiKey = process.env.ASSEMBLYAI_API_KEY;
			if (!apiKey) {
				return Response.json({ error: "Transcription service not configured" }, { status: 500 });
			}

			// Determine webhook URL
			const baseUrl = process.env.PUBLIC_TUNNEL_URL
				? `https://${process.env.PUBLIC_TUNNEL_URL}`
				: process.env.FLY_APP_NAME
					? `https://${process.env.FLY_APP_NAME}.fly.dev`
					: "https://getupsight.com";
			const webhookUrl = `${baseUrl}/api/assemblyai-webhook`;

			// Submit to AssemblyAI
			const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
				method: "POST",
				headers: {
					authorization: apiKey,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					audio_url: presignedUrl,
					webhook_url: webhookUrl,
					speech_model: "slam-1",
					speaker_labels: true,
					format_text: true,
					punctuate: true,
					sentiment_analysis: false,
				}),
			});

			if (!transcriptResponse.ok) {
				const errorText = await transcriptResponse.text();
				consola.error("[interview-restart] AssemblyAI failed:", errorText);
				return Response.json({ error: "Failed to start transcription" }, { status: 500 });
			}

			const assemblyData = await transcriptResponse.json();
			consola.info("[interview-restart] AssemblyAI job created:", assemblyData.id);

			// Update interview status
			await supabase
				.from("interviews")
				.update({
					status: "processing" as const,
					conversation_analysis: {
						...conversationAnalysis,
						current_step: "transcription",
						transcript_data: {
							status: "pending_transcription",
							assemblyai_id: assemblyData.id,
							external_url: presignedUrl,
						},
						status_detail: "Transcribing audio...",
					} as Json,
				})
				.eq("id", interviewId);

			return Response.json({
				success: true,
				action: "transcription_started",
				status: "processing",
				statusDetail: "Transcribing audio...",
				message: "Transcription started",
			});
		}

		// Case 3: Has transcript, needs analysis
		if (interview.transcript && interview.status !== "ready") {
			consola.info("[interview-restart] Starting analysis...");

			// Update status first
			await supabase
				.from("interviews")
				.update({
					status: "processing" as const,
					conversation_analysis: {
						...conversationAnalysis,
						current_step: "evidence",
						status_detail: "Analyzing transcript...",
						completed_steps: ["transcription"],
					} as Json,
				})
				.eq("id", interviewId);

			// Trigger orchestrator
			const handle = await tasks.trigger("interview.v2.orchestrator", {
				analysisJobId: interviewId,
				metadata: {
					accountId: interview.account_id,
					projectId: interview.project_id || undefined,
					userId: user.sub,
					interviewTitle: interview.title || undefined,
					participantName: interview.participant_pseudonym || undefined,
				},
				transcriptData: {
					full_transcript: interview.transcript,
					confidence: 0.9,
					file_type: "text",
				},
				mediaUrl: interview.media_url || "",
				existingInterviewId: interviewId,
				userCustomInstructions: "",
				resumeFrom: "evidence",
				skipSteps: ["upload"],
			});

			// Store trigger run ID
			await supabase
				.from("interviews")
				.update({
					conversation_analysis: {
						...conversationAnalysis,
						trigger_run_id: handle.id,
						current_step: "evidence",
						status_detail: "Analyzing transcript...",
						completed_steps: ["transcription"],
					} as Json,
				})
				.eq("id", interviewId);

			return Response.json({
				success: true,
				action: "analysis_started",
				status: "processing",
				statusDetail: "Analyzing transcript...",
				runId: handle.id,
				message: "Analysis started",
			});
		}

		// Case 4: Has media, use orchestrator for full re-processing
		if (interview.media_url) {
			consola.info("[interview-restart] Full reprocess via orchestrator...");

			await supabase
				.from("interviews")
				.update({
					status: "processing" as const,
					conversation_analysis: {
						...conversationAnalysis,
						current_step: "upload",
						status_detail: "Starting processing...",
						completed_steps: [],
					} as Json,
				})
				.eq("id", interviewId);

			const handle = await tasks.trigger("interview.v2.orchestrator", {
				analysisJobId: interviewId,
				metadata: {
					accountId: interview.account_id,
					projectId: interview.project_id || undefined,
					userId: user.sub,
					interviewTitle: interview.title || undefined,
					participantName: interview.participant_pseudonym || undefined,
				},
				transcriptData: {
					needs_transcription: true,
					file_type: "media",
				},
				mediaUrl: interview.media_url,
				existingInterviewId: interviewId,
				userCustomInstructions: "",
				resumeFrom: "upload",
				skipSteps: [],
			});

			await supabase
				.from("interviews")
				.update({
					conversation_analysis: {
						...conversationAnalysis,
						trigger_run_id: handle.id,
						current_step: "upload",
						status_detail: "Processing started...",
					} as Json,
				})
				.eq("id", interviewId);

			return Response.json({
				success: true,
				action: "full_reprocess_started",
				status: "processing",
				statusDetail: "Processing started...",
				runId: handle.id,
				message: "Processing restarted",
			});
		}

		// Case 5: Nothing to work with
		return Response.json({
			success: false,
			action: "none",
			status: interview.status,
			message: "No media or transcript available to process",
		});
	} catch (error) {
		consola.error("[interview-restart] Error:", error);
		return Response.json({ error: error instanceof Error ? error.message : "Restart failed" }, { status: 500 });
	}
}
