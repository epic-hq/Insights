/**
 * Backfill Survey Evidence Task
 *
 * Finds all completed survey responses and triggers evidence extraction
 * for each one. Use this to process existing data that was completed
 * before the extraction pipeline was added.
 *
 * Can be triggered via:
 * - Script: `pnpm tsx scripts/backfill-survey-evidence.ts`
 * - Trigger.dev dashboard: manually trigger with optional filters
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { extractSurveyEvidenceTask } from "./extractSurveyEvidence";

export const backfillSurveyEvidenceTask = schemaTask({
  id: "survey.backfill-evidence",
  schema: z.object({
    // Optional filters
    accountId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    researchLinkId: z.string().uuid().optional(),
    // Limit for testing
    limit: z.number().min(1).max(1000).optional(),
    // Skip responses that already have evidence
    skipExisting: z.boolean().default(true),
  }),
  retry: {
    maxAttempts: 1, // Don't retry the backfill itself
  },
  run: async (payload) => {
    const { accountId, projectId, researchLinkId, limit, skipExisting } =
      payload;
    const db = createSupabaseAdminClient();

    consola.info(`[backfillSurveyEvidence] Starting backfill`, {
      accountId,
      projectId,
      researchLinkId,
      limit,
      skipExisting,
    });

    // Build query for completed responses
    let query = db
      .from("research_link_responses")
      .select(
        `
        id,
        research_link_id,
        research_link:research_links!inner (
          id,
          account_id,
          project_id
        )
      `,
      )
      .eq("completed", true);

    // Apply optional filters
    if (researchLinkId) {
      query = query.eq("research_link_id", researchLinkId);
    }
    if (accountId) {
      query = query.eq("research_link.account_id", accountId);
    }
    if (projectId) {
      query = query.eq("research_link.project_id", projectId);
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data: responses, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to query responses: ${queryError.message}`);
    }

    if (!responses || responses.length === 0) {
      consola.info(`[backfillSurveyEvidence] No completed responses found`);
      return {
        success: true,
        total: 0,
        triggered: 0,
        skipped: 0,
      };
    }

    consola.info(
      `[backfillSurveyEvidence] Found ${responses.length} completed responses`,
    );

    // If skipExisting, check which responses already have evidence
    let responseIdsToProcess = responses.map((r) => r.id);

    if (skipExisting) {
      const { data: existingEvidence } = await db
        .from("evidence")
        .select("research_link_response_id")
        .in("research_link_response_id", responseIdsToProcess)
        .not("research_link_response_id", "is", null);

      const existingIds = new Set(
        (existingEvidence ?? []).map((e) => e.research_link_response_id),
      );

      const beforeCount = responseIdsToProcess.length;
      responseIdsToProcess = responseIdsToProcess.filter(
        (id) => !existingIds.has(id),
      );

      consola.info(
        `[backfillSurveyEvidence] Skipping ${beforeCount - responseIdsToProcess.length} responses with existing evidence`,
      );
    }

    if (responseIdsToProcess.length === 0) {
      consola.info(
        `[backfillSurveyEvidence] All responses already have evidence`,
      );
      return {
        success: true,
        total: responses.length,
        triggered: 0,
        skipped: responses.length,
      };
    }

    // Trigger extraction for each response
    let triggered = 0;
    const errors: string[] = [];

    for (const responseId of responseIdsToProcess) {
      try {
        await extractSurveyEvidenceTask.trigger({ responseId });
        triggered++;
        consola.debug(
          `[backfillSurveyEvidence] Triggered extraction for ${responseId}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${responseId}: ${msg}`);
        consola.error(
          `[backfillSurveyEvidence] Failed to trigger for ${responseId}:`,
          msg,
        );
      }
    }

    const skipped = responses.length - responseIdsToProcess.length;

    consola.success(
      `[backfillSurveyEvidence] Complete: triggered=${triggered}, skipped=${skipped}, errors=${errors.length}`,
    );

    return {
      success: errors.length === 0,
      total: responses.length,
      triggered,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});
