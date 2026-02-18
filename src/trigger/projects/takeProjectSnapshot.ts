/**
 * Take Project Snapshot — daily snapshot of project metrics.
 *
 * Stores counts (interviews, surveys, themes, evidence, people) and
 * top themes in the project_snapshots table. Used by the ResearchPulse
 * gen-ui widget to compute week-over-week deltas.
 *
 * Can be triggered:
 * - On a daily cron schedule
 * - On-demand via the fetchResearchPulse Mastra tool
 */

import { task } from "@trigger.dev/sdk/v3";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

interface SnapshotData {
  interviewCount: number;
  surveyCount: number;
  themeCount: number;
  evidenceCount: number;
  peopleCount: number;
  topThemes: Array<{ id: string; name: string; evidenceCount: number }>;
}

export const takeProjectSnapshot = task({
  id: "projects.take-snapshot",
  run: async (payload: { projectId: string; accountId: string }) => {
    const { projectId, accountId } = payload;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- project_snapshots not in generated types yet
    const supabase = createSupabaseAdminClient() as any;

    consola.info("[snapshot] Taking project snapshot", {
      projectId,
      accountId,
    });

    // Gather counts in parallel
    const [
      interviewResult,
      surveyResult,
      themeResult,
      evidenceResult,
      peopleResult,
    ] = await Promise.all([
      supabase
        .from("interviews")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("research_links")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("type", "survey"),
      supabase
        .from("themes")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("evidence")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("project_people")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
    ]);

    // Top themes with evidence count
    const { data: topThemes } = await supabase
      .from("themes")
      .select("id, name, theme_evidence(count)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    const snapshotData: SnapshotData = {
      interviewCount: interviewResult.count ?? 0,
      surveyCount: surveyResult.count ?? 0,
      themeCount: themeResult.count ?? 0,
      evidenceCount: evidenceResult.count ?? 0,
      peopleCount: peopleResult.count ?? 0,
      topThemes: (topThemes ?? []).map((t) => ({
        id: t.id,
        name: t.name ?? "Untitled",
        evidenceCount: Array.isArray(t.theme_evidence)
          ? t.theme_evidence.length
          : 0,
      })),
    };

    // Upsert snapshot (one per project per day)
    const { error } = await supabase.from("project_snapshots").upsert(
      {
        project_id: projectId,
        account_id: accountId,
        snapshot_date: new Date().toISOString().split("T")[0],
        data: snapshotData as unknown as Record<string, unknown>,
      },
      { onConflict: "project_id,snapshot_date" },
    );

    if (error) {
      consola.error("[snapshot] Failed to save snapshot", { projectId, error });
      throw error;
    }

    consola.info("[snapshot] Snapshot saved", { projectId, snapshotData });
    return { success: true, data: snapshotData };
  },
});
