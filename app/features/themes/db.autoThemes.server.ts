import consola from "consola";
import {
  generateEmbeddingOrThrow,
  generateEmbedding,
  SIMILARITY_THRESHOLDS,
} from "~/lib/embeddings/openai.server";
import { runBamlWithTracing } from "~/lib/baml/runBamlWithTracing.server";
import type {
  SupabaseClient,
  Theme,
  Theme_EvidenceInsert,
  ThemeInsert,
} from "~/types";

/**
 * Find evidence semantically similar to a theme using vector search
 */
async function findSimilarEvidenceForTheme(
  supabase: SupabaseClient,
  projectId: string,
  themeText: string,
  matchThreshold = SIMILARITY_THRESHOLDS.EVIDENCE_TO_THEME,
  matchCount = 50,
): Promise<Array<{ id: string; verbatim: string; similarity: number }>> {
  const embedding = await generateEmbeddingOrThrow(themeText, {
    label: "theme-evidence-search",
  });

  const { data, error } = await supabase.rpc("find_similar_evidence", {
    query_embedding: embedding as any,
    project_id_param: projectId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    consola.error("[findSimilarEvidenceForTheme] Error:", error);
    return [];
  }

  return (data ?? []) as Array<{
    id: string;
    verbatim: string;
    similarity: number;
  }>;
}

// Input shape for evidence rows we pass to BAML. Mirrors columns in `public.evidence`.
interface EvidenceForTheme {
  id: string;
  verbatim: string;
  kind_tags: string[] | null;
  personas: string[] | null;
  segments: string[] | null;
  journey_stage: string | null;
  support: string | null;
}

type AutoGroupThemesOptions = {
  supabase: SupabaseClient;
  account_id: string;
  project_id?: string | null;
  evidence_ids?: string[]; // if omitted, we will select recent evidence by project/account
  guidance?: string; // optional naming conventions or business priorities
  limit?: number; // max evidence rows to consider
};

type AutoGroupThemesResult = {
  created_theme_ids: string[];
  link_count: number;
  themes: Theme[];
};

// Select evidence rows to analyze
async function loadEvidence(
  supabase: SupabaseClient,
  _account_id: string,
  project_id: string | null,
  evidence_ids?: string[],
  limit = 200,
): Promise<EvidenceForTheme[]> {
  if (!project_id) {
    consola.warn("[loadEvidence] No project_id provided, returning empty");
    return [];
  }

  let query = supabase
    .from("evidence")
    .select(
      "id, verbatim, personas, segments, journey_stage, support, is_question",
    )
    .eq("project_id", project_id)
    .or("is_question.is.null,is_question.eq.false"); // Filter out interviewer questions

  if (evidence_ids && evidence_ids.length > 0)
    query = query.in("id", evidence_ids);
  else query = query.order("created_at", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  const evidenceRows = (data || []) as unknown as EvidenceForTheme[];

  if (!evidenceRows.length) {
    return evidenceRows;
  }

  const evidenceIds = evidenceRows.map((row) => row.id);

  // Chunk the IDs to avoid overly large IN clauses that can cause fetch failures
  const CHUNK_SIZE = 100;
  const allFacetRows: any[] = [];

  for (let i = 0; i < evidenceIds.length; i += CHUNK_SIZE) {
    const chunk = evidenceIds.slice(i, i + CHUNK_SIZE);
    const { data: facetRows, error: facetError } = await supabase
      .from("evidence_facet")
      .select("evidence_id, kind_slug, label")
      .in("evidence_id", chunk);
    if (facetError) throw facetError;
    if (facetRows) allFacetRows.push(...facetRows);
  }
  const facetRows = allFacetRows;

  const kindTagsByEvidence = new Map<string, string[]>();
  for (const facet of facetRows ?? []) {
    if (!facet || typeof facet !== "object") continue;
    const evidence_id = (facet as any).evidence_id as string | undefined;
    const kind_slug = (facet as any).kind_slug as string | undefined;
    const label = (facet as any).label as string | undefined;
    if (!evidence_id) continue;
    const list = kindTagsByEvidence.get(evidence_id) ?? [];
    const derivedTag =
      kind_slug && label ? `${kind_slug}:${label}` : kind_slug || label;
    if (derivedTag) list.push(derivedTag);
    kindTagsByEvidence.set(evidence_id, list);
  }

  return evidenceRows.map((row) => ({
    ...row,
    kind_tags: kindTagsByEvidence.get(row.id) ?? [],
  }));
}

/**
 * Find semantically similar themes using embedding-based vector search
 */
async function findSemanticallySimilarTheme(
  supabase: SupabaseClient,
  projectId: string,
  themeText: string,
  matchThreshold = SIMILARITY_THRESHOLDS.THEME_DEDUPLICATION,
): Promise<{ id: string; name: string; similarity: number } | null> {
  try {
    const embedding = await generateEmbedding(themeText, {
      label: "theme-dedup",
    });
    if (!embedding) return null;

    const { data, error } = await supabase.rpc("find_similar_themes", {
      query_embedding: embedding as any,
      project_id_param: projectId,
      match_threshold: matchThreshold,
      match_count: 1,
    });

    if (error) {
      consola.warn("[findSemanticallySimilarTheme] RPC error:", error);
      return null;
    }

    if (data && data.length > 0) {
      return {
        id: data[0].id,
        name: data[0].name,
        similarity: data[0].similarity,
      };
    }
    return null;
  } catch (err) {
    consola.warn("[findSemanticallySimilarTheme] Failed:", err);
    return null;
  }
}

// Upsert or fetch a theme by name within account/project scope
// Uses semantic matching to prevent near-duplicate themes
async function upsertTheme(
  supabase: SupabaseClient,
  payload: Omit<ThemeInsert, "id"> & { id?: string },
): Promise<Theme> {
  // 1. Try exact name match first (fastest)
  const { data: existing, error: findErr } = await supabase
    .from("themes")
    .select("*")
    .eq("account_id", payload.account_id)
    .eq("project_id", payload.project_id ?? null)
    .eq("name", payload.name)
    .maybeSingle();
  if (findErr && findErr.code !== "PGRST116") throw findErr;

  if (existing) {
    // Update statement/criteria if provided
    const { data, error } = await supabase
      .from("themes")
      .update({
        statement: payload.statement ?? existing.statement,
        inclusion_criteria:
          payload.inclusion_criteria ?? existing.inclusion_criteria,
        exclusion_criteria:
          payload.exclusion_criteria ?? existing.exclusion_criteria,
        synonyms: payload.synonyms ?? existing.synonyms,
        anti_examples: payload.anti_examples ?? existing.anti_examples,
        project_id: payload.project_id ?? existing.project_id,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Theme;
  }

  // 2. If no exact match, check for semantically similar themes
  // This prevents duplicates like "AI Lacks Contextual Understanding" vs "AI fails to capture context"
  if (payload.project_id) {
    const searchText = [payload.name, payload.statement]
      .filter(Boolean)
      .join(". ");
    const similarTheme = await findSemanticallySimilarTheme(
      supabase,
      payload.project_id,
      searchText,
      // Uses SIMILARITY_THRESHOLDS.THEME_DEDUPLICATION (0.8) by default
    );

    if (similarTheme) {
      consola.info(
        `[upsertTheme] Found semantically similar theme: "${similarTheme.name}" (${Math.round(similarTheme.similarity * 100)}% similar to "${payload.name}")`,
      );

      // Return the existing similar theme (optionally enrich it)
      const { data: existingSimilar, error: fetchErr } = await supabase
        .from("themes")
        .select("*")
        .eq("id", similarTheme.id)
        .single();

      if (fetchErr) throw fetchErr;

      // Optionally update with new criteria if not already set
      const { data, error } = await supabase
        .from("themes")
        .update({
          statement: existingSimilar.statement ?? payload.statement,
          inclusion_criteria:
            existingSimilar.inclusion_criteria ?? payload.inclusion_criteria,
          exclusion_criteria:
            existingSimilar.exclusion_criteria ?? payload.exclusion_criteria,
          // Add new name as synonym if different
          synonyms: existingSimilar.synonyms?.includes(payload.name)
            ? existingSimilar.synonyms
            : [...(existingSimilar.synonyms ?? []), payload.name],
        })
        .eq("id", similarTheme.id)
        .select("*")
        .single();

      if (error) throw error;
      return data as Theme;
    }
  }

  // 3. Create new theme with embedding for future semantic matching
  const searchText = [payload.name, payload.statement]
    .filter(Boolean)
    .join(". ");
  const embedding = await generateEmbedding(searchText, {
    label: `theme:${payload.name}`,
  });

  const insertBody: ThemeInsert & {
    embedding?: any;
    embedding_model?: string;
    embedding_generated_at?: string;
  } = {
    account_id: payload.account_id,
    project_id: payload.project_id ?? null,
    name: payload.name,
    statement: payload.statement ?? null,
    inclusion_criteria: payload.inclusion_criteria ?? null,
    exclusion_criteria: payload.exclusion_criteria ?? null,
    synonyms: payload.synonyms ?? [],
    anti_examples: payload.anti_examples ?? [],
  };

  // Add embedding if generated successfully
  if (embedding) {
    insertBody.embedding = embedding;
    insertBody.embedding_model = "text-embedding-3-small";
    insertBody.embedding_generated_at = new Date().toISOString();
  }

  const { data: created, error } = await supabase
    .from("themes")
    .insert(insertBody)
    .select("*")
    .single();
  if (error) throw error;
  return created as Theme;
}

// Link evidence to a theme with rationale and confidence
async function upsertThemeEvidence(
  supabase: SupabaseClient,
  payload: Omit<Theme_EvidenceInsert, "id"> & { id?: string },
) {
  // unique(theme_id, evidence_id, account_id)
  const { data: existing, error: findErr } = await supabase
    .from("theme_evidence")
    .select("id")
    .eq("theme_id", payload.theme_id)
    .eq("evidence_id", payload.evidence_id)
    .eq("account_id", payload.account_id)
    .maybeSingle();
  if (findErr && findErr.code !== "PGRST116") throw findErr;

  if (existing) {
    const { error } = await supabase
      .from("theme_evidence")
      .update({
        rationale: payload.rationale,
        confidence: payload.confidence ?? null,
        project_id: payload.project_id ?? null,
      })
      .eq("id", existing.id)
      .eq("account_id", payload.account_id);
    if (error) throw error;
    return existing.id;
  }

  const insertBody: Theme_EvidenceInsert = {
    account_id: payload.account_id,
    project_id: payload.project_id ?? null,
    theme_id: payload.theme_id,
    evidence_id: payload.evidence_id,
    rationale: payload.rationale ?? null,
    confidence: payload.confidence ?? null,
  };
  const { data, error } = await supabase
    .from("theme_evidence")
    .insert(insertBody)
    .select("id")
    .single();
  if (error) throw error;
  return data?.id as string;
}

/**
 * Auto-generate themes from evidence and persist to DB with links.
 * Uses BAML `AutoGroupThemes` to propose themes and evidence link directives.
 */
export async function autoGroupThemesAndApply(
  opts: AutoGroupThemesOptions,
): Promise<AutoGroupThemesResult> {
  const {
    supabase,
    account_id,
    project_id = null,
    evidence_ids,
    guidance = "",
    limit = 200,
  } = opts;

  consola.log("[autoGroupThemesAndApply] Starting with options:", {
    account_id,
    project_id,
    limit,
  });

  // Check how many evidence items have embeddings
  if (project_id) {
    const { count: totalCount } = await supabase
      .from("evidence")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id);
    const { count: embeddingCount } = await supabase
      .from("evidence")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id)
      .not("embedding", "is", null);
    consola.log(
      `[autoGroupThemesAndApply] Evidence embedding status: ${embeddingCount}/${totalCount} have embeddings`,
    );
  }

  // 1) Load evidence
  const evidence = await loadEvidence(
    supabase,
    account_id,
    project_id,
    evidence_ids,
    limit,
  );
  consola.log(
    "[autoGroupThemesAndApply] Loaded evidence count:",
    evidence.length,
  );
  consola.log("[autoGroupThemesAndApply] First evidence sample:", evidence[0]);

  if (evidence.length === 0) {
    consola.error(
      "[autoGroupThemesAndApply] No evidence found for project:",
      project_id,
    );
    throw new Error(
      `No evidence found for project ${project_id}. Cannot generate themes without evidence data.`,
    );
  }

  // 2) Call BAML
  let resp;
  try {
    const evidence_json = JSON.stringify(evidence);
    consola.log(
      "[autoGroupThemesAndApply] Calling BAML with evidence length:",
      evidence_json.length,
    );
    consola.log(
      "[autoGroupThemesAndApply] Sample evidence (first 2):",
      evidence
        .slice(0, 2)
        .map((e) => ({ id: e.id, verbatim: e.verbatim?.slice(0, 50) })),
    );
    const { result } = await runBamlWithTracing({
      functionName: "AutoGroupThemes",
      traceName: "baml.auto-group-themes",
      input: {
        account_id,
        project_id,
        evidenceCount: evidence.length,
        guidanceLength: guidance.length,
      },
      metadata: { caller: "autoGroupThemesAndApply" },
      logUsageLabel: "AutoGroupThemes",
      bamlCall: (client) => client.AutoGroupThemes(evidence_json, guidance),
    });
    resp = result;
    consola.log(
      "[autoGroupThemesAndApply] BAML response received, themes count:",
      resp.themes?.length || 0,
    );
  } catch (bamlError) {
    consola.error("[autoGroupThemesAndApply] BAML call failed:", bamlError);
    throw new Error(
      `BAML AutoGroupThemes failed: ${bamlError instanceof Error ? bamlError.message : String(bamlError)}`,
    );
  }

  // 3) Persist themes and links
  const created_theme_ids: string[] = [];
  const themes: Theme[] = [];
  let link_count = 0;

  const themesFromBaml = Array.isArray(resp?.themes) ? resp.themes : [];
  if (!themesFromBaml.length) {
    consola.warn("[autoGroupThemesAndApply] BAML returned no themes");
    return { created_theme_ids, link_count, themes };
  }

  consola.log(
    `[autoGroupThemesAndApply] BAML returned ${themesFromBaml.length} themes`,
  );
  for (const t of themesFromBaml) {
    consola.log(`  - "${t.name}"`);
  }

  // 4) Create themes and link evidence via semantic similarity
  for (const t of themesFromBaml) {
    let theme: Theme;
    try {
      theme = await upsertTheme(supabase, {
        account_id,
        project_id,
        name: t.name,
        statement: t.statement ?? null,
        inclusion_criteria: t.inclusion_criteria ?? null,
        exclusion_criteria: t.exclusion_criteria ?? null,
        synonyms: t.synonyms ?? [],
        anti_examples: [],
      });
    } catch (themeErr) {
      consola.warn("[autoGroupThemesAndApply] Failed to upsert theme", {
        name: t?.name,
        error: themeErr instanceof Error ? themeErr.message : themeErr,
      });
      continue;
    }
    themes.push(theme);
    created_theme_ids.push(theme.id);

    // Use semantic search to find evidence matching this theme
    if (project_id) {
      // Build search query from theme's statement and inclusion criteria
      const searchQuery = [t.statement, t.inclusion_criteria, t.name]
        .filter(Boolean)
        .join(". ");
      consola.log(
        `[autoGroupThemesAndApply] Searching evidence for theme "${t.name}"...`,
      );

      try {
        const similarEvidence = await findSimilarEvidenceForTheme(
          supabase,
          project_id,
          searchQuery,
          0.4, // threshold - balance between coverage and relevance
          50, // max matches per theme
        );

        consola.log(
          `[autoGroupThemesAndApply] Found ${similarEvidence.length} similar evidence for "${t.name}"`,
        );

        // Create theme_evidence links for each match
        for (const match of similarEvidence) {
          try {
            await upsertThemeEvidence(supabase, {
              account_id,
              project_id,
              theme_id: theme.id,
              evidence_id: match.id,
              rationale: `Semantic match (${Math.round(match.similarity * 100)}%)`,
              confidence: match.similarity,
            });
            link_count += 1;
          } catch (linkErr) {
            // Silently skip - likely duplicate or FK error
          }
        }
      } catch (searchErr) {
        consola.warn(
          `[autoGroupThemesAndApply] Semantic search failed for theme "${t.name}":`,
          searchErr,
        );
      }
    }
  }

  consola.success(
    `AutoGroupThemes applied: ${themes.length} themes, ${link_count} links`,
  );
  return { created_theme_ids, link_count, themes };
}
