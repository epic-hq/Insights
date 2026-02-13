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

type TranscriptUtterance = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

type TranscriptData = {
  full_transcript: string;
  utterances: TranscriptUtterance[];
  audio_duration: number;
};

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

async function downloadRecallTranscript(url: string): Promise<{
  rawText: string;
  parsed?: RecallTranscriptEntry[];
}> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download transcript: ${response.status}`);
  }
  const rawText = await response.text();
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return { rawText, parsed: parsed as RecallTranscriptEntry[] };
    }
  } catch {
    // Fall back to raw text transcript
  }
  return { rawText };
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

        if (recallTranscript.parsed) {
          transcriptData = transformRecallTranscript(recallTranscript.parsed);

          consola.info(
            `[ProcessRecallMeeting] Transformed ${recallTranscript.parsed.length} entries to ${transcriptData.utterances.length} utterances`,
          );

          // Update interview with transcript
          await client
            .from("interviews")
            .update({
              transcript: transcriptData.full_transcript,
              duration_sec: Math.round(transcriptData.audio_duration),
            })
            .eq("id", interviewId);
        } else if (recallTranscript.rawText.trim().length > 0) {
          consola.warn(
            `[ProcessRecallMeeting] Recall transcript was not JSON; saving raw text`,
          );
          await client
            .from("interviews")
            .update({ transcript: recallTranscript.rawText })
            .eq("id", interviewId);
        } else {
          consola.warn(`[ProcessRecallMeeting] Recall transcript was empty`);
        }
      } else {
        consola.warn(
          `[ProcessRecallMeeting] No transcript URL provided for recording ${recordingId}`,
        );
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

      metadata.set("stageLabel", "Triggering analysis orchestrator");
      metadata.set("progressPercent", 40);

      // Step 3: Trigger the v2 orchestrator for evidence extraction
      // Note: analysisJobId is now the interview ID (analysis_jobs table was consolidated)
      const { processInterviewOrchestratorV2 } =
        await import("./v2/orchestrator");

      await processInterviewOrchestratorV2.trigger({
        metadata: {
          accountId,
          projectId,
        },
        existingInterviewId: interviewId,
        analysisJobId: interviewId, // Interview ID = Analysis Job ID
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
        analysisJobId: interviewId,
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
