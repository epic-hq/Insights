/**
 * V2 Process Interview Orchestrator
 *
 * Coordinates the entire interview processing workflow:
 * 1. Upload & Transcribe
 * 2. Extract Evidence
 * 3. Enrich Person (generate descriptions, link organizations)
 * 4. (skipped) Generate Insights — removed, run ad-hoc via generateInsightsTaskV2
 * 5. Assign Personas (parallel with answers)
 * 6. Attribute Answers (parallel with personas)
 * 7. Finalize Interview
 *
 * Key features:
 * - Resume from any step
 * - Skip steps for testing
 * - Persistent state management
 * - Independent task retry
 */

import { task } from "@trigger.dev/sdk";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "./config";
import { uploadAndTranscribeTaskV2 } from "./uploadAndTranscribe";
import { extractEvidenceTaskV2 } from "./extractEvidence";
import { enrichPersonTaskV2 } from "./enrichPerson";
// generate-insights removed from orchestrator flow — run ad-hoc instead.
// See bead Insights-vpws. Import kept for type reference if needed.
// import { generateInsightsTaskV2 } from "./generateInsights";
import { assignPersonasTaskV2 } from "./assignPersonas";
import { attributeAnswersTaskV2 } from "./attributeAnswers";
import { finalizeInterviewTaskV2 } from "./finalizeInterview";
import {
  loadWorkflowState,
  saveWorkflowState,
  initializeWorkflowState,
  shouldExecuteStep,
  updateAnalysisJobError,
  errorMessage,
} from "./state";
import type {
  ProcessInterviewOrchestratorPayload,
  ProcessInterviewOrchestratorResult,
  WorkflowState,
  WorkflowStep,
} from "./types";

export const processInterviewOrchestratorV2 = task({
  id: "interview.v2.orchestrator",
  retry: workflowRetryConfig,
  run: async (
    payload: ProcessInterviewOrchestratorPayload,
    { ctx },
  ): Promise<ProcessInterviewOrchestratorResult> => {
    const {
      metadata,
      mediaUrl,
      transcriptData,
      existingInterviewId,
      analysisJobId,
      userCustomInstructions,
      resumeFrom,
      skipSteps = [],
    } = payload;

    const client = createSupabaseAdminClient();

    if (!analysisJobId) {
      throw new Error("analysisJobId is required for orchestrator");
    }

    // Load or initialize state
    let state = await loadWorkflowState(client, analysisJobId);

    if (!state) {
      // Initialize new workflow
      consola.info(
        `[Orchestrator] Initializing new workflow for job ${analysisJobId}`,
      );
      consola.info(
        `[Orchestrator] existingInterviewId:`,
        existingInterviewId || "NOT PROVIDED",
      );
      state = {
        interviewId: existingInterviewId || "",
        completedSteps: [],
        currentStep: "upload",
        lastUpdated: new Date().toISOString(),
      };
    } else {
      consola.info(
        `[Orchestrator] Resuming workflow for job ${analysisJobId}`,
        `InterviewId: ${state.interviewId || "MISSING"}`,
        `Current step: ${state.currentStep}`,
        `Completed: ${state.completedSteps.join(", ")}`,
      );
    }

    // Determine starting point
    const startFrom = resumeFrom || "upload";

    // Validate required data for resume points
    if (startFrom === "evidence" && !state.fullTranscript) {
      // Need to load transcript from interview record
      const { data: interview } = await client
        .from("interviews")
        .select("transcript, transcript_formatted")
        .eq("id", state.interviewId)
        .single();

      if (interview) {
        const transcriptFormatted = interview.transcript_formatted as any;
        state.fullTranscript = interview.transcript || "";
        state.language =
          transcriptFormatted?.language ||
          transcriptFormatted?.detected_language ||
          "en";
        state.transcriptData =
          transcriptData || (transcriptFormatted as Record<string, unknown>);
      }
    }

    // Note: insights step removed from orchestrator flow — run ad-hoc instead.

    try {
      // Initialize processing_metadata at workflow start
      if (state.interviewId) {
        await client
          .from("interviews")
          .update({
            status: "processing",
            processing_metadata: {
              current_step: startFrom || "upload",
              progress: 0,
              started_at: new Date().toISOString(),
              trigger_run_id: ctx.run.id,
            },
          })
          .eq("id", state.interviewId);
      }

      // Step 1: Upload & Transcribe
      if (
        shouldExecuteStep("upload", startFrom, state) &&
        !skipSteps.includes("upload")
      ) {
        consola.info("[Orchestrator] Executing: Upload & Transcribe");

        const result = await uploadAndTranscribeTaskV2.triggerAndWait({
          metadata,
          mediaUrl,
          transcriptData,
          existingInterviewId: state.interviewId || existingInterviewId,
          analysisJobId,
        });

        if (!result.ok) {
          throw new Error(`Upload and transcribe failed: ${result.error}`);
        }

        consola.info("[Orchestrator] Upload result received:", {
          interviewId: result.output.interviewId,
          fullTranscriptLength: result.output.fullTranscript?.length ?? 0,
          language: result.output.language,
        });

        // Update state
        state.interviewId = result.output.interviewId;
        state.fullTranscript = result.output.fullTranscript;
        state.language = result.output.language;
        state.transcriptData = result.output.transcriptData;
        state.completedSteps = [
          ...new Set([...state.completedSteps, "upload"]),
        ];
        state.currentStep = "upload";

        consola.info("[Orchestrator] Saving state after upload:", {
          interviewId: state.interviewId,
          completedSteps: state.completedSteps,
        });

        await saveWorkflowState(client, analysisJobId, state);

        consola.success(
          "[Orchestrator] ✓ Upload & Transcribe complete, state saved",
        );
      } else {
        consola.info("[Orchestrator] Skipping: Upload & Transcribe");
      }

      // Step 2: Extract Evidence
      if (
        shouldExecuteStep("evidence", startFrom, state) &&
        !skipSteps.includes("evidence")
      ) {
        consola.info("[Orchestrator] Executing: Extract Evidence");

        // Validate required state before proceeding
        if (!state.interviewId) {
          const errorMsg =
            `Cannot execute evidence extraction: interviewId is missing from workflow state. ` +
            `State has: ${JSON.stringify({ interviewId: state.interviewId, completedSteps: state.completedSteps })}`;
          consola.error(`[Orchestrator] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // fullTranscript is now optional - will be extracted from transcript_formatted if not provided

        consola.info(
          `[Orchestrator] State validation passed: interviewId=${state.interviewId}`,
        );

        // Use attempt-based idempotency to avoid hitting stale runs on retry
        // ctx.run.id changes per orchestrator attempt, ensuring fresh child task
        const extractIdempotencyKey = `extract-${state.interviewId}-${ctx.run.id}`;
        consola.info(
          `[Orchestrator] Triggering extractEvidence with idempotencyKey: ${extractIdempotencyKey}`,
        );

        const result = await extractEvidenceTaskV2.triggerAndWait(
          {
            interviewId: state.interviewId,
            fullTranscript: state.fullTranscript,
            language: state.language || "en",
            analysisJobId,
            metadata,
          },
          {
            idempotencyKey: extractIdempotencyKey,
          },
        );

        if (!result.ok) {
          throw new Error(`Evidence extraction failed: ${result.error}`);
        }

        // Update state
        state.evidenceIds = result.output.evidenceIds;
        state.evidenceUnits = result.output.evidenceUnits;
        state.personId = result.output.personId || undefined;
        state.completedSteps = [
          ...new Set([...state.completedSteps, "evidence"]),
        ];
        state.currentStep = "evidence";

        await saveWorkflowState(client, analysisJobId, state);
        consola.success("[Orchestrator] ✓ Extract Evidence complete");
      } else {
        consola.info("[Orchestrator] Skipping: Extract Evidence");
      }

      // Step 3: Enrich Person (generate descriptions, link organizations)
      if (
        shouldExecuteStep("enrich-person", startFrom, state) &&
        !skipSteps.includes("enrich-person")
      ) {
        consola.info("[Orchestrator] Executing: Enrich Person");

        const enrichIdempotencyKey = `enrich-${state.interviewId}-${ctx.run.id}`;
        const result = await enrichPersonTaskV2.triggerAndWait(
          {
            interviewId: state.interviewId,
            projectId: metadata.projectId,
            accountId: metadata.accountId,
            personId: state.personId || null,
            analysisJobId,
          },
          { idempotencyKey: enrichIdempotencyKey },
        );

        if (!result.ok) {
          throw new Error(`Enrich person failed: ${result.error}`);
        }

        // Update state
        state.completedSteps = [
          ...new Set([...state.completedSteps, "enrich-person"]),
        ];
        state.currentStep = "enrich-person";

        await saveWorkflowState(client, analysisJobId, state);
        consola.success("[Orchestrator] ✓ Enrich Person complete");
      } else {
        consola.info("[Orchestrator] Skipping: Enrich Person");
      }

      // Step 4: Generate Insights — removed from orchestrator flow.
      // Insights (themes) can be generated ad-hoc via generateInsightsTaskV2.
      // This avoids blocking the pipeline on large transcripts that exceed context limits.
      consola.info(
        "[Orchestrator] Skipping: Generate Insights (removed from default flow — run ad-hoc)",
      );
      state.completedSteps = [
        ...new Set([...state.completedSteps, "insights"]),
      ];
      state.currentStep = "insights";
      await saveWorkflowState(client, analysisJobId, state);

      // Steps 5 & 6: Assign Personas + Attribute Answers (can run in parallel in future)
      // For now, run sequentially for simplicity

      // Step 5: Assign Personas
      if (
        shouldExecuteStep("personas", startFrom, state) &&
        !skipSteps.includes("personas")
      ) {
        consola.info("[Orchestrator] Executing: Assign Personas");

        const personasIdempotencyKey = `personas-${state.interviewId}-${ctx.run.id}`;
        const result = await assignPersonasTaskV2.triggerAndWait(
          {
            interviewId: state.interviewId,
            projectId: metadata.projectId,
            personId: state.personId || null,
            evidenceUnits: state.evidenceUnits!,
            analysisJobId,
          },
          { idempotencyKey: personasIdempotencyKey },
        );

        if (!result.ok) {
          throw new Error(`Assign personas failed: ${result.error}`);
        }

        // Update state
        state.personaIds = result.output.personaIds;
        state.completedSteps = [
          ...new Set([...state.completedSteps, "personas"]),
        ];
        state.currentStep = "personas";

        await saveWorkflowState(client, analysisJobId, state);
        consola.success("[Orchestrator] ✓ Assign Personas complete");
      } else {
        consola.info("[Orchestrator] Skipping: Assign Personas");
      }

      // Step 6: Attribute Answers
      if (
        shouldExecuteStep("answers", startFrom, state) &&
        !skipSteps.includes("answers")
      ) {
        consola.info("[Orchestrator] Executing: Attribute Answers");

        const answersIdempotencyKey = `answers-${state.interviewId}-${ctx.run.id}`;
        await attributeAnswersTaskV2.triggerAndWait(
          {
            interviewId: state.interviewId,
            projectId: metadata.projectId,
            evidenceIds: state.evidenceIds!,
            analysisJobId,
          },
          { idempotencyKey: answersIdempotencyKey },
        );

        // Update state
        state.completedSteps = [
          ...new Set([...state.completedSteps, "answers"]),
        ];
        state.currentStep = "answers";

        await saveWorkflowState(client, analysisJobId, state);
        consola.success("[Orchestrator] ✓ Attribute Answers complete");
      } else {
        consola.info("[Orchestrator] Skipping: Attribute Answers");
      }

      // Speaker Review Check: Detect placeholder speakers (Speaker A/B/C)
      consola.info("[Orchestrator] Checking for placeholder speakers...");
      await detectAndFlagPlaceholderSpeakers(
        client,
        state.interviewId,
        metadata,
      );

      // Step 7: Finalize Interview
      if (
        shouldExecuteStep("finalize", startFrom, state) &&
        !skipSteps.includes("finalize")
      ) {
        consola.info("[Orchestrator] Executing: Finalize Interview");

        const finalizeIdempotencyKey = `finalize-${state.interviewId}-${ctx.run.id}`;
        await finalizeInterviewTaskV2.triggerAndWait(
          {
            interviewId: state.interviewId,
            analysisJobId,
            metadata,
            evidenceIds: state.evidenceIds,
            insightIds: state.insightIds,
            fullTranscript: state.fullTranscript,
          },
          { idempotencyKey: finalizeIdempotencyKey },
        );

        // Update state
        state.completedSteps = [
          ...new Set([...state.completedSteps, "finalize"]),
        ];
        state.currentStep = "finalize";

        await saveWorkflowState(client, analysisJobId, state);
        consola.success("[Orchestrator] ✓ Finalize Interview complete");
      } else {
        consola.info("[Orchestrator] Skipping: Finalize Interview");
      }

      consola.success(
        `[Orchestrator] Workflow complete for interview ${state.interviewId}`,
        `Completed steps: ${state.completedSteps.join(", ")}`,
      );

      return {
        success: true,
        interviewId: state.interviewId,
        completedSteps: state.completedSteps,
      };
    } catch (error) {
      // Save state even on error so we can resume
      await saveWorkflowState(client, analysisJobId, state);

      consola.error(
        `[Orchestrator] Workflow failed at step ${state.currentStep}`,
        errorMessage(error),
      );

      // Update processing_metadata on error
      if (state.interviewId) {
        await client
          .from("interviews")
          .update({
            status: "error",
            processing_metadata: {
              current_step: state.currentStep,
              progress: 0,
              failed_at: new Date().toISOString(),
              error: errorMessage(error),
              trigger_run_id: ctx.run.id,
            },
          })
          .eq("id", state.interviewId);
      }

      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: state.currentStep,
        error: errorMessage(error),
      });

      throw error;
    }
  },
});

/**
 * Detect placeholder speakers (Speaker A, Speaker B, etc.) and flag interview for review
 */
async function detectAndFlagPlaceholderSpeakers(
  client: ReturnType<typeof createSupabaseAdminClient>,
  interviewId: string,
  metadata: Record<string, any>,
) {
  const PLACEHOLDER_PATTERN = /^Speaker [A-Z]$/i;

  try {
    // Get all people linked to this interview
    const { data: interviewPeople, error: fetchError } = await client
      .from("interview_people")
      .select(
        `
				id,
				person_id,
				display_name,
				people:person_id (
					id,
					name
				)
			`,
      )
      .eq("interview_id", interviewId);

    if (fetchError) {
      consola.error(
        `[detectPlaceholderSpeakers] Failed to fetch interview people for ${interviewId}:`,
        fetchError,
      );
      return;
    }

    // Check if any person has a placeholder name
    const hasPlaceholders = interviewPeople?.some((ip) => {
      const personName = (ip.people as any)?.name || ip.display_name;
      return personName && PLACEHOLDER_PATTERN.test(personName);
    });

    if (hasPlaceholders) {
      consola.warn(
        `[detectPlaceholderSpeakers] Found placeholder speakers in interview ${interviewId}`,
      );

      // Flag the interview
      const { error: updateError } = await client
        .from("interviews")
        .update({ speaker_review_needed: true })
        .eq("id", interviewId);

      if (updateError) {
        consola.error(
          `[detectPlaceholderSpeakers] Failed to flag interview ${interviewId}:`,
          updateError,
        );
        return;
      }

      // Get interview details for task creation
      const { data: interview, error: interviewError } = await client
        .from("interviews")
        .select("title, project_id, account_id")
        .eq("id", interviewId)
        .single();

      if (interviewError || !interview) {
        consola.error(
          `[detectPlaceholderSpeakers] Failed to fetch interview for task:`,
          interviewError,
        );
        return;
      }

      // Create hygiene task
      const taskTitle = `#speakers Review speakers: ${interview.title || "Untitled Interview"}`;
      const { error: taskError } = await client.from("tasks").insert({
        account_id: interview.account_id,
        project_id: interview.project_id,
        title: taskTitle,
        description: `This interview has placeholder speaker names (Speaker A, Speaker B, etc.). Please identify and link the actual participants.`,
        status: "open",
        metadata: {
          interviewId,
          action: "speaker_review",
          hygiene: true,
          placeholderPattern: "Speaker A/B/C",
        },
      });

      if (taskError) {
        consola.error(
          `[detectPlaceholderSpeakers] Failed to create task:`,
          taskError,
        );
        return;
      }

      consola.success(
        `[detectPlaceholderSpeakers] ✓ Created speaker review task for interview ${interviewId}`,
      );
    } else {
      consola.info(
        `[detectPlaceholderSpeakers] No placeholder speakers found in interview ${interviewId}`,
      );
    }
  } catch (error) {
    consola.error(
      `[detectPlaceholderSpeakers] Unexpected error for interview ${interviewId}:`,
      error,
    );
    // Don't throw - this is a non-critical hygiene check
  }
}
