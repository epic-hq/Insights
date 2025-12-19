/**
 * V2 Finalize Interview Task
 *
 * Atomic task that:
 * 1. Updates interview status to "ready"
 * 2. Sends analytics events (PostHog)
 * 3. Triggers side effects (e.g., generateSalesLensTask)
 * 4. Marks workflow as complete
 *
 * Exit point for the interview processing workflow.
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk";
import consola from "consola";
import { PostHog } from "posthog-node";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server";
import { workflowRetryConfig } from "./config";
import {
  generateTitleFromContent,
  isTimestampTitle,
} from "../../lib/generateTitle";
import {
  errorMessage,
  saveWorkflowState,
  updateAnalysisJobError,
  updateAnalysisJobProgress,
} from "./state";
import type {
  FinalizeInterviewPayload,
  FinalizeInterviewResult,
} from "./types";

// Initialize PostHog client for server-side tracking
const posthog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || "https://app.posthog.com",
    })
  : null;

export const finalizeInterviewTaskV2 = task({
  id: "interview.v2.finalize-interview",
  retry: workflowRetryConfig,
  run: async (
    payload: FinalizeInterviewPayload,
  ): Promise<FinalizeInterviewResult> => {
    const {
      interviewId,
      analysisJobId,
      metadata,
      evidenceIds,
      insightIds,
      fullTranscript,
    } = payload;
    const client = createSupabaseAdminClient();

    try {
      await updateAnalysisJobProgress(client, analysisJobId, {
        currentStep: "complete",
        progress: 100,
        statusDetail: "Analysis complete",
      });

      // Update interview status to "ready" and set conversation_analysis
      const { data: currentInterview } = await client
        .from("interviews")
        .select("conversation_analysis")
        .eq("id", interviewId)
        .single();

      const existingAnalysis =
        (currentInterview?.conversation_analysis as any) || {};

      // Note: interview_status enum is: draft, scheduled, uploading, uploaded,
      // transcribing, transcribed, processing, ready, tagged, archived, error
      // "completed" is NOT a valid status - use "ready" for fully processed interviews
      const { error: updateError } = await client
        .from("interviews")
        .update({
          status: "ready",
          updated_at: new Date().toISOString(),
          conversation_analysis: {
            ...existingAnalysis,
            current_step: "complete",
            progress: 100,
            completed_at: new Date().toISOString(),
            evidence_count: evidenceIds?.length || 0,
            status_detail: "Analysis complete",
          },
        })
        .eq("id", interviewId);

      if (updateError) {
        consola.warn(
          `Failed to update interview status for ${interviewId}:`,
          updateError,
        );
      } else {
        consola.info(
          `Interview ${interviewId} marked as ready with conversation_analysis`,
        );
      }

      // Generate title if current title is a timestamp pattern
      try {
        const { data: interviewForTitle } = await client
          .from("interviews")
          .select(
            "title, transcript, observations_and_notes, transcript_formatted",
          )
          .eq("id", interviewId)
          .single();

        if (interviewForTitle && isTimestampTitle(interviewForTitle.title)) {
          // Get content from transcript or notes
          const contentForTitle =
            fullTranscript ||
            interviewForTitle.transcript ||
            interviewForTitle.observations_and_notes ||
            (
              interviewForTitle.transcript_formatted as {
                full_transcript?: string;
              }
            )?.full_transcript ||
            "";

          if (contentForTitle && contentForTitle.length >= 50) {
            const generatedTitle =
              await generateTitleFromContent(contentForTitle);

            if (generatedTitle) {
              const { error: titleError } = await client
                .from("interviews")
                .update({ title: generatedTitle })
                .eq("id", interviewId);

              if (titleError) {
                consola.warn(
                  `[finalizeInterview] Failed to update title for ${interviewId}:`,
                  titleError,
                );
              } else {
                consola.info(
                  `[finalizeInterview] Updated title for ${interviewId}: "${generatedTitle}"`,
                );
              }
            }
          }
        }
      } catch (titleError) {
        consola.warn(
          "[finalizeInterview] Title generation failed:",
          titleError,
        );
        // Don't fail the task if title generation fails
      }

      // Trigger side effects

      // 1. Legacy sales lens (for backward compatibility during migration)
      try {
        const { generateSalesLensTask } =
          await import("../../sales/generateSalesLens");
        await generateSalesLensTask.trigger({
          interviewId,
          computedBy: metadata?.userId ?? null,
        });
      } catch (sideEffectError) {
        consola.warn(
          "Failed to trigger generateSalesLensTask:",
          sideEffectError,
        );
        // Don't fail the task if side effect fails
      }

      // 2. Apply all conversation lenses (new generic system)
      try {
        const { applyAllLensesTask } =
          await import("../../lens/applyAllLenses");
        await applyAllLensesTask.trigger({
          interviewId,
          accountId: metadata?.accountId ?? "",
          projectId: metadata?.projectId ?? null,
          computedBy: metadata?.userId ?? null,
        });
        consola.info(
          `[finalizeInterview] Triggered applyAllLensesTask for ${interviewId}`,
        );
      } catch (lensError) {
        consola.warn("Failed to trigger applyAllLensesTask:", lensError);
        // Don't fail the task if lens generation fails
      }

      // 3. Generate thumbnail for video files
      try {
        // Fetch interview to get media info
        const { data: interviewForThumb } = await client
          .from("interviews")
          .select("media_url, file_extension, account_id")
          .eq("id", interviewId)
          .single();

        const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "m4v"];
        const isVideo =
          interviewForThumb?.file_extension &&
          videoExtensions.includes(
            interviewForThumb.file_extension.toLowerCase(),
          );

        if (isVideo && interviewForThumb.media_url) {
          const { generateThumbnail } =
            await import("../../generate-thumbnail");
          await generateThumbnail.trigger({
            mediaKey: interviewForThumb.media_url,
            interviewId,
            timestampSec: 1, // Extract frame at 1 second
            accountId: interviewForThumb.account_id,
          });
          consola.info(
            `[finalizeInterview] Triggered generateThumbnail for video ${interviewId}`,
          );
        }
      } catch (thumbError) {
        consola.warn("Failed to trigger generateThumbnail:", thumbError);
        // Don't fail the task if thumbnail generation fails
      }

      // Send analytics
      try {
        if (!posthog) {
          consola.warn(
            "[finalizeInterview] PostHog not configured, skipping analytics",
          );
        } else {
          // Determine source and file type
          const source = metadata?.fileName
            ? metadata.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)
              ? "upload"
              : metadata.fileName.match(/\.(mp4|mov|avi|webm)$/i)
                ? "upload"
                : "paste"
            : "record";

          const fileType = metadata?.fileName
            ? metadata.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)
              ? "audio"
              : metadata.fileName.match(/\.(mp4|mov|avi|webm)$/i)
                ? "video"
                : "text"
            : undefined;

          // Get interview duration
          const { data: interview } = await client
            .from("interviews")
            .select("duration_sec")
            .eq("id", interviewId)
            .single();

          posthog.capture({
            distinctId: metadata?.userId || metadata?.accountId || "unknown",
            event: "interview_added",
            properties: {
              interview_id: interviewId,
              project_id: metadata?.projectId,
              account_id: metadata?.accountId,
              source,
              duration_s: interview?.duration_sec || 0,
              file_type: fileType,
              has_transcript: Boolean(fullTranscript),
              evidence_count: evidenceIds?.length || 0,
              insights_count: insightIds?.length || 0,
              $insert_id: `interview:${interviewId}:analysis`,
            },
          });

          // Update user properties for first few interviews
          if (metadata?.userId && metadata?.accountId) {
            const { count: interviewCount } = await client
              .from("interviews")
              .select("id", { count: "exact", head: true })
              .eq("account_id", metadata.accountId);

            if ((interviewCount || 0) <= 3) {
              posthog.identify({
                distinctId: metadata.userId,
                properties: {
                  interview_count: interviewCount || 1,
                },
              });
            }
          }
        }
      } catch (trackingError) {
        consola.warn(
          "[finalizeInterview] PostHog tracking failed:",
          trackingError,
        );
        // Don't fail the task if analytics fail
      }

      // Auto-link uploader as interviewer if userId is provided
      if (metadata?.userId && metadata?.accountId) {
        try {
          // Look up user info from auth.users
          const { data: authUser } = await client.auth.admin.getUserById(
            metadata.userId,
          );

          if (authUser?.user) {
            const linkResult = await ensureInterviewInterviewerLink({
              supabase: client,
              accountId: metadata.accountId,
              projectId: metadata.projectId ?? null,
              interviewId,
              userId: metadata.userId,
              authUser: {
                email: authUser.user.email ?? null,
                user_metadata: authUser.user.user_metadata as Record<
                  string,
                  unknown
                >,
              },
            });

            if (linkResult) {
              consola.success(
                `[finalizeInterview] Linked interviewer ${linkResult.personName ?? "Team Member"} to interview ${interviewId}`,
              );
            }
          }
        } catch (interviewerError) {
          consola.warn(
            "[finalizeInterview] Failed to auto-link interviewer:",
            interviewerError,
          );
          // Don't fail the task if interviewer linking fails
        }
      }

      // Update workflow state - mark as complete
      if (analysisJobId) {
        await saveWorkflowState(client, analysisJobId, {
          completedSteps: [
            "upload",
            "evidence",
            "insights",
            "personas",
            "answers",
            "finalize",
          ],
          currentStep: "complete",
          interviewId,
        });
      }

      return { success: true };
    } catch (error) {
      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: "complete",
        error: errorMessage(error),
      });

      throw error;
    }
  },
});
