/**
 * Sync people column values (job_function, seniority_level) to person_facet rows.
 *
 * When infer-segments writes job_function/seniority_level to the people table,
 * this utility mirrors those values into person_facet so that
 * fetchStakeholderDemographics and segment queries can find them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/database.types";

type DbClient = SupabaseClient<Database>;

interface SyncPeopleFieldsToFacetsArgs {
  supabase: DbClient;
  personId: string;
  accountId: string;
  projectId: string;
  fields: {
    job_function?: string | null;
    seniority_level?: string | null;
  };
}

/**
 * For each non-null field, get-or-create a facet_account row for the matching
 * kind slug and upsert a person_facet with source "inferred".
 * Removes stale facets when the value changes.
 */
export async function syncPeopleFieldsToFacets({
  supabase,
  personId,
  accountId,
  projectId,
  fields,
}: SyncPeopleFieldsToFacetsArgs): Promise<void> {
  const fieldMap: Array<{
    kindSlug: string;
    value: string | null | undefined;
  }> = [
    { kindSlug: "job_function", value: fields.job_function },
    { kindSlug: "seniority_level", value: fields.seniority_level },
  ];

  for (const { kindSlug, value } of fieldMap) {
    try {
      await syncSingleFieldToFacet({
        supabase,
        personId,
        accountId,
        projectId,
        kindSlug,
        value: value ?? null,
        source: "inferred",
        confidence: 0.9,
      });
    } catch (error) {
      consola.error(
        `[syncPeopleFieldsToFacets] Error syncing ${kindSlug}:`,
        error,
      );
    }
  }
}

interface SyncSingleFieldArgs {
  supabase: DbClient;
  personId: string;
  accountId: string;
  projectId: string;
  kindSlug: string;
  value: string | null;
  source: string;
  confidence: number;
}

async function syncSingleFieldToFacet({
  supabase,
  personId,
  accountId,
  projectId,
  kindSlug,
  value,
  source,
  confidence,
}: SyncSingleFieldArgs): Promise<void> {
  // Get kind ID
  const { data: kind, error: kindError } = await supabase
    .from("facet_kind_global")
    .select("id")
    .eq("slug", kindSlug)
    .single();

  if (kindError || !kind) {
    consola.warn(
      `[syncSingleFieldToFacet] Kind '${kindSlug}' not found:`,
      kindError,
    );
    return;
  }

  const kindId = kind.id;

  // If value is null/empty, remove existing facets for this kind
  if (!value || value.trim() === "") {
    const { data: allKindFacets } = await supabase
      .from("facet_account")
      .select("id")
      .eq("kind_id", kindId)
      .eq("account_id", accountId);

    if (allKindFacets && allKindFacets.length > 0) {
      await supabase
        .from("person_facet")
        .delete()
        .eq("person_id", personId)
        .eq("project_id", projectId)
        .in(
          "facet_account_id",
          allKindFacets.map((f) => f.id),
        );
    }
    return;
  }

  const slug = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

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
        label: value.trim(),
        is_active: true,
      })
      .select("id")
      .single();

    if (createError) {
      consola.error(
        `[syncSingleFieldToFacet] Failed to create facet_account for ${kindSlug}:`,
        createError,
      );
      return;
    }
    facetAccountId = created.id;
  }

  if (!facetAccountId) return;

  // Remove stale facets for this kind (different value)
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
      source,
      confidence,
      noted_at: new Date().toISOString(),
    },
    { onConflict: "person_id,facet_account_id" },
  );

  if (linkError) {
    consola.error(
      `[syncSingleFieldToFacet] Failed to upsert person_facet for ${kindSlug}:`,
      linkError,
    );
  }
}
