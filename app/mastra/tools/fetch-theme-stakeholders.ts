/**
 * Tool: fetch-theme-stakeholders
 *
 * Given one or more theme IDs, returns the people associated with those themes
 * enriched with their facet profiles (job_function, seniority, industry, etc.).
 * Wraps getUsersWithThemes() from segmentThemeQueries and enriches with person_facet data.
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";

const stakeholderSchema = z.object({
  personId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  themeNames: z.array(z.string()),
  mentionCount: z.number(),
  facets: z.array(
    z.object({
      kind: z.string(),
      label: z.string(),
    }),
  ),
  url: z.string().nullable(),
});

export const fetchThemeStakeholdersTool = createTool({
  id: "fetch-theme-stakeholders",
  description:
    "Given theme IDs, return the people who mentioned those themes with their demographic facets (job function, seniority, industry, company size, etc.). Use this to understand WHO is behind a theme and what they have in common.",
  inputSchema: z.object({
    projectId: z
      .string()
      .nullish()
      .describe("Project ID. Defaults to runtime context project_id."),
    themeIds: z
      .array(z.string())
      .min(1)
      .describe("One or more theme IDs to look up stakeholders for."),
    requireAll: z
      .boolean()
      .nullish()
      .describe(
        "If true, only return people linked to ALL specified themes. Default false (any theme).",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullish()
      .describe("Max people to return. Default 50."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    projectId: z.string().nullable(),
    totalPeople: z.number(),
    stakeholders: z.array(stakeholderSchema),
  }),
  execute: async (input, context?) => {
    const { supabaseAdmin } = await import("../../lib/supabase/client.server");
    const { getUsersWithThemes } =
      await import("../../features/themes/services/segmentThemeQueries.server");
    const { createRouteDefinitions } =
      await import("../../utils/route-definitions");
    const { HOST } = await import("../../paths");

    const supabase = supabaseAdmin as SupabaseClient<any>;
    const runtimeProjectId = context?.requestContext?.get?.("project_id");
    const runtimeAccountId = context?.requestContext?.get?.("account_id");

    const projectId = String(input.projectId ?? runtimeProjectId ?? "").trim();
    const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : "";
    const limit = input.limit ?? 50;
    const requireAll = input.requireAll ?? false;

    if (!projectId) {
      return {
        success: false,
        message:
          "Missing projectId. Provide projectId or ensure runtime project context is set.",
        projectId: null,
        totalPeople: 0,
        stakeholders: [],
      };
    }

    try {
      // Step 1: Get people linked to these themes
      const people = await getUsersWithThemes({
        supabase,
        projectId,
        themeIds: input.themeIds,
        requireAll,
        limit,
      });

      if (people.length === 0) {
        return {
          success: true,
          message: "No people found linked to the specified themes.",
          projectId,
          totalPeople: 0,
          stakeholders: [],
        };
      }

      // Step 2: Enrich with facet data
      const personIds = people.map((p) => p.person_id);

      const { data: facetRows, error: facetError } = await supabase
        .from("person_facet")
        .select(
          `
					person_id,
					facet_account!inner (
						label,
						kind:facet_kind_global!inner (
							slug,
							label
						)
					)
				`,
        )
        .eq("project_id", projectId)
        .in("person_id", personIds);

      if (facetError) {
        consola.error(
          "[fetch-theme-stakeholders] Error fetching facets:",
          facetError,
        );
        // Continue without facets rather than failing
      }

      // Build person -> facets map
      const personFacets = new Map<
        string,
        Array<{ kind: string; label: string }>
      >();
      for (const row of facetRows ?? []) {
        const facetAccount = row.facet_account as any;
        if (!facetAccount?.kind?.slug) continue;

        const existing = personFacets.get(row.person_id) ?? [];
        existing.push({
          kind: facetAccount.kind.slug,
          label: facetAccount.label,
        });
        personFacets.set(row.person_id, existing);
      }

      // Step 3: Build output with URLs
      const projectPath = accountId ? `/a/${accountId}/${projectId}` : "";
      const routes = projectPath ? createRouteDefinitions(projectPath) : null;

      const stakeholders = people.map((person) => ({
        personId: person.person_id,
        name: person.person_name,
        email: person.email,
        themeNames: person.theme_names,
        mentionCount: person.facet_count,
        facets: personFacets.get(person.person_id) ?? [],
        url: routes ? `${HOST}${routes.people.detail(person.person_id)}` : null,
      }));

      return {
        success: true,
        message: `Found ${stakeholders.length} people linked to ${input.themeIds.length} theme(s).`,
        projectId,
        totalPeople: stakeholders.length,
        stakeholders,
      };
    } catch (error) {
      consola.error("[fetch-theme-stakeholders] unexpected error", error);
      return {
        success: false,
        message: "Unexpected error fetching theme stakeholders.",
        projectId,
        totalPeople: 0,
        stakeholders: [],
      };
    }
  },
});
