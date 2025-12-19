/**
 * Consolidate Themes Task
 *
 * Runs theme consolidation as a background task with real-time progress updates.
 * Uses metadata to report progress that can be subscribed to via Trigger.dev realtime.
 *
 * Progress steps:
 * 1. Loading evidence
 * 2. Analyzing with AI (BAML AutoGroupThemes)
 * 3. Creating themes
 * 4. Linking evidence
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export interface ConsolidateThemesPayload {
  projectId: string;
  accountId: string;
  guidance?: string;
  limit?: number;
}

export interface ConsolidateThemesResult {
  success: boolean;
  themeCount: number;
  linkCount: number;
  themeIds: string[];
  message: string;
}

export const consolidateThemesTask = task({
  id: "themes.consolidate",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async (
    payload: ConsolidateThemesPayload,
  ): Promise<ConsolidateThemesResult> => {
    const { projectId, accountId, guidance = "", limit = 200 } = payload;
    const supabase = createSupabaseAdminClient();

    consola.info(`[consolidateThemes] Starting for project ${projectId}`);

    // Initialize progress
    metadata
      .set("step", "loading")
      .set("status", "Starting consolidation...")
      .set("progress", 5)
      .set("evidenceCount", 0)
      .set("themeCount", 0)
      .set("linkCount", 0);

    try {
      // Update progress - analyzing
      metadata
        .set("step", "analyzing")
        .set("status", "Analyzing evidence with AI...")
        .set("progress", 15);

      // Use the existing autoGroupThemesAndApply function
      // It handles loading evidence, calling BAML, creating themes, and linking
      const result = await autoGroupThemesAndApply({
        supabase: supabase as any, // Type mismatch between admin client and SupabaseClient
        account_id: accountId,
        project_id: projectId,
        guidance:
          guidance ||
          "Consolidate similar themes, merge duplicates, and ensure each theme has clear evidence links.",
        limit,
      });

      // Update progress to show we're done linking
      metadata
        .set("step", "linking")
        .set(
          "status",
          `Linked evidence to ${result.created_theme_ids.length} themes`,
        )
        .set("progress", 75)
        .set("themeCount", result.created_theme_ids.length);

      // Complete
      metadata
        .set("step", "complete")
        .set(
          "status",
          `Done: ${result.created_theme_ids.length} themes, ${result.link_count} links`,
        )
        .set("progress", 100)
        .set("themeCount", result.created_theme_ids.length)
        .set("linkCount", result.link_count);

      consola.success(
        `[consolidateThemes] Complete: ${result.created_theme_ids.length} themes, ${result.link_count} evidence links`,
      );

      return {
        success: true,
        themeCount: result.created_theme_ids.length,
        linkCount: result.link_count,
        themeIds: result.created_theme_ids,
        message: `Consolidated into ${result.created_theme_ids.length} themes with ${result.link_count} evidence links`,
      };
    } catch (error) {
      consola.error("[consolidateThemes] Error:", error);
      metadata
        .set("step", "error")
        .set(
          "status",
          error instanceof Error ? error.message : "Unknown error",
        );
      throw error;
    }
  },
});
