/**
 * Theme Consolidation Logic
 *
 * Consolidates similar themes by:
 * 1. Finding duplicate theme pairs using embedding similarity
 * 2. Building clusters of related themes
 * 3. Picking the canonical theme (most evidence) for each cluster
 * 4. Merging evidence links from duplicates to canonical
 * 5. Deleting duplicate themes
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";

interface DuplicateThemePair {
  theme_id_1: string;
  theme_id_2: string;
  theme_name_1: string;
  theme_name_2: string;
  similarity: number;
}

interface ThemeWithEvidenceCount {
  id: string;
  name: string;
  evidenceCount: number;
}

interface ConsolidationResult {
  clustersFound: number;
  themesDeleted: number;
  evidenceMoved: number;
  errors: string[];
}

/**
 * Consolidate similar themes within a project
 *
 * @param supabase - Supabase client (admin or user)
 * @param projectId - Project to consolidate themes for
 * @param similarityThreshold - Minimum similarity for themes to be considered duplicates (0.0-1.0)
 * @param onProgress - Optional callback for progress updates
 */
export async function consolidateExistingThemes({
  supabase,
  projectId,
  similarityThreshold = 0.85,
  onProgress,
}: {
  supabase: SupabaseClient;
  projectId: string;
  similarityThreshold?: number;
  onProgress?: (step: string, progress: number, message: string) => void;
}): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    clustersFound: 0,
    themesDeleted: 0,
    evidenceMoved: 0,
    errors: [],
  };

  consola.info(`[consolidate] Starting consolidation for project ${projectId}`);
  consola.info(
    `[consolidate] Settings: similarityThreshold=${similarityThreshold} (themes >${(similarityThreshold * 100).toFixed(0)}% similar will be merged)`,
  );
  onProgress?.("finding", 10, "Finding duplicate themes...");

  // Step 1: Find duplicate theme pairs using the database function
  const { data: duplicatePairs, error: dupError } = await supabase.rpc(
    "find_duplicate_themes",
    {
      project_id_param: projectId,
      similarity_threshold: similarityThreshold,
    },
  );

  if (dupError) {
    consola.error("[consolidate] Error finding duplicates:", dupError);
    result.errors.push(`Failed to find duplicates: ${dupError.message}`);
    return result;
  }

  const pairs = duplicatePairs as DuplicateThemePair[];
  consola.info(`[consolidate] Found ${pairs.length} duplicate pairs`);

  if (pairs.length === 0) {
    onProgress?.("complete", 100, "No duplicate themes found");
    return result;
  }

  onProgress?.(
    "clustering",
    20,
    `Found ${pairs.length} duplicate pairs, building clusters...`,
  );

  // Step 2: Build clusters from pairs using union-find
  const clusters = buildClusters(pairs);
  result.clustersFound = clusters.length;
  consola.info(`[consolidate] Built ${clusters.length} clusters from pairs`);

  // Step 3: Get evidence counts for all themes in clusters
  const allThemeIds = [...new Set(clusters.flat())];
  const { data: themeEvidence, error: countError } = await supabase
    .from("theme_evidence")
    .select("theme_id")
    .in("theme_id", allThemeIds);

  if (countError) {
    consola.error("[consolidate] Error counting evidence:", countError);
    result.errors.push(`Failed to count evidence: ${countError.message}`);
    return result;
  }

  // Count evidence per theme
  const evidenceCounts = new Map<string, number>();
  for (const row of themeEvidence || []) {
    const count = evidenceCounts.get(row.theme_id) || 0;
    evidenceCounts.set(row.theme_id, count + 1);
  }

  onProgress?.(
    "merging",
    40,
    `Processing ${clusters.length} theme clusters...`,
  );

  // Step 4: Process each cluster
  let processedClusters = 0;
  for (const cluster of clusters) {
    processedClusters++;
    const progress =
      40 + Math.round((processedClusters / clusters.length) * 50);
    onProgress?.(
      "merging",
      progress,
      `Merging cluster ${processedClusters}/${clusters.length}...`,
    );

    // Get theme info with evidence counts
    const themesInCluster: ThemeWithEvidenceCount[] = cluster.map((id) => ({
      id,
      name: "", // Will be filled if needed
      evidenceCount: evidenceCounts.get(id) || 0,
    }));

    // Sort by evidence count descending - canonical theme has most evidence
    themesInCluster.sort((a, b) => b.evidenceCount - a.evidenceCount);

    const canonicalTheme = themesInCluster[0];
    const duplicateThemes = themesInCluster.slice(1);

    if (duplicateThemes.length === 0) continue;

    // If ALL themes in cluster have 0 evidence, delete all but one
    // (canonical stays but has 0 evidence - will be cleaned up by Delete Empty)
    const totalEvidence = themesInCluster.reduce(
      (sum, t) => sum + t.evidenceCount,
      0,
    );
    if (totalEvidence === 0) {
      consola.debug(
        `[consolidate] Cluster has 0 total evidence, deleting ${duplicateThemes.length} duplicates`,
      );
    }

    consola.debug(
      `[consolidate] Cluster: canonical ${canonicalTheme.id} (${canonicalTheme.evidenceCount} evidence), merging ${duplicateThemes.length} duplicates`,
    );

    // Move evidence from duplicates to canonical
    for (const duplicate of duplicateThemes) {
      const { data: movedLinks, error: moveError } = await moveEvidenceLinks(
        supabase,
        duplicate.id,
        canonicalTheme.id,
        projectId,
      );

      if (moveError) {
        consola.error(
          `[consolidate] Error moving evidence from ${duplicate.id}:`,
          moveError,
        );
        result.errors.push(`Failed to move evidence: ${moveError}`);
        continue;
      }

      result.evidenceMoved += movedLinks || 0;

      // Delete the duplicate theme
      const { error: deleteError } = await supabase
        .from("themes")
        .delete()
        .eq("id", duplicate.id);

      if (deleteError) {
        consola.error(
          `[consolidate] Error deleting theme ${duplicate.id}:`,
          deleteError,
        );
        result.errors.push(`Failed to delete theme: ${deleteError.message}`);
        continue;
      }

      result.themesDeleted++;
    }
  }

  onProgress?.(
    "complete",
    100,
    `Consolidated ${result.themesDeleted} duplicate themes`,
  );
  consola.success(
    `[consolidate] Complete: ${result.clustersFound} clusters, ${result.themesDeleted} themes deleted, ${result.evidenceMoved} evidence links moved`,
  );

  return result;
}

/**
 * Build clusters from duplicate pairs using union-find algorithm
 */
function buildClusters(pairs: DuplicateThemePair[]): string[][] {
  const parent = new Map<string, string>();

  // Initialize each theme as its own parent
  for (const pair of pairs) {
    if (!parent.has(pair.theme_id_1))
      parent.set(pair.theme_id_1, pair.theme_id_1);
    if (!parent.has(pair.theme_id_2))
      parent.set(pair.theme_id_2, pair.theme_id_2);
  }

  // Find with path compression
  function find(x: string): string {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  // Union
  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent.set(px, py);
    }
  }

  // Process all pairs
  for (const pair of pairs) {
    union(pair.theme_id_1, pair.theme_id_2);
  }

  // Group by root
  const clusters = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)!.push(id);
  }

  // Return clusters with more than 1 theme
  return [...clusters.values()].filter((cluster) => cluster.length > 1);
}

/**
 * Move evidence links from one theme to another
 * Handles duplicates by checking existing links
 */
async function moveEvidenceLinks(
  supabase: SupabaseClient,
  fromThemeId: string,
  toThemeId: string,
  projectId: string,
): Promise<{ data: number | null; error: string | null }> {
  // Get evidence linked to the source theme
  const { data: sourceLinks, error: fetchError } = await supabase
    .from("theme_evidence")
    .select("id, evidence_id, account_id, rationale, confidence")
    .eq("theme_id", fromThemeId);

  if (fetchError) {
    return { data: null, error: fetchError.message };
  }

  if (!sourceLinks || sourceLinks.length === 0) {
    return { data: 0, error: null };
  }

  // Get existing evidence linked to target theme
  const { data: existingLinks } = await supabase
    .from("theme_evidence")
    .select("evidence_id")
    .eq("theme_id", toThemeId);

  const existingEvidenceIds = new Set(
    (existingLinks || []).map((l) => l.evidence_id),
  );

  // Filter to only new links (not already linked to target)
  const newLinks = sourceLinks.filter(
    (link) => !existingEvidenceIds.has(link.evidence_id),
  );

  if (newLinks.length > 0) {
    // Insert new links to target theme
    const { error: insertError } = await supabase.from("theme_evidence").insert(
      newLinks.map((link) => ({
        theme_id: toThemeId,
        evidence_id: link.evidence_id,
        account_id: link.account_id,
        project_id: projectId,
        rationale: link.rationale,
        confidence: link.confidence,
      })),
    );

    if (insertError) {
      return { data: null, error: insertError.message };
    }
  }

  // Delete old links from source theme
  const { error: deleteError } = await supabase
    .from("theme_evidence")
    .delete()
    .eq("theme_id", fromThemeId);

  if (deleteError) {
    return { data: null, error: deleteError.message };
  }

  return { data: newLinks.length, error: null };
}
