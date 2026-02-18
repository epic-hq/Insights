/**
 * Backfill Trigger Task: Sync existing people/org data to person_facet
 *
 * Batch processes all people in a project to populate person_facet from:
 * 1. people.job_function / people.seniority_level → person_facet (kind: job_function, seniority_level)
 * 2. organizations.industry / organizations.size_range → person_facet (kind: company_industry, company_size)
 *
 * Can be run once to backfill, or re-triggered after batch enrichment.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { syncPeopleFieldsToFacets } from "~/features/people/syncPeopleFieldsToFacets.server";
import { syncOrgDataToPersonFacets } from "~/features/people/syncOrgDataToPersonFacets.server";

const payloadSchema = z.object({
  projectId: z.string(),
  accountId: z.string(),
});

export type SyncFacetsFromExistingResult = {
  synced: number;
  skipped: number;
  errors: number;
};

export const syncFacetsFromExistingTask = schemaTask({
  id: "people.sync-facets-from-existing",
  schema: payloadSchema,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload): Promise<SyncFacetsFromExistingResult> => {
    const { projectId, accountId } = payload;
    const client = createSupabaseAdminClient();
    // Use `any` to work around Supabase multi-schema type issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;

    consola.info("[syncFacetsFromExisting] Starting backfill", {
      projectId,
      accountId,
    });

    type PersonRow = {
      id: string;
      job_function: string | null;
      seniority_level: string | null;
      default_organization_id: string | null;
      organizations?: {
        industry: string | null;
        size_range: string | null;
      } | null;
    };

    const result: SyncFacetsFromExistingResult = {
      synced: 0,
      skipped: 0,
      errors: 0,
    };

    // Fetch all people in the project with their org data
    const {
      data: people,
      error: queryError,
    }: { data: PersonRow[] | null; error: Error | null } = await db
      .from("people")
      .select(
        "id, job_function, seniority_level, default_organization_id, organizations!default_organization_id(industry, size_range)",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (queryError) {
      throw new Error(`Failed to query people: ${queryError.message}`);
    }

    if (!people || people.length === 0) {
      consola.info("[syncFacetsFromExisting] No people to process");
      return result;
    }

    consola.info(`[syncFacetsFromExisting] Processing ${people.length} people`);

    for (const person of people) {
      try {
        let didSync = false;

        // Sync job_function and seniority_level
        if (person.job_function || person.seniority_level) {
          await syncPeopleFieldsToFacets({
            supabase: client as any,
            personId: person.id,
            accountId,
            projectId,
            fields: {
              job_function: person.job_function,
              seniority_level: person.seniority_level,
            },
          });
          didSync = true;
        }

        // Sync org data if available
        const org = person.organizations;
        if (org?.industry || org?.size_range) {
          await syncOrgDataToPersonFacets({
            supabase: client as any,
            personId: person.id,
            accountId,
            projectId,
            orgData: {
              industry: org.industry,
              size_range: org.size_range,
            },
          });
          didSync = true;
        }

        if (didSync) {
          result.synced++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.errors++;
        consola.error(
          `[syncFacetsFromExisting] Error processing person ${person.id}:`,
          error,
        );
      }
    }

    consola.success(
      `[syncFacetsFromExisting] Complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`,
    );

    return result;
  },
});
