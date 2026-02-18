/**
 * Sync organization data (industry, size_range) to person_facet rows.
 *
 * When org data is enriched (via research-organization or manual update),
 * this utility propagates industry and company size to all linked people
 * as person_facet entries with source "organization".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/database.types";

type DbClient = SupabaseClient<Database>;

/** Standard size range values and their display labels */
export const SIZE_RANGE_LABELS: Record<string, string> = {
  "1-10": "Startup (1-10)",
  "11-50": "Small Business (11-50)",
  "51-200": "SMB (51-200)",
  "201-500": "Mid-Market (201-500)",
  "501-1000": "Mid-Market (501-1000)",
  "1001-5000": "Enterprise (1001-5000)",
  "5001-10000": "Large Enterprise (5001-10000)",
  "10000+": "Large Enterprise (10000+)",
};

/** Map free-text size descriptions to standard numeric ranges */
const SIZE_RANGE_ALIASES: Record<string, string> = {
  small: "1-10",
  startup: "1-10",
  micro: "1-10",
  smb: "11-50",
  "small business": "11-50",
  "mid-market": "201-500",
  midmarket: "201-500",
  medium: "201-500",
  enterprise: "1001-5000",
  large: "1001-5000",
  "large enterprise": "5001-10000",
};

/** Standardize a size_range value to a known numeric range */
export function standardizeSizeRange(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already a standard range?
  if (SIZE_RANGE_LABELS[trimmed]) return trimmed;

  // Check aliases (case-insensitive)
  const lower = trimmed.toLowerCase();
  if (SIZE_RANGE_ALIASES[lower]) return SIZE_RANGE_ALIASES[lower];

  // Already looks like a numeric range (e.g. "51-200" or "10000+")
  if (/^\d+-\d+$/.test(trimmed) || /^\d+\+$/.test(trimmed)) return trimmed;

  // Try to parse a number from the string
  const numMatch = trimmed.match(/(\d{1,6})/);
  if (numMatch) {
    const count = Number.parseInt(numMatch[1], 10);
    if (count <= 10) return "1-10";
    if (count <= 50) return "11-50";
    if (count <= 200) return "51-200";
    if (count <= 500) return "201-500";
    if (count <= 1000) return "501-1000";
    if (count <= 5000) return "1001-5000";
    if (count <= 10000) return "5001-10000";
    return "10000+";
  }

  return null;
}

interface SyncOrgDataToPersonFacetsArgs {
  supabase: DbClient;
  personId: string;
  accountId: string;
  projectId: string;
  orgData: {
    industry?: string | null;
    size_range?: string | null;
  };
}

/**
 * Sync org-level data to person_facet entries.
 * Creates company_industry and company_size facets with source "organization".
 */
export async function syncOrgDataToPersonFacets({
  supabase,
  personId,
  accountId,
  projectId,
  orgData,
}: SyncOrgDataToPersonFacetsArgs): Promise<void> {
  // Sync industry
  if (orgData.industry) {
    try {
      await syncOrgFacet({
        supabase,
        personId,
        accountId,
        projectId,
        kindSlug: "company_industry",
        value: orgData.industry.trim(),
        slug: orgData.industry
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-/]/g, ""),
      });
    } catch (error) {
      consola.error(
        "[syncOrgDataToPersonFacets] Error syncing industry:",
        error,
      );
    }
  }

  // Sync size_range
  const standardSize = standardizeSizeRange(orgData.size_range);
  if (standardSize) {
    const displayLabel = SIZE_RANGE_LABELS[standardSize] || standardSize;
    try {
      await syncOrgFacet({
        supabase,
        personId,
        accountId,
        projectId,
        kindSlug: "company_size",
        value: displayLabel,
        slug: standardSize,
      });
    } catch (error) {
      consola.error(
        "[syncOrgDataToPersonFacets] Error syncing company_size:",
        error,
      );
    }
  }
}

interface SyncOrgFacetArgs {
  supabase: DbClient;
  personId: string;
  accountId: string;
  projectId: string;
  kindSlug: string;
  value: string;
  slug: string;
}

async function syncOrgFacet({
  supabase,
  personId,
  accountId,
  projectId,
  kindSlug,
  value,
  slug,
}: SyncOrgFacetArgs): Promise<void> {
  const { data: kind, error: kindError } = await supabase
    .from("facet_kind_global")
    .select("id")
    .eq("slug", kindSlug)
    .single();

  if (kindError || !kind) {
    consola.warn(`[syncOrgFacet] Kind '${kindSlug}' not found:`, kindError);
    return;
  }

  const kindId = kind.id;

  // Get or create facet_account
  let facetAccountId: number | null = null;

  const { data: existing } = await supabase
    .from("facet_account")
    .select("id")
    .eq("account_id", accountId)
    .eq("kind_id", kindId)
    .eq("slug", slug)
    .single();

  if (existing) {
    facetAccountId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("facet_account")
      .insert({
        account_id: accountId,
        kind_id: kindId,
        slug,
        label: value,
        is_active: true,
      })
      .select("id")
      .single();

    if (createError) {
      consola.error(
        `[syncOrgFacet] Failed to create facet_account for ${kindSlug}:`,
        createError,
      );
      return;
    }
    facetAccountId = created.id;
  }

  if (!facetAccountId) return;

  // Remove stale facets for this kind (different org value)
  const { data: allKindFacets } = await supabase
    .from("facet_account")
    .select("id")
    .eq("kind_id", kindId)
    .eq("account_id", accountId);

  if (allKindFacets && allKindFacets.length > 0) {
    const staleFacetIds = allKindFacets
      .map((f) => f.id)
      .filter((id) => id !== facetAccountId);
    if (staleFacetIds.length > 0) {
      await supabase
        .from("person_facet")
        .delete()
        .eq("person_id", personId)
        .eq("project_id", projectId)
        .in("facet_account_id", staleFacetIds);
    }
  }

  // Upsert person_facet
  const { error: linkError } = await supabase.from("person_facet").upsert(
    {
      person_id: personId,
      account_id: accountId,
      project_id: projectId,
      facet_account_id: facetAccountId,
      source: "inferred",
      confidence: 0.85,
      noted_at: new Date().toISOString(),
    },
    { onConflict: "person_id,facet_account_id" },
  );

  if (linkError) {
    consola.error(
      `[syncOrgFacet] Failed to upsert person_facet for ${kindSlug}:`,
      linkError,
    );
  }
}
