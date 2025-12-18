/**
 * Apply lenses to an interview based on project settings
 *
 * Triggered after interview finalization to automatically apply enabled lenses.
 * Voice memos and notes (lens_visibility = 'private') are skipped by default,
 * but can be processed when forceApply=true (manual "Apply lenses" requests).
 *
 * Lens resolution hierarchy:
 * 1. lensesToApply parameter (backfill, manual override)
 * 2. project_settings.enabled_lenses (if configured)
 * 3. account_settings.metadata.default_lens_keys (account defaults)
 * 4. LLM-determined interaction_context → context-appropriate lenses
 * 5. PLATFORM_DEFAULT_LENS_KEYS (platform fallback)
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";

import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "~/utils/processInterview.server";
import { applyLensTask } from "./applyLens";

/** Platform fallback when no defaults are configured */
const PLATFORM_DEFAULT_LENS_KEYS = ["customer-discovery"];

/** Context-specific lens mappings based on LLM-determined interaction_context */
const CONTEXT_LENS_MAPPINGS: Record<string, string[]> = {
  research: ["customer-discovery", "empathy-map-jtbd"],
  sales: ["sales-bant", "customer-discovery"],
  support: ["customer-discovery"], // Could add support-specific lens later
  internal: ["customer-discovery"], // Could add internal meeting lens later
  debrief: ["customer-discovery"], // Voice memos, call recaps, field notes
};

/**
 * Set progress metadata for the parent task
 */
function setAllLensesProgress(
  completed: number,
  total: number,
  currentLens?: string,
) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const label = currentLens
    ? `Applying ${currentLens} (${completed}/${total})`
    : `Applied ${completed}/${total} lenses`;

  metadata.set("progressPercent", percent);
  metadata.set("stageLabel", label);
  metadata.set("completed", completed);
  metadata.set("total", total);
  metadata.set("currentLens", currentLens || null);
}

export type ApplyAllLensesPayload = {
  interviewId: string;
  accountId: string;
  projectId?: string | null;
  computedBy?: string | null;
  /** Optional: only apply specific lenses instead of all */
  lensesToApply?: string[];
  /** Optional: bypass private lens_visibility check (for manual "Apply lenses" requests) */
  forceApply?: boolean;
};

export type ApplyAllLensesResult = {
  interviewId: string;
  skipped: boolean;
  reason?: string;
  results: Array<{
    templateKey: string;
    success: boolean;
    error?: string;
    confidenceScore?: number;
  }>;
};

export const applyAllLensesTask = task({
  id: "lens.apply-all-lenses",
  retry: workflowRetryConfig,
  run: async (
    payload: ApplyAllLensesPayload,
  ): Promise<ApplyAllLensesResult> => {
    const {
      interviewId,
      accountId,
      projectId,
      computedBy,
      lensesToApply,
      forceApply,
    } = payload;
    const client = createSupabaseAdminClient();

    consola.info(`[applyAllLenses] Starting for interview ${interviewId}`);

    // Check if interview should be processed and get the correct accountId from its project
    // Also fetch project_settings to get enabled_lenses and interaction_context for lens selection
    const { data: interview, error: interviewError } = (await (client as any)
      .from("interviews")
      .select(
        "id, lens_visibility, status, project_id, interaction_context, projects(account_id, project_settings)",
      )
      .eq("id", interviewId)
      .single()) as {
      data: {
        id: string;
        lens_visibility: string | null;
        status: string | null;
        project_id: string | null;
        interaction_context: string | null;
        projects: {
          account_id: string;
          project_settings: Record<string, unknown> | null;
        } | null;
      } | null;
      error: any;
    };

    if (interviewError || !interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }

    // Use the project's account_id to ensure tasks are created with the correct accountId
    const effectiveAccountId = interview.projects?.account_id || accountId;
    const effectiveProjectId = projectId || interview.project_id;

    if (effectiveAccountId !== accountId) {
      consola.warn(
        `[applyAllLenses] accountId mismatch: payload=${accountId}, project=${effectiveAccountId}. Using project's accountId.`,
      );
    }

    // Skip private interviews (voice memos, notes) unless forceApply is set
    if (interview.lens_visibility === "private" && !forceApply) {
      consola.info(
        `[applyAllLenses] Skipping private interview ${interviewId}`,
      );
      return {
        interviewId,
        skipped: true,
        reason: "private",
        results: [],
      };
    }

    if (interview.lens_visibility === "private" && forceApply) {
      consola.info(
        `[applyAllLenses] Force-applying lenses to private interview ${interviewId}`,
      );
    }

    // Determine which lenses to apply using hierarchy:
    // 1. If lensesToApply is provided (e.g., from backfill), use that
    // 2. project_settings.enabled_lenses (if configured)
    // 3. account_settings.metadata.default_lens_keys (account defaults)
    // 4. LLM-determined interaction_context → context-appropriate lenses
    // 5. PLATFORM_DEFAULT_LENS_KEYS (platform fallback)
    let lenses: string[];
    let lensSource: string;

    if (lensesToApply && lensesToApply.length > 0) {
      lenses = lensesToApply;
      lensSource = "provided";
      consola.info(
        `[applyAllLenses] Using provided lenses: ${lenses.join(", ")}`,
      );
    } else {
      const projectSettings = interview.projects?.project_settings || {};
      const projectEnabledLenses = projectSettings.enabled_lenses as
        | string[]
        | undefined;

      if (projectEnabledLenses && projectEnabledLenses.length > 0) {
        lenses = projectEnabledLenses;
        lensSource = "project_settings";
        consola.info(
          `[applyAllLenses] Using project settings: ${lenses.join(", ")}`,
        );
      } else {
        // Fall back to account defaults
        const { data: accountSettings } = (await (client as any)
          .from("account_settings")
          .select("metadata")
          .eq("account_id", effectiveAccountId)
          .maybeSingle()) as {
          data: { metadata: Record<string, unknown> } | null;
        };

        const accountMetadata = accountSettings?.metadata || {};
        const accountDefaultLenses = accountMetadata.default_lens_keys as
          | string[]
          | undefined;

        if (accountDefaultLenses && accountDefaultLenses.length > 0) {
          lenses = accountDefaultLenses;
          lensSource = "account_defaults";
          consola.info(
            `[applyAllLenses] Using account defaults: ${lenses.join(", ")}`,
          );
        } else if (
          interview.interaction_context &&
          CONTEXT_LENS_MAPPINGS[interview.interaction_context]
        ) {
          // Use LLM-determined interaction context for lens selection
          lenses = [...CONTEXT_LENS_MAPPINGS[interview.interaction_context]];
          lensSource = `interaction_context:${interview.interaction_context}`;
          consola.info(
            `[applyAllLenses] Using interaction_context "${interview.interaction_context}" lenses: ${lenses.join(", ")}`,
          );
        } else {
          lenses = [...PLATFORM_DEFAULT_LENS_KEYS];
          lensSource = "platform_defaults";
          consola.info(
            `[applyAllLenses] Using platform defaults: ${lenses.join(", ")}`,
          );
        }
      }
    }
    const totalLenses = lenses.length;

    consola.info(
      `[applyAllLenses] Applying ${totalLenses} lenses to ${interviewId}`,
    );

    // Initialize progress
    setAllLensesProgress(0, totalLenses, lenses[0]);

    // Apply each lens sequentially to avoid overwhelming BAML
    // In production, could use batchTriggerAndWait for parallelism
    const results: ApplyAllLensesResult["results"] = [];

    for (let i = 0; i < lenses.length; i++) {
      const templateKey = lenses[i];

      // Update progress with current lens
      setAllLensesProgress(i, totalLenses, templateKey);

      try {
        consola.info(`[applyAllLenses] Triggering ${templateKey}...`);

        const result = await applyLensTask.triggerAndWait({
          interviewId,
          templateKey,
          accountId: effectiveAccountId,
          projectId: effectiveProjectId,
          computedBy,
        });

        if (result.ok) {
          results.push({
            templateKey,
            success: true,
            confidenceScore: result.output.confidenceScore,
          });
          consola.success(`[applyAllLenses] ✓ ${templateKey} complete`);
        } else {
          results.push({
            templateKey,
            success: false,
            error: String(result.error),
          });
          consola.error(
            `[applyAllLenses] ✗ ${templateKey} failed:`,
            result.error,
          );
        }
      } catch (error) {
        results.push({
          templateKey,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        consola.error(`[applyAllLenses] ✗ ${templateKey} threw:`, error);
      }

      // Update progress after each lens completes
      setAllLensesProgress(i + 1, totalLenses);
    }

    const successCount = results.filter((r) => r.success).length;
    consola.info(
      `[applyAllLenses] Completed ${successCount}/${lenses.length} lenses for ${interviewId}`,
    );

    return {
      interviewId,
      skipped: false,
      results,
    };
  },
});

/**
 * Export task for type inference
 */
export type ApplyAllLensesTask = typeof applyAllLensesTask;
