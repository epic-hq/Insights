/**
 * Enrich People Batch Task
 *
 * Batch enriches people with missing professional data via web search.
 * Queries people missing key fields (title AND company), enriches each,
 * and optionally re-triggers ICP scoring after completion.
 *
 * Guardrails:
 * - Max 50 people per batch
 * - Never overwrites existing non-null fields
 * - Rate limited with delays between searches
 * - Stores enrichment source metadata
 */

import { metadata, task, tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { EnrichPersonResult } from "~/features/people/services/enrichPersonData.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "~/utils/processInterview.server";
import type { scoreICPMatchesTask } from "./scoreICPMatches";

const MAX_BATCH_SIZE = 50;
const DELAY_BETWEEN_SEARCHES_MS = 500;

const STAGES = {
  loading: { percent: 5, label: "Loading people..." },
  enriching: { percent: 15, label: "Enriching people data..." },
  saving: { percent: 85, label: "Saving results..." },
  rescoring: { percent: 90, label: "Re-scoring ICP matches..." },
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

export type EnrichPeopleBatchPayload = {
  projectId: string;
  accountId: string;
  personIds?: string[]; // Optional - enrich specific people
  rescore?: boolean; // Re-trigger ICP scoring after enrichment
};

export type EnrichPeopleBatchResult = {
  processed: number;
  enriched: number;
  skipped: number;
  errors: Array<{ personId: string; error: string }>;
  fieldsUpdated: Record<string, number>; // e.g. { title: 5, company: 3 }
  rescoreTriggered: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const enrichPeopleBatchTask = task({
  id: "people.enrich-batch",
  retry: workflowRetryConfig,
  run: async (
    payload: EnrichPeopleBatchPayload,
    { ctx },
  ): Promise<EnrichPeopleBatchResult> => {
    const { projectId, accountId, personIds, rescore = true } = payload;

    consola.info("[enrichPeopleBatch] Starting", {
      projectId,
      accountId,
      personIdCount: personIds?.length,
      rescore,
    });

    const supabase = createSupabaseAdminClient();

    setProgress("loading");

    // Fetch people to enrich - those missing title AND company
    let query = supabase
      .from("people")
      .select(
        "id, name, firstname, lastname, title, company, role, primary_email, linkedin_url, default_organization_id",
      )
      .eq("account_id", accountId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_BATCH_SIZE);

    if (personIds?.length) {
      query = query.in("id", personIds);
    } else {
      // Only enrich people missing key data
      query = query.or("title.is.null,company.is.null");
    }

    const { data: people, error: fetchError } = await query;

    if (fetchError) {
      consola.error("[enrichPeopleBatch] Failed to fetch people:", fetchError);
      throw new Error(`Failed to fetch people: ${fetchError.message}`);
    }

    if (!people?.length) {
      consola.info("[enrichPeopleBatch] No people need enrichment");
      return {
        processed: 0,
        enriched: 0,
        skipped: 0,
        errors: [],
        fieldsUpdated: {},
        rescoreTriggered: false,
      };
    }

    consola.info(`[enrichPeopleBatch] Found ${people.length} people to enrich`);

    // Pre-fetch org names for people with org links
    const orgIds = [
      ...new Set(
        people
          .map((p) => p.default_organization_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const orgNameMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      for (const org of orgs ?? []) {
        if (org.name) orgNameMap.set(org.id, org.name);
      }
    }

    // Dynamic import for the enrichment service
    const { enrichPersonData } =
      await import("~/features/people/services/enrichPersonData.server");

    const result: EnrichPeopleBatchResult = {
      processed: 0,
      enriched: 0,
      skipped: 0,
      errors: [],
      fieldsUpdated: {},
      rescoreTriggered: false,
    };

    setProgress("enriching");

    for (let i = 0; i < people.length; i++) {
      const person = people[i];

      // Skip people who already have all key fields
      const personOrgName = person.default_organization_id
          ? (orgNameMap.get(person.default_organization_id) ?? null)
          : null;
      if (person.title && personOrgName) {
        result.skipped++;
        result.processed++;
        continue;
      }

      try {
        // Delay between searches to avoid rate limits
        if (i > 0) {
          await delay(DELAY_BETWEEN_SEARCHES_MS);
        }

        const orgName = person.default_organization_id
          ? (orgNameMap.get(person.default_organization_id) ?? null)
          : null;

        const enrichResult: EnrichPersonResult = await enrichPersonData({
          personId: person.id,
          accountId,
          knownName:
            person.name ||
            [person.firstname, person.lastname].filter(Boolean).join(" ") ||
            null,
          knownEmail: person.primary_email,
          knownCompany: orgName,
          knownTitle: person.title,
          knownLinkedIn: person.linkedin_url,
        });

        if (enrichResult.error) {
          result.errors.push({
            personId: person.id,
            error: enrichResult.error,
          });
          result.processed++;
          continue;
        }

        if (!enrichResult.enriched) {
          result.skipped++;
          result.processed++;
          continue;
        }

        // Build update payload - only fill null fields
        const updates: Record<string, string> = {};
        if (enrichResult.data.title && !person.title) {
          updates.title = enrichResult.data.title;
        }
        if (enrichResult.data.role && !person.role) {
          updates.role = enrichResult.data.role;
        }
        if (enrichResult.data.linkedinUrl && !person.linkedin_url) {
          updates.linkedin_url = enrichResult.data.linkedinUrl;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("people")
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq("id", person.id)
            .eq("account_id", accountId);

          if (updateError) {
            result.errors.push({
              personId: person.id,
              error: `Update failed: ${updateError.message}`,
            });
          } else {
            result.enriched++;
            // Track which fields were updated
            for (const field of Object.keys(updates)) {
              result.fieldsUpdated[field] =
                (result.fieldsUpdated[field] || 0) + 1;
            }

            consola.debug(
              `[enrichPeopleBatch] Enriched ${person.name}: ${Object.keys(updates).join(", ")}`,
            );
          }
        }

        result.processed++;

        // Update progress every 5 people
        if (i % 5 === 0) {
          setProgress("enriching", i + 1, people.length);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        consola.error(
          `[enrichPeopleBatch] Error enriching ${person.name}:`,
          error,
        );
        result.errors.push({ personId: person.id, error: msg });
        result.processed++;
      }
    }

    setProgress("saving");

    // Re-trigger ICP scoring if enrichment found data
    if (rescore && result.enriched > 0) {
      setProgress("rescoring");
      try {
        const handle = await tasks.trigger<typeof scoreICPMatchesTask>(
          "people.score-icp-matches",
          {
            projectId,
            accountId,
            force: true,
          },
        );
        result.rescoreTriggered = true;
        consola.info(
          "[enrichPeopleBatch] Triggered ICP re-scoring, run:",
          handle.id,
        );
      } catch (rescoreError) {
        consola.warn(
          "[enrichPeopleBatch] Failed to trigger ICP re-scoring:",
          rescoreError,
        );
      }
    }

    setProgress("complete");

    consola.info("[enrichPeopleBatch] Complete", result);
    return result;
  },
});
