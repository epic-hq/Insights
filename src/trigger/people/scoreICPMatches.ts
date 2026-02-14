/**
 * Score ICP Matches Task
 *
 * Batch scores all people in a project against ICP (Ideal Customer Profile) criteria.
 * Stores results in person_scale table with kind_slug='icp_match'.
 *
 * Used by recommendation engine to identify:
 * - High-ICP contacts getting stale (need re-engagement)
 * - High-ICP matches never interviewed (great prospects)
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";
import { calculateICPScore } from "~/features/people/services/calculateICPScore.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "../interview/v2/config";

// Progress stages
const STAGES = {
  loading: { percent: 10, label: "Loading people..." },
  scoring: { percent: 50, label: "Scoring ICP matches..." },
  saving: { percent: 90, label: "Saving results..." },
  complete: { percent: 100, label: "Complete!" },
} as const;

function setProgress(
  stage: keyof typeof STAGES,
  current?: number,
  total?: number,
) {
  const { percent, label } = STAGES[stage];
  metadata.set("progressPercent", percent);
  metadata.set(
    "stageLabel",
    current && total ? `${label} (${current}/${total})` : label,
  );
  metadata.set("stage", stage);
}

export type ScoreICPMatchesPayload = {
  projectId: string;
  accountId: string;
  personId?: string; // Optional - score just one person
  force?: boolean; // Re-score even if exists
};

export type ScoreICPMatchesResult = {
  processed: number;
  updated: number;
  skipped: number;
  indeterminate: number;
  errors: Array<{ personId: string; error: string }>;
};

export const scoreICPMatchesTask = task({
  id: "people.score-icp-matches",
  retry: workflowRetryConfig,
  run: async (
    payload: ScoreICPMatchesPayload,
    { ctx },
  ): Promise<ScoreICPMatchesResult> => {
    const { projectId, accountId, personId, force = false } = payload;

    consola.info("[scoreICPMatches] Starting", {
      projectId,
      accountId,
      personId,
      force,
    });

    const supabase = createSupabaseAdminClient();

    setProgress("loading");

    // Fetch people to score
    let peopleQuery = supabase
      .from("people")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (personId) {
      peopleQuery = peopleQuery.eq("id", personId);
    }

    const { data: people, error: peopleError } = await peopleQuery;

    if (peopleError) {
      consola.error("[scoreICPMatches] Failed to fetch people:", peopleError);
      throw new Error("Failed to fetch people");
    }

    if (!people || people.length === 0) {
      consola.warn("[scoreICPMatches] No people found");
      return {
        processed: 0,
        updated: 0,
        skipped: 0,
        indeterminate: 0,
        errors: [],
      };
    }

    consola.info(`[scoreICPMatches] Found ${people.length} people to score`);

    // If not forcing, check which people already have scores
    let alreadyScoredIds = new Set<string>();
    if (!force) {
      const { data: existingScores } = await supabase
        .from("person_scale")
        .select("person_id")
        .eq("project_id", projectId)
        .eq("kind_slug", "icp_match")
        .in(
          "person_id",
          people.map((p) => p.id),
        );

      if (existingScores) {
        alreadyScoredIds = new Set(existingScores.map((s) => s.person_id));
        consola.info(
          `[scoreICPMatches] Skipping ${alreadyScoredIds.size} already-scored people`,
        );
      }
    }

    const result: ScoreICPMatchesResult = {
      processed: 0,
      updated: 0,
      skipped: 0,
      indeterminate: 0,
      errors: [],
    };

    setProgress("scoring");

    // Process each person
    for (let i = 0; i < people.length; i++) {
      const person = people[i];

      // Skip if already scored (unless force=true)
      if (!force && alreadyScoredIds.has(person.id)) {
        result.skipped++;
        continue;
      }

      try {
        // Calculate ICP score
        const scoreBreakdown = await calculateICPScore({
          supabase,
          accountId,
          projectId,
          personId: person.id,
        });

        const isIndeterminate = scoreBreakdown.overall_score == null;

        // Store in person_scale table (use 0 for null scores)
        const { error: upsertError } = await supabase
          .from("person_scale")
          .upsert(
            {
              person_id: person.id,
              account_id: accountId,
              project_id: projectId,
              kind_slug: "icp_match",
              score: scoreBreakdown.overall_score ?? 0,
              band: scoreBreakdown.band,
              source: "inferred",
              confidence: scoreBreakdown.confidence,
              noted_at: new Date().toISOString(),
            },
            { onConflict: "person_id,kind_slug" },
          );

        if (upsertError) {
          consola.error(
            `[scoreICPMatches] Failed to save score for ${person.name}:`,
            upsertError,
          );
          result.errors.push({
            personId: person.id,
            error: upsertError.message,
          });
        } else {
          result.updated++;
          if (isIndeterminate) {
            result.indeterminate++;
            consola.debug(
              `[scoreICPMatches] ${person.name}: indeterminate (no scorable dimensions)`,
            );
          } else {
            consola.debug(
              `[scoreICPMatches] Scored ${person.name}: ${scoreBreakdown.overall_score!.toFixed(2)} (${scoreBreakdown.band})`,
            );
          }
        }

        result.processed++;

        // Update progress every 10 people
        if (i % 10 === 0) {
          setProgress("scoring", i + 1, people.length);
        }
      } catch (error: any) {
        consola.error(`[scoreICPMatches] Error scoring ${person.name}:`, error);
        result.errors.push({
          personId: person.id,
          error: error?.message || "Unknown error",
        });
        result.processed++;
      }
    }

    setProgress("saving");

    consola.info("[scoreICPMatches] Complete", result);

    setProgress("complete");

    return result;
  },
});
