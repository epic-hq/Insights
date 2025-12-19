/**
 * Consolidate Themes Task
 *
 * Runs theme consolidation as a background task with real-time progress updates.
 * Uses metadata to report progress that can be subscribed to via Trigger.dev realtime.
 *
 * This MERGES similar existing themes (reducing total count) rather than creating new ones.
 *
 * Progress steps:
 * 1. Finding duplicate themes via embedding similarity
 * 2. Building clusters of similar themes
 * 3. Merging evidence links to canonical themes
 * 4. Deleting duplicate themes
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";
import { consolidateExistingThemes } from "~/features/themes/db.consolidate.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export interface ConsolidateThemesPayload {
  projectId: string;
  accountId: string;
  similarityThreshold?: number; // Default 0.85
}

export interface ConsolidateThemesResult {
  success: boolean;
  clustersFound: number;
  themesDeleted: number;
  evidenceMoved: number;
  errors: string[];
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
    const { projectId, similarityThreshold = 0.85 } = payload;
    const supabase = createSupabaseAdminClient();

    consola.info(`[consolidateThemes] Starting for project ${projectId}`);

    // Initialize progress
    metadata
      .set("step", "starting")
      .set("status", "Starting consolidation...")
      .set("progress", 5)
      .set("clustersFound", 0)
      .set("themesDeleted", 0)
      .set("evidenceMoved", 0);

    try {
      // Run the consolidation with progress callback
      const result = await consolidateExistingThemes({
        supabase: supabase as any,
        projectId,
        similarityThreshold,
        onProgress: (step, progress, message) => {
          metadata
            .set("step", step)
            .set("status", message)
            .set("progress", progress);
        },
      });

      // Update final metadata
      metadata
        .set("step", "complete")
        .set(
          "status",
          `Done: ${result.themesDeleted} themes merged, ${result.evidenceMoved} evidence links moved`,
        )
        .set("progress", 100)
        .set("clustersFound", result.clustersFound)
        .set("themesDeleted", result.themesDeleted)
        .set("evidenceMoved", result.evidenceMoved);

      consola.success(
        `[consolidateThemes] Complete: ${result.clustersFound} clusters found, ${result.themesDeleted} themes deleted, ${result.evidenceMoved} evidence moved`,
      );

      return {
        success: result.errors.length === 0,
        clustersFound: result.clustersFound,
        themesDeleted: result.themesDeleted,
        evidenceMoved: result.evidenceMoved,
        errors: result.errors,
        message:
          result.themesDeleted > 0
            ? `Merged ${result.themesDeleted} duplicate themes`
            : "No duplicate themes found to merge",
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
