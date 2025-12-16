/**
 * V2 Finalize Interview Task
 *
 * Atomic task that:
 * 1. Updates interview status to "completed"
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
import { workflowRetryConfig } from "~/utils/processInterview.server";
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

      // Update interview status to "completed" and set conversation_analysis
      const { data: currentInterview } = await client
        .from("interviews")
        .select("conversation_analysis")
        .eq("id", interviewId)
        .single();

      const existingAnalysis =
        (currentInterview?.conversation_analysis as any) || {};

      const { error: updateError } = await client
        .from("interviews")
        .update({
          status: "completed",
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
          `Interview ${interviewId} marked as completed with conversation_analysis`,
        );
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
            const userEmail = authUser.user.email;
            const userName =
              authUser.user.user_metadata?.full_name ||
              authUser.user.user_metadata?.name ||
              userEmail?.split("@")[0] ||
              "Team Member";

            let interviewerPersonId: string | null = null;

            // Try to find existing person by email first
            if (userEmail) {
              const { data: existingByEmail } = await client
                .from("people")
                .select("id")
                .eq("account_id", metadata.accountId)
                .eq("primary_email", userEmail)
                .maybeSingle();

              if (existingByEmail) {
                interviewerPersonId = existingByEmail.id;
                consola.info(
                  `[finalizeInterview] Found existing person by email for interviewer: ${interviewerPersonId}`,
                );
              }
            }

            // If not found by email, try to find by name
            if (!interviewerPersonId) {
              const { data: existingByName } = await client
                .from("people")
                .select("id")
                .eq("account_id", metadata.accountId)
                .eq("name", userName)
                .eq("segment", "internal") // Only match internal team members
                .maybeSingle();

              if (existingByName) {
                interviewerPersonId = existingByName.id;
                consola.info(
                  `[finalizeInterview] Found existing person by name for interviewer: ${interviewerPersonId}`,
                );
              }
            }

            // Create new person if not found
            if (!interviewerPersonId) {
              const { data: newPerson, error: createError } = await client
                .from("people")
                .insert({
                  account_id: metadata.accountId,
                  project_id: metadata.projectId ?? null,
                  name: userName,
                  primary_email: userEmail ?? null,
                  segment: "internal", // Mark as internal team member
                })
                .select("id")
                .single();

              if (createError || !newPerson) {
                consola.warn(
                  `[finalizeInterview] Failed to create interviewer person: ${createError?.message}`,
                );
              } else {
                interviewerPersonId = newPerson.id;
                consola.info(
                  `[finalizeInterview] Created person for interviewer: ${interviewerPersonId}`,
                );
              }
            }

            // Link interviewer to interview (if person exists)
            if (interviewerPersonId) {
              const { error: linkError } = await client
                .from("interview_people")
                .upsert(
                  {
                    interview_id: interviewId,
                    person_id: interviewerPersonId,
                    project_id: metadata.projectId ?? null,
                    role: "interviewer",
                    transcript_key: "A", // First speaker in conversation (interviewer)
                    display_name: userName,
                  },
                  { onConflict: "interview_id,person_id" },
                );

              if (linkError) {
                consola.warn(
                  `[finalizeInterview] Failed to link interviewer: ${linkError.message}`,
                );
              } else {
                consola.success(
                  `[finalizeInterview] Linked interviewer ${userName} to interview ${interviewId}`,
                );
              }
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
