import { schedules } from "@trigger.dev/sdk";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import type { WorkflowStep } from "./types";
import { processInterviewOrchestratorV2 } from "./orchestrator";

const DEFERRED_STEPS: WorkflowStep[] = [
  "enrich-person",
  "personas",
  "answers",
];

const CORE_REQUIRED_STEPS: WorkflowStep[] = ["evidence", "finalize"];
const MAX_BATCH_SIZE = 25;
const SCAN_LIMIT = 250;

type InterviewRow = {
  id: string;
  account_id: string;
  project_id: string | null;
  created_by: string | null;
  status: string | null;
  conversation_analysis: Record<string, unknown> | null;
  updated_at: string | null;
};

function getCompletedSteps(
  conversationAnalysis: Record<string, unknown> | null,
): Set<string> {
  const topLevel = Array.isArray(conversationAnalysis?.completed_steps)
    ? (conversationAnalysis?.completed_steps as string[])
    : [];
  const workflowState =
    (conversationAnalysis?.workflow_state as { completedSteps?: string[] }) ??
    null;
  const nested = Array.isArray(workflowState?.completedSteps)
    ? workflowState.completedSteps
    : [];
  return new Set([...topLevel, ...nested]);
}

export const runDeferredInterviewBatchV2 = schedules.task({
  id: "interview.v2.deferred-batch",
  cron: "*/20 * * * *",
  run: async () => {
    const client = createSupabaseAdminClient();
    const now = Date.now();
    const idempotencyBucket = Math.floor(now / (20 * 60 * 1000));

    const { data, error } = await client
      .from("interviews")
      .select(
        "id, account_id, project_id, created_by, status, conversation_analysis, updated_at",
      )
      .not("conversation_analysis", "is", null)
      .order("updated_at", { ascending: false })
      .limit(SCAN_LIMIT);

    if (error) {
      throw new Error(
        `[interview.v2.deferred-batch] Failed loading candidates: ${error.message}`,
      );
    }

    const rows = (data ?? []) as InterviewRow[];
    const candidates: InterviewRow[] = [];
    for (const interview of rows) {
      if (!interview.id || !interview.account_id) continue;
      if (interview.status === "processing") continue;

      const completed = getCompletedSteps(interview.conversation_analysis);
      const hasCore = CORE_REQUIRED_STEPS.every((step) => completed.has(step));
      const needsDeferred = DEFERRED_STEPS.some(
        (step) => !completed.has(step),
      );

      if (hasCore && needsDeferred) {
        candidates.push(interview);
      }
      if (candidates.length >= MAX_BATCH_SIZE) break;
    }

    if (!candidates.length) {
      consola.info(
        "[interview.v2.deferred-batch] No interviews pending deferred steps",
      );
      return {
        scanned: rows.length,
        queued: 0,
      };
    }

    const queued: Array<{ interviewId: string; runId: string }> = [];
    for (const interview of candidates) {
      try {
        const handle = await processInterviewOrchestratorV2.trigger(
          {
            analysisJobId: interview.id,
            existingInterviewId: interview.id,
            mediaUrl: "",
            metadata: {
              accountId: interview.account_id,
              projectId: interview.project_id ?? undefined,
              userId: interview.created_by ?? undefined,
            },
            resumeFrom: "enrich-person",
            skipSteps: ["upload", "evidence", "finalize"],
            includeDeferredSteps: true,
          },
          {
            idempotencyKey: `interview-v2-deferred-${interview.id}-${idempotencyBucket}`,
          },
        );
        queued.push({ interviewId: interview.id, runId: handle.id });
      } catch (triggerError) {
        consola.warn(
          `[interview.v2.deferred-batch] Failed to queue deferred run for ${interview.id}`,
          triggerError,
        );
      }
    }

    consola.info(
      `[interview.v2.deferred-batch] Queued ${queued.length}/${candidates.length} interviews`,
    );

    return {
      scanned: rows.length,
      candidates: candidates.length,
      queued: queued.length,
      runs: queued,
    };
  },
});
