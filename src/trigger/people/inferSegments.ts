/**
 * Infer Segments Task
 *
 * Infers job_function and seniority_level from people's titles using AI.
 * Can be run on a single person or batch across a project.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  runBamlWithBilling,
  systemBillingContext,
} from "~/lib/billing/instrumented-baml.server";

const payloadSchema = z.object({
  projectId: z.string(),
  accountId: z.string(),
  // If personId is provided, only process that person. Otherwise process all in project.
  personId: z.string().optional(),
  // Force re-inference even if segments already set
  force: z.boolean().default(false),
});

type InferSegmentsPayload = z.infer<typeof payloadSchema>;

export type InferSegmentsResult = {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  details: Array<{
    personId: string;
    name: string | null;
    title: string | null;
    jobFunction: string | null;
    seniority: string | null;
    status: "updated" | "skipped" | "error";
    error?: string;
  }>;
};

// Map BAML enum values to database-friendly strings
const JOB_FUNCTION_MAP: Record<string, string> = {
  Engineering: "Engineering",
  Product: "Product",
  Design: "Design",
  Sales: "Sales",
  Marketing: "Marketing",
  CustomerSuccess: "Customer Success",
  Operations: "Operations",
  Finance: "Finance",
  HR: "HR",
  Legal: "Legal",
  Executive: "Executive",
  Data: "Data",
  IT: "IT",
  Research: "Research",
  Other: "Other",
};

const SENIORITY_MAP: Record<string, string> = {
  CLevel: "C-Level",
  VP: "VP",
  Director: "Director",
  Manager: "Manager",
  Senior: "Senior",
  IC: "IC",
  Intern: "Intern",
  Unknown: null as unknown as string,
};

export const inferSegmentsTask = schemaTask({
  id: "people.infer-segments",
  schema: payloadSchema,
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: InferSegmentsPayload): Promise<InferSegmentsResult> => {
    const { projectId, accountId, personId, force } = payload;
    const client = createSupabaseAdminClient();

    consola.info("[inferSegments] Task started", {
      projectId,
      accountId,
      personId,
      force,
    });

    // Type for person rows from our query (includes org role fallback)
    type PersonRow = {
      id: string;
      name: string | null;
      title: string | null;
      job_function: string | null;
      seniority_level: string | null;
      company: string | null;
      people_organizations?: Array<{
        role: string | null;
        is_primary: boolean | null;
      }> | null;
    };

    // Build query - use `any` to work around Supabase multi-schema type issues
    // since the admin client types don't match the public schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;
    const peopleTable = db.from("people");

    // Include people_organizations to get role from primary org link as fallback
    const selectFields =
      "id, name, title, job_function, seniority_level, company, people_organizations(role, is_primary)";

    let queryResult: { data: PersonRow[] | null; error: Error | null };

    if (personId) {
      queryResult = await peopleTable
        .select(selectFields)
        .eq("account_id", accountId)
        .eq("id", personId)
        .order("created_at", { ascending: false })
        .limit(500);
    } else if (force) {
      // When force is true, process all people (include those without title if they have org role)
      queryResult = await peopleTable
        .select(selectFields)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(500);
    } else {
      // Process people who need segment inference
      // Include those without title (we'll check for org role as fallback)
      queryResult = await peopleTable
        .select(selectFields)
        .eq("account_id", accountId)
        .or("job_function.is.null,seniority_level.is.null")
        .order("created_at", { ascending: false })
        .limit(500);
    }

    const { data: people, error: queryError } = queryResult;

    if (queryError) {
      throw new Error(`Failed to query people: ${queryError.message}`);
    }

    if (!people || people.length === 0) {
      consola.info("[inferSegments] No people to process");
      return {
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        details: [],
      };
    }

    consola.info(`[inferSegments] Processing ${people.length} people`);

    const result: InferSegmentsResult = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const person of people) {
      result.processed++;

      // Get title from person, or fallback to primary org role
      let effectiveTitle = person.title;
      let titleFromOrg = false;

      if (!effectiveTitle && person.people_organizations) {
        // Find primary org role, or use first org role if none is primary
        const primaryOrg = person.people_organizations.find(
          (o) => o.is_primary && o.role,
        );
        const anyOrgWithRole = person.people_organizations.find((o) => o.role);
        const orgRole = primaryOrg?.role || anyOrgWithRole?.role || null;

        if (orgRole) {
          effectiveTitle = orgRole;
          titleFromOrg = true;
          consola.info(
            `[inferSegments] Using org role as title for ${person.name}: ${orgRole}`,
          );
        }
      }

      // Skip if no title and no org role fallback
      if (!effectiveTitle) {
        result.skipped++;
        result.details.push({
          personId: person.id,
          name: person.name,
          title: person.title,
          jobFunction: person.job_function,
          seniority: person.seniority_level,
          status: "skipped",
          error: "No title or org role to infer from",
        });
        continue;
      }

      // Skip if already has both and not forced
      if (!force && person.job_function && person.seniority_level) {
        result.skipped++;
        result.details.push({
          personId: person.id,
          name: person.name,
          title: person.title,
          jobFunction: person.job_function,
          seniority: person.seniority_level,
          status: "skipped",
          error: "Already has segment data",
        });
        continue;
      }

      try {
        // Call BAML function with billing
        const billingCtx = systemBillingContext(
          accountId,
          "person_segment_inference",
          projectId,
        );
        const { result: inference } = await runBamlWithBilling(
          billingCtx,
          {
            functionName: "InferPersonSegments",
            traceName: "people.infer-segments",
            input: {
              title: effectiveTitle,
              hasCompany: !!person.company,
            },
            metadata: {
              personId: person.id,
              accountId,
              projectId,
            },
            resourceType: "person",
            resourceId: person.id,
            bamlCall: (client) =>
              client.InferPersonSegments({
                title: effectiveTitle,
                role: null,
                company: person.company,
              }),
          },
          `person:${person.id}:infer-segments`,
        );

        const jobFunction = JOB_FUNCTION_MAP[inference.job_function] || null;
        const seniority = SENIORITY_MAP[inference.seniority_level] || null;

        // Only update if we got valid data and confidence is reasonable
        if (inference.confidence < 0.3) {
          result.skipped++;
          result.details.push({
            personId: person.id,
            name: person.name,
            title: person.title,
            jobFunction: null,
            seniority: null,
            status: "skipped",
            error: `Low confidence: ${inference.confidence.toFixed(2)}`,
          });
          continue;
        }

        // Build update object
        const updates: Record<string, string | null> = {};
        if (jobFunction && (force || !person.job_function)) {
          updates.job_function = jobFunction;
        }
        if (seniority && (force || !person.seniority_level)) {
          updates.seniority_level = seniority;
        }
        // Copy org role to person's title field if it was used as fallback
        if (titleFromOrg && effectiveTitle && !person.title) {
          updates.title = effectiveTitle;
        }

        if (Object.keys(updates).length === 0) {
          result.skipped++;
          result.details.push({
            personId: person.id,
            name: person.name,
            title: person.title,
            jobFunction: person.job_function,
            seniority: person.seniority_level,
            status: "skipped",
            error: "No updates needed",
          });
          continue;
        }

        // Update person
        const { error: updateError } = await peopleTable
          .update(updates)
          .eq("id", person.id);

        if (updateError) {
          throw updateError;
        }

        result.updated++;
        result.details.push({
          personId: person.id,
          name: person.name,
          title: person.title,
          jobFunction: jobFunction,
          seniority: seniority,
          status: "updated",
        });

        consola.success(
          `[inferSegments] Updated ${person.name}: ${jobFunction} / ${seniority}`,
        );
      } catch (error) {
        result.errors++;
        result.details.push({
          personId: person.id,
          name: person.name,
          title: person.title,
          jobFunction: null,
          seniority: null,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        consola.error(
          `[inferSegments] Failed to process ${person.name}:`,
          error,
        );
      }
    }

    consola.success(
      `[inferSegments] Complete: ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`,
    );

    return result;
  },
});
