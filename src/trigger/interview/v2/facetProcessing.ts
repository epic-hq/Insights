/**
 * Facet Processing Utilities
 *
 * Functions for resolving facets from the catalog, building lookup tables,
 * and matching extracted facet mentions against known facets.
 *
 * Used during evidence extraction to link AI-extracted facet mentions
 * to the project's facet taxonomy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { FacetCatalog } from "~/../baml_client/types";
import { getFacetCatalog } from "~/lib/database/facets.server";
import type { Database } from "~/types";

/**
 * Map of kind_slug -> (normalized_label -> facet)
 */
export type FacetLookup = Map<
  string,
  Map<string, FacetCatalog["facets"][number]>
>;

/**
 * Normalize a facet value for consistent lookup.
 * Lowercases, trims, and collapses whitespace.
 */
export function normalizeFacetValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.length) return null;
  return trimmed.replace(/\s+/g, " ");
}

/**
 * Sanitize a facet label for storage.
 * Trims whitespace and truncates to 240 chars with ellipsis.
 */
export function sanitizeFacetLabel(
  label: string | null | undefined,
): string | null {
  if (typeof label !== "string") return null;
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (!trimmed.length) return null;
  return trimmed.length > 240
    ? `${trimmed.slice(0, 237).trimEnd()}...`
    : trimmed;
}

/**
 * Build a lookup table from a facet catalog for efficient matching.
 * Creates a two-level map: kind_slug -> (normalized_label/synonym -> facet)
 */
export function buildFacetLookup(catalog: FacetCatalog): FacetLookup {
  const lookup: FacetLookup = new Map();
  for (const facet of catalog.facets ?? []) {
    const rawKind =
      typeof facet.kind_slug === "string"
        ? facet.kind_slug.trim().toLowerCase()
        : "";
    if (!rawKind || !facet.facet_account_id) continue;
    const byKind =
      lookup.get(rawKind) ?? new Map<string, FacetCatalog["facets"][number]>();
    if (!lookup.has(rawKind)) {
      lookup.set(rawKind, byKind);
    }
    const candidates = new Set<string>();
    const primary = normalizeFacetValue(facet.alias ?? facet.label);
    if (primary) candidates.add(primary);
    const label = normalizeFacetValue(facet.label);
    if (label) candidates.add(label);
    for (const synonym of facet.synonyms ?? []) {
      const normalized = normalizeFacetValue(synonym);
      if (normalized) candidates.add(normalized);
    }
    for (const candidate of candidates) {
      // Do not overwrite existing entries to preserve the first (usually alias) match
      if (!byKind.has(candidate)) {
        byKind.set(candidate, facet);
      }
    }
  }
  return lookup;
}

/**
 * Match a facet mention against the lookup table.
 * Returns the matching facet or null if not found.
 */
export function matchFacetFromLookup(
  lookup: FacetLookup,
  kindSlug: string,
  label: string,
): FacetCatalog["facets"][number] | null {
  const normalized = normalizeFacetValue(label);
  if (!normalized) return null;
  const canonicalKind = kindSlug.trim().toLowerCase();
  if (!canonicalKind) return null;
  const kindMap = lookup.get(canonicalKind);
  if (!kindMap) return null;
  return kindMap.get(normalized) ?? null;
}

/**
 * Resolve the facet catalog for a project.
 * Returns an empty catalog if no project or on error.
 */
export async function resolveFacetCatalog(
  db: SupabaseClient<Database>,
  accountId: string,
  projectId?: string | null,
): Promise<FacetCatalog> {
  if (!projectId) {
    return {
      kinds: [],
      facets: [],
      version: `account:${accountId}:no-project`,
    };
  }
  try {
    return await getFacetCatalog({ db, accountId, projectId });
  } catch (error) {
    consola.warn("Failed to load facet catalog", error);
    return {
      kinds: [],
      facets: [],
      version: `account:${accountId}:project:${projectId}:fallback`,
    };
  }
}

/**
 * Processed facet row ready for evidence_facet insertion.
 */
export interface EvidenceFacetRow {
  account_id: string;
  project_id: string | null;
  evidence_index: number;
  kind_slug: string;
  facet_account_id: number;
  label: string;
  source: string;
  confidence: number;
  quote: string | null;
}

/**
 * Facet mention tracked by person_key for persona synthesis.
 */
export interface PersonFacetMention {
  kindSlug: string;
  label: string;
  facetAccountId: number;
  quote: string | null;
  evidenceIndex: number;
}
