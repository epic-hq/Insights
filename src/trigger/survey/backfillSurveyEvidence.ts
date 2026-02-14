/**
 * Backfill Survey Evidence Task
 *
 * Processes all existing completed survey responses that don't yet
 * have evidence records. Can be run from Trigger.dev dashboard anytime.
 *
 * Triggers extractSurveyEvidenceTask for each response, so individual
 * responses are processed independently with their own retries.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../../app/lib/supabase/client.server";
import { extractSurveyEvidenceTask } from "./extractSurveyEvidence";

export const backfillSurveyEvidenceTask = schemaTask({
  id: "survey.backfill-evidence",
  schema: z.object({
    /** If true, reprocess all responses even if they already have evidence */
    force: z.boolean().default(false),
    /** Optional: limit to specific project */
    projectId: z.string().uuid().optional(),
    /** Optional: limit to specific research link */
    researchLinkId: z.string().uuid().optional(),
  }),
  retry: {
    maxAttempts: 1, // Don't retry the backfill itself, individual tasks have retries
  },
  run: async (payload) => {
    const { force, projectId, researchLinkId } = payload;
    const db = createSupabaseAdminClient();

    consola.info(`[backfillSurveyEvidence] Starting backfill`, {
      force,
      projectId,
      researchLinkId,
    });

    // 1. Find completed responses
    let query = db
      .from("research_link_responses")
      .select(
        `
        id,
        research_link_id,
        research_link:research_links!inner (
          project_id
        )
      `,
      )
      .eq("completed", true);

    if (researchLinkId) {
      query = query.eq("research_link_id", researchLinkId);
    }

    if (projectId) {
      query = query.eq("research_link.project_id", projectId);
    }

    const { data: responses, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to query responses: ${queryError.message}`);
    }

    if (!responses || responses.length === 0) {
      consola.info(`[backfillSurveyEvidence] No completed responses found`);
      return {
        success: true,
        processed: 0,
        skipped: 0,
        message: "No completed responses found",
      };
    }

    consola.info(
      `[backfillSurveyEvidence] Found ${responses.length} completed responses`,
    );

    // 2. If not forcing, filter out responses that already have evidence
    let responsesToProcess = responses;

    if (!force) {
      const responseIds = responses.map((r) => r.id);

      const { data: existingEvidence } = await db
        .from("evidence")
        .select("research_link_response_id")
        .in("research_link_response_id", responseIds);

      const hasEvidence = new Set(
        (existingEvidence ?? []).map((e) => e.research_link_response_id),
      );

      responsesToProcess = responses.filter((r) => !hasEvidence.has(r.id));

      consola.info(
        `[backfillSurveyEvidence] ${responses.length - responsesToProcess.length} responses already have evidence, ${responsesToProcess.length} to process`,
      );
    }

    // 3. Trigger extraction for each response
    let triggered = 0;
    const errors: string[] = [];

    for (const response of responsesToProcess) {
      try {
        await extractSurveyEvidenceTask.trigger({
          responseId: response.id,
        });
        triggered++;
      } catch (err) {
        const msg = `Failed to trigger for ${response.id}: ${err}`;
        consola.error(`[backfillSurveyEvidence] ${msg}`);
        errors.push(msg);
      }
    }

    consola.success(
      `[backfillSurveyEvidence] Complete: triggered ${triggered}/${responsesToProcess.length} tasks`,
    );

    return {
      success: errors.length === 0,
      total: responses.length,
      skipped: responses.length - responsesToProcess.length,
      triggered,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});
