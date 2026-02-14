/**
 * V2 Upload and Transcribe Task
 *
 * Atomic task that:
 * 1. Creates or updates interview record
 * 2. Transcribes audio if needed
 * 3. Initializes workflow state
 *
 * Entry point for the interview processing workflow.
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk";
import consola from "consola";
import { recordUsageOnly } from "~/lib/billing/usage.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server";
import { workflowRetryConfig } from "./config";
import { uploadMediaAndTranscribeCore } from "./uploadCore";
import { createR2PresignedUrl } from "~/utils/r2.server";
import {
  errorMessage,
  initializeWorkflowState,
  saveWorkflowState,
  updateAnalysisJobError,
  updateAnalysisJobProgress,
} from "./state";
import type {
  UploadAndTranscribePayload,
  UploadAndTranscribeResult,
} from "./types";

// AssemblyAI slam-1 model pricing: ~$0.65/hour = ~$0.0108/minute
const ASSEMBLYAI_COST_PER_MINUTE = 0.0108;

export const uploadAndTranscribeTaskV2 = task({
  id: "interview.v2.upload-and-transcribe",
  retry: workflowRetryConfig,
  run: async (
    payload: UploadAndTranscribePayload,
  ): Promise<UploadAndTranscribeResult> => {
    const {
      metadata,
      transcriptData,
      mediaUrl,
      existingInterviewId,
      analysisJobId,
    } = payload;
    const client = createSupabaseAdminClient();

    try {
      // Update progress
      await updateAnalysisJobProgress(client, analysisJobId, {
        currentStep: "upload",
        progress: 10,
        statusDetail: "Processing media and transcript",
      });

      // Check if we need to transcribe
      let processedTranscriptData = transcriptData;

      if ((transcriptData as any).needs_transcription && mediaUrl) {
        consola.info(
          "[uploadAndTranscribe] Transcription needed, generating signed URL for media",
        );

        // Generate presigned URL from R2 key (mediaUrl is just the key)
        const presigned = createR2PresignedUrl({
          key: mediaUrl,
          expiresInSeconds: 3600, // 1 hour should be enough for AssemblyAI to download
        });

        if (!presigned) {
          throw new Error("Failed to create presigned URL for media file");
        }

        consola.info(
          "[uploadAndTranscribe] Presigned URL created, calling AssemblyAI",
          {
            key: mediaUrl,
            expiresAt: presigned.expiresAt,
          },
        );

        // Update progress
        await updateAnalysisJobProgress(client, analysisJobId, {
          currentStep: "transcribing",
          progress: 15,
          statusDetail: "Transcribing audio/video via AssemblyAI",
        });

        // Transcribe via AssemblyAI
        const assemblyResult = await transcribeAudioFromUrl(presigned.url);

        consola.info("[uploadAndTranscribe] Transcription complete", {
          audioDuration: assemblyResult.audio_duration,
          transcriptLength:
            (assemblyResult.full_transcript as string)?.length || 0,
        });

        // Record billing for transcription
        const audioDurationMinutes = (assemblyResult.audio_duration || 0) / 60;
        const transcriptionCost =
          audioDurationMinutes * ASSEMBLYAI_COST_PER_MINUTE;

        if (metadata.accountId && audioDurationMinutes > 0) {
          await recordUsageOnly(
            {
              accountId: metadata.accountId,
              userId: metadata.userId || null,
              projectId: metadata.projectId || null,
              featureSource: "transcription",
            },
            {
              provider: "assemblyai",
              model: "slam-1",
              inputTokens: 0, // Not token-based
              outputTokens: Math.ceil(audioDurationMinutes), // Use minutes as a proxy
              estimatedCostUsd: transcriptionCost,
              resourceType: "interview",
              resourceId: existingInterviewId,
            },
            `transcription:${existingInterviewId || mediaUrl}:${Date.now()}`,
          ).catch((err) => {
            consola.error(
              "[uploadAndTranscribe] Failed to record transcription billing:",
              err,
            );
          });

          consola.info("[uploadAndTranscribe] Transcription billing recorded", {
            audioDurationMinutes: Math.round(audioDurationMinutes * 100) / 100,
            estimatedCostUsd: Math.round(transcriptionCost * 10000) / 10000,
          });
        }

        processedTranscriptData = assemblyResult;

        // Validate that transcription produced actual speech
        const transcriptText =
          (assemblyResult as Record<string, unknown>).full_transcript as
            | string
            | undefined;
        const speakerUtterances = (
          assemblyResult as Record<string, unknown>
        ).speaker_transcripts as unknown[] | undefined;

        if (
          (!transcriptText || transcriptText.trim().length === 0) &&
          (!speakerUtterances || speakerUtterances.length === 0)
        ) {
          const audioDur =
            (assemblyResult as Record<string, unknown>).audio_duration ?? "unknown";
          throw new Error(
            `No speech detected in audio file (duration: ${audioDur}s). ` +
              `The file may be silent, have no audio track, or contain only music/noise. ` +
              `Please verify the media file contains audible speech and re-upload.`,
          );
        }
      }

      // Call core function to handle upload and transcription
      const result = await uploadMediaAndTranscribeCore({
        metadata,
        transcriptData: processedTranscriptData,
        mediaUrl,
        existingInterviewId,
        client,
      });

      consola.info("[uploadAndTranscribe] Core function returned:", {
        hasResult: !!result,
        hasInterview: !!result?.interview,
        interviewId: result?.interview?.id,
        fullTranscriptLength: result?.fullTranscript?.length ?? 0,
        language: result?.language,
        hasTranscriptData: !!result?.transcriptData,
        resultKeys: result ? Object.keys(result) : [],
        interviewKeys: result?.interview ? Object.keys(result.interview) : [],
      });

      // Initialize workflow state for this interview
      if (analysisJobId) {
        await initializeWorkflowState(
          client,
          analysisJobId,
          result.interview.id,
        );

        // Save initial data to workflow state
        await saveWorkflowState(client, analysisJobId, {
          interviewId: result.interview.id,
          fullTranscript: result.fullTranscript,
          language: result.language,
          transcriptData: result.transcriptData,
          completedSteps: ["upload"],
          currentStep: "upload",
        });

        await updateAnalysisJobProgress(client, analysisJobId, {
          progress: 30,
          statusDetail: "Media processed successfully",
        });
      }

      const returnValue = {
        interviewId: result.interview.id,
        fullTranscript: result.fullTranscript,
        language: result.language,
        transcriptData: result.transcriptData,
      };

      consola.info("[uploadAndTranscribe] Returning to orchestrator:", {
        interviewId: returnValue.interviewId,
        fullTranscriptLength: returnValue.fullTranscript?.length ?? 0,
        language: returnValue.language,
        hasTranscriptData: !!returnValue.transcriptData,
      });

      return returnValue;
    } catch (error) {
      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: "upload",
        error: errorMessage(error),
      });

      // Update interview status to error if we have an interview ID
      if (existingInterviewId) {
        await client
          .from("interviews")
          .update({ status: "error" })
          .eq("id", existingInterviewId);
      }

      throw error;
    }
  },
});
