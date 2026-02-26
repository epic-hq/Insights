/**
 * Backfill conversation-overview lens for interviews with unlinked insights.
 *
 * Finds interviews where the conversation analysis has key takeaways with
 * empty supportingEvidenceIds, then re-runs the conversation-overview lens
 * to regenerate takeaways with proper evidence linking.
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";

import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "../interview/v2/config";
import { applyLensTask } from "./applyLens";

export type BackfillConversationOverviewPayload = {
  /** Limit the number of interviews to process */
  limit?: number;
  /** Only process interviews in this project */
  projectId?: string;
};

export const backfillConversationOverviewTask = task({
  id: "lens.backfill-conversation-overview",
  retry: workflowRetryConfig,

  run: async (payload: BackfillConversationOverviewPayload) => {
    const supabase = createSupabaseAdminClient();
    const batchLimit = payload.limit ?? 50;

    metadata.set("stageLabel", "Finding interviews needing re-analysis...");
    metadata.set("progressPercent", 5);

    // Find interviews that have a conversation-overview lens analysis
    // but where the analysis may have stale/unlinked evidence references
    let query = supabase
      .from("conversation_lens_analyses")
      .select("interview_id, interviews!inner(id, account_id, project_id)")
      .eq("template_key", "conversation-overview")
      .eq("status", "completed")
      .limit(batchLimit);

    if (payload.projectId) {
      query = query.eq("interviews.project_id", payload.projectId);
    }

    const { data: analyses, error } = await query;

    if (error) {
      consola.error("Failed to find interviews for backfill:", error.message);
      throw new Error(error.message);
    }

    if (!analyses || analyses.length === 0) {
      consola.info("No interviews found needing conversation-overview backfill");
      metadata.set("stageLabel", "No interviews need backfill");
      metadata.set("progressPercent", 100);
      return { processed: 0, total: 0 };
    }

    const total = analyses.length;
    consola.info(`Found ${total} interviews to backfill conversation-overview`);
    metadata.set("stageLabel", `Processing ${total} interviews...`);

    let processed = 0;
    const errors: Array<{ interviewId: string; error: string }> = [];

    for (const analysis of analyses) {
      const interviewId = analysis.interview_id;
      const interview = analysis.interviews as unknown as {
        id: string;
        account_id: string;
        project_id: string;
      };

      try {
        await applyLensTask.triggerAndWait({
          interviewId,
          templateKey: "conversation-overview",
          accountId: interview.account_id,
          projectId: interview.project_id,
        });
        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        consola.error(`Failed to backfill interview ${interviewId}:`, message);
        errors.push({ interviewId, error: message });
      }

      const percent = Math.round(((processed + errors.length) / total) * 100);
      metadata.set("progressPercent", Math.min(percent, 99));
      metadata.set(
        "stageLabel",
        `Processed ${processed + errors.length}/${total} (${errors.length} errors)`,
      );
    }

    metadata.set("progressPercent", 100);
    metadata.set("stageLabel", `Done: ${processed} succeeded, ${errors.length} failed`);

    return { processed, total, errors };
  },
});
