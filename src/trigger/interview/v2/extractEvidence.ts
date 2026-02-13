/**
 * V2 Extract Evidence Task (inlined)
 *
 * Extracts evidence and people from transcript_data, maps BAML person_key to person_id,
 * normalizes speaker labels, and links interview_people with transcript_key.
 */

import { heartbeats, task } from "@trigger.dev/sdk";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  errorMessage,
  saveWorkflowState,
  updateAnalysisJobError,
  updateAnalysisJobProgress,
} from "./state";
import type { ExtractEvidencePayload, ExtractEvidenceResult } from "./types";
import {
  isPlaceholderPerson,
  normalizeSpeakerLabel,
} from "~/features/interviews/peopleNormalization.server";
import { resolveOrCreatePerson } from "~/lib/people/resolution.server";
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server";
import { extractEvidenceCore } from "./extractEvidenceCore";

export const extractEvidenceTaskV2 = task({
  id: "interview.v2.extract-evidence",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  maxDuration: 1_200, // 20 min — gpt-5-mini @ 6x concurrency should finish in 3-8 min
  machine: {
    preset: "medium-2x", // faster than default for long transcripts
  },
  run: async (
    payload: ExtractEvidencePayload,
    { ctx },
  ): Promise<ExtractEvidenceResult> => {
    const { interviewId, fullTranscript, language, analysisJobId, metadata } =
      payload;
    const client = createSupabaseAdminClient();

    if (!interviewId || interviewId === "undefined") {
      throw new Error(`Invalid interviewId: ${interviewId}`);
    }

    try {
      const heartbeatInterval = setInterval(() => {
        void heartbeats.yield();
      }, 10_000);

      try {
        // Early heartbeat/progress update to keep run active
        await updateAnalysisJobProgress(client, analysisJobId, {
          currentStep: "evidence",
          progress: 40,
          statusDetail: "Extracting evidence from transcript",
        });

        await client
          .from("interviews")
          .update({
            processing_metadata: {
              current_step: "evidence",
              progress: 40,
              status_detail: "Extracting evidence from transcript",
              trigger_run_id: ctx.run.id,
            },
          })
          .eq("id", interviewId);

        const { data: interview, error: interviewError } = await client
          .from("interviews")
          .select("*")
          .eq("id", interviewId)
          .single();
        if (interviewError || !interview) {
          throw new Error(
            `Interview ${interviewId} not found: ${interviewError?.message}`,
          );
        }

        // Clean transcript data
        const rawTranscriptFormatted = interview.transcript_formatted as any;
        const transcriptData = safeSanitizeTranscriptPayload(
          rawTranscriptFormatted,
        );

        // Diagnostic: trace words through the pipeline
        consola.info("[ExtractEvidence] Words diagnostic", {
          rawHasWords: Array.isArray(rawTranscriptFormatted?.words),
          rawWordsCount: rawTranscriptFormatted?.words?.length ?? 0,
          rawWordsSample: rawTranscriptFormatted?.words?.slice?.(0, 2) ?? null,
          sanitizedHasWords: Array.isArray(transcriptData.words),
          sanitizedWordsCount: transcriptData.words?.length ?? 0,
          sanitizedWordsSample: transcriptData.words?.slice?.(0, 2) ?? null,
          rawKeys: rawTranscriptFormatted
            ? Object.keys(rawTranscriptFormatted)
            : [],
        });

        // Guard: ensure transcript has speech before calling expensive AI extraction
        if (
          transcriptData.speaker_transcripts.length === 0 &&
          (!fullTranscript || fullTranscript.trim().length === 0)
        ) {
          throw new Error(
            `[extract-evidence] No speech content available for interview ${interviewId}. ` +
              `speaker_transcripts: ${transcriptData.speaker_transcripts.length}, ` +
              `fullTranscript length: ${fullTranscript?.length ?? 0}. ` +
              `The audio file likely contains no detectable speech.`,
          );
        }

        // Call v2 core with people hooks and progress callback for heartbeat safety
        const extraction = await extractEvidenceCore({
          db: client as any,
          metadata: {
            ...(metadata ?? {}),
            // Always trust the interview record for these authoritative fields
            accountId: interview.account_id,
            projectId: interview.project_id || undefined,
            triggerRunId: ctx.run.id,
          },
          interviewRecord: interview as any,
          transcriptData: transcriptData as any,
          language,
          fullTranscript,
          analysisJobId,
          // Progress callback - keeps task alive during long BAML calls
          onProgress: async ({ phase, progress, detail }) => {
            consola.info(
              `[ExtractEvidence] Progress: ${phase} ${progress}% - ${detail}`,
            );
            // Update analysis job progress
            if (analysisJobId) {
              await updateAnalysisJobProgress(client, analysisJobId, {
                currentStep: "evidence",
                progress: 40 + Math.round(progress * 0.15), // Map 0-100 to 40-55
                statusDetail: detail,
              });
            }
            // Update interview processing_metadata
            await client
              .from("interviews")
              .update({
                processing_metadata: {
                  current_step: "evidence",
                  progress: 40 + Math.round(progress * 0.15),
                  status_detail: detail,
                  trigger_run_id: ctx.run.id,
                },
              })
              .eq("id", interviewId);
            await heartbeats.yield();
          },
          peopleHooks: {
            normalizeSpeakerLabel,
            isPlaceholderPerson,
            upsertPerson: async (payload) => {
              // Use shared resolution module for consistent person matching
              const result = await resolveOrCreatePerson(
                client as any,
                interview.account_id,
                interview.project_id || "",
                {
                  name: payload.name || undefined,
                  firstname: payload.firstname || undefined,
                  lastname: payload.lastname || undefined,
                  primary_email: payload.primary_email || undefined,
                  company: payload.company || undefined,
                  title: payload.title || undefined,
                  job_function:
                    (payload as Record<string, unknown>).job_function &&
                    typeof (payload as Record<string, unknown>).job_function ===
                      "string"
                      ? ((payload as Record<string, unknown>)
                          .job_function as string)
                      : undefined,
                  person_type: payload.person_type ?? undefined,
                  source: "baml_extraction",
                },
              );
              // Return format expected by extractEvidenceCore
              return { id: result.person.id, name: result.person.name };
            },
          },
        });

        if (analysisJobId) {
          await saveWorkflowState(client, analysisJobId, {
            evidenceIds: extraction.insertedEvidenceIds,
            evidenceUnits: extraction.evidenceUnits,
            personId: extraction.personData?.id || null,
            completedSteps: ["upload", "evidence"],
            currentStep: "evidence",
            interviewId,
          });

          await updateAnalysisJobProgress(client, analysisJobId, {
            progress: 55,
            statusDetail: `Extracted ${extraction.insertedEvidenceIds.length} evidence units`,
          });
        }

        return {
          evidenceIds: extraction.insertedEvidenceIds,
          evidenceUnits: extraction.evidenceUnits,
          personId: extraction.personData?.id || null,
        };
      } finally {
        clearInterval(heartbeatInterval);
        await heartbeats.yield();
      }
    } catch (error) {
      await client
        .from("interviews")
        .update({
          processing_metadata: {
            current_step: "evidence",
            progress: 40,
            failed_at: new Date().toISOString(),
            error: errorMessage(error),
            trigger_run_id: ctx.run.id,
          },
        })
        .eq("id", interviewId);

      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: "evidence",
        error: errorMessage(error),
      });

      throw error;
    }
  },
});
