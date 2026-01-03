/**
 * Process Recall Meeting Task
 *
 * Handles recordings uploaded via Recall.ai Desktop SDK:
 * 1. Downloads transcript from Recall.ai
 * 2. Transforms Recall transcript format to our format
 * 3. Downloads and stores video in R2
 * 4. Triggers the v2 orchestrator for evidence extraction
 */

import { task, metadata } from "@trigger.dev/sdk";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "./v2/config";
import type {
  TranscriptData,
  TranscriptUtterance,
} from "~/utils/processInterview.server";

interface RecallTranscriptEntry {
  participant: {
    id: number;
    name: string;
    email?: string;
    is_host: boolean;
  };
  words: Array<{
    text: string;
    start_timestamp: { relative: number; absolute: string };
    end_timestamp?: { relative: number; absolute: string };
  }>;
}

interface ProcessRecallMeetingPayload {
  interviewId: string;
  recordingId: string;
  accountId: string;
  projectId: string;
  videoUrl: string | null;
  transcriptUrl: string | null;
}

async function downloadRecallTranscript(
  url: string,
): Promise<RecallTranscriptEntry[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download transcript: ${response.status}`);
  }
  return response.json();
}

function transformRecallTranscript(
  recallTranscript: RecallTranscriptEntry[],
): TranscriptData {
  const utterances: TranscriptUtterance[] = [];
  const speakerNames = new Set<string>();

  // Group words by participant into utterances
  for (const entry of recallTranscript) {
    const speakerName =
      entry.participant.name || `Speaker ${entry.participant.id}`;
    speakerNames.add(speakerName);

    if (entry.words.length === 0) continue;

    // Combine all words from this participant segment
    const text = entry.words.map((w) => w.text).join(" ");
    const startTime = entry.words[0].start_timestamp.relative;
    const endTime =
      entry.words[entry.words.length - 1].end_timestamp?.relative ??
      startTime + 1000;

    utterances.push({
      speaker: speakerName,
      text,
      start: startTime,
      end: endTime,
    });
  }

  // Generate full transcript text
  const fullTranscript = utterances
    .map((u) => `${u.speaker}: ${u.text}`)
    .join("\n\n");

  return {
    full_transcript: fullTranscript,
    utterances,
    audio_duration:
      utterances.length > 0
        ? Math.max(...utterances.map((u) => u.end)) / 1000
        : 0,
  };
}

export const processRecallMeetingTask = task({
  id: "interview.process-recall-meeting",
  retry: workflowRetryConfig,

  run: async (payload: ProcessRecallMeetingPayload) => {
    const {
      interviewId,
      recordingId,
      accountId,
      projectId,
      videoUrl,
      transcriptUrl,
    } = payload;

    consola.info(
      `[ProcessRecallMeeting] Starting for interview ${interviewId}, recording ${recordingId}`,
    );

    const client = createSupabaseAdminClient();

    try {
      metadata.set("stageLabel", "Downloading transcript");
      metadata.set("progressPercent", 10);
      metadata.set("interviewId", interviewId);
      metadata.set("accountId", accountId);
      metadata.set("projectId", projectId);

      // Update interview status
      await client
        .from("interviews")
        .update({ status: "processing" })
        .eq("id", interviewId);

      // Step 1: Download and transform Recall transcript
      let transcriptData: TranscriptData | undefined;

      if (transcriptUrl) {
        consola.info(
          `[ProcessRecallMeeting] Downloading transcript from Recall.ai`,
        );
        const recallTranscript = await downloadRecallTranscript(transcriptUrl);
        transcriptData = transformRecallTranscript(recallTranscript);

        consola.info(
          `[ProcessRecallMeeting] Transformed ${recallTranscript.length} entries to ${transcriptData.utterances.length} utterances`,
        );

        // Update interview with transcript
        await client
          .from("interviews")
          .update({
            transcript: transcriptData.full_transcript,
            duration_sec: Math.round(transcriptData.audio_duration),
          })
          .eq("id", interviewId);
      }

      metadata.set("stageLabel", "Processing media");
      metadata.set("progressPercent", 30);

      // Step 2: Download video to R2 if provided
      let r2MediaUrl: string | null = null;

      if (videoUrl) {
        consola.info(`[ProcessRecallMeeting] Downloading video from Recall.ai`);
        const { uploadMediaToR2 } = await import("~/utils/r2.server");

        const r2Key = `media/${accountId}/${projectId}/${recordingId}.mp4`;
        r2MediaUrl = await uploadMediaToR2(videoUrl, r2Key);

        // Update interview with R2 URL
        await client
          .from("interviews")
          .update({ media_url: r2MediaUrl })
          .eq("id", interviewId);

        consola.info(`[ProcessRecallMeeting] Video uploaded to R2: ${r2Key}`);
      }

      metadata.set("stageLabel", "Creating analysis job");
      metadata.set("progressPercent", 40);

      // Step 3: Create analysis job and trigger v2 orchestrator
      const { data: analysisJob, error: jobError } = await client
        .from("analysis_jobs")
        .insert({
          account_id: accountId,
          project_id: projectId,
          interview_id: interviewId,
          status: "pending",
          status_detail: "Created from Recall.ai recording",
        })
        .select("id")
        .single();

      if (jobError) {
        throw new Error(`Failed to create analysis job: ${jobError.message}`);
      }

      consola.info(
        `[ProcessRecallMeeting] Created analysis job ${analysisJob.id}`,
      );

      // Step 4: Trigger the v2 orchestrator for evidence extraction
      const { processInterviewOrchestratorV2 } = await import(
        "./v2/orchestrator"
      );

      await processInterviewOrchestratorV2.trigger({
        metadata: {
          accountId,
          projectId,
        },
        existingInterviewId: interviewId,
        analysisJobId: analysisJob.id,
        transcriptData: transcriptData
          ? {
              full_transcript: transcriptData.full_transcript,
              utterances: transcriptData.utterances,
            }
          : undefined,
        mediaUrl: r2MediaUrl || undefined,
      });

      consola.info(
        `[ProcessRecallMeeting] Triggered v2 orchestrator for interview ${interviewId}`,
      );

      metadata.set("stageLabel", "Processing complete");
      metadata.set("progressPercent", 100);

      return {
        success: true,
        interviewId,
        analysisJobId: analysisJob.id,
      };
    } catch (error) {
      consola.error(
        `[ProcessRecallMeeting] Error processing recording ${recordingId}:`,
        error,
      );

      // Update interview status to failed
      await client
        .from("interviews")
        .update({
          status: "failed",
          processing_metadata: {
            error: error instanceof Error ? error.message : String(error),
            failedAt: new Date().toISOString(),
          },
        })
        .eq("id", interviewId);

      throw error;
    }
  },
});
