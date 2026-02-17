/**
 * Tool: fetch-segment-themes
 *
 * Given a segment (facet kind + optional value), returns top themes/concerns
 * for that cohort. Wraps getTopConcernsForSegment() from segmentThemeQueries.
 *
 * Answers questions like:
 * - "What are the top concerns for Product Managers?"
 * - "What themes do VP-level stakeholders care about vs ICs?"
 * - "What pain points are common among enterprise customers?"
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";

const themeWithFrequencySchema = z.object({
  themeId: z.string(),
  themeName: z.string(),
  statement: z.string().nullable(),
  evidenceCount: z.number(),
  personCount: z.number(),
  frequencyPercent: z
    .number()
    .describe("Percentage of segment members who mentioned this theme"),
  sampleQuotes: z.array(z.string()),
  url: z.string().nullable(),
});

export const fetchSegmentThemesTool = createTool({
  id: "fetch-segment-themes",
  description:
    "Get top themes/concerns for a specific user segment (e.g., Product Managers, VP-level, fintech industry). Answers: 'What do [segment] care about most?' Supports filtering by facet kind and label.",
  inputSchema: z.object({
    projectId: z
      .string()
      .nullish()
      .describe("Project ID. Defaults to runtime context project_id."),
    segmentKind: z
      .string()
      .describe(
        "Facet kind slug to segment by: persona, job_function, seniority_level, title, industry, life_stage, age_range, tool, workflow, preference, value",
      ),
    segmentLabel: z
      .string()
      .nullish()
      .describe(
        "Optional label to filter to a specific segment value (e.g., 'Product Manager', 'VP', 'Fintech'). If omitted, returns themes across ALL values of this kind.",
      ),
    facetKinds: z
      .array(z.string())
      .nullish()
      .describe(
        "Evidence facet kinds to analyze. Default ['pain']. Options: pain, goal, need, frustration, delight, behavior.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .nullish()
      .describe("Max themes to return. Default 20."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    projectId: z.string().nullable(),
    segmentKind: z.string(),
    segmentLabel: z.string().nullable(),
    segmentSize: z.number(),
    themes: z.array(themeWithFrequencySchema),
  }),
  execute: async (input, context?) => {
    const { supabaseAdmin } = await import("../../lib/supabase/client.server");
    const { getTopConcernsForSegment } =
      await import("../../features/themes/services/segmentThemeQueries.server");
    const { createRouteDefinitions } =
      await import("../../utils/route-definitions");
    const { HOST } = await import("../../paths");

    const supabase = supabaseAdmin as SupabaseClient<any>;
    const runtimeProjectId = context?.requestContext?.get?.("project_id");
    const runtimeAccountId = context?.requestContext?.get?.("account_id");

    const projectId = String(input.projectId ?? runtimeProjectId ?? "").trim();
    const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : "";
    const facetKinds = input.facetKinds ?? ["pain"];
    const limit = input.limit ?? 20;

    if (!projectId) {
      return {
        success: false,
        message: "Missing projectId.",
        projectId: null,
        segmentKind: input.segmentKind,
        segmentLabel: input.segmentLabel ?? null,
        segmentSize: 0,
        themes: [],
      };
    }

    try {
      // Step 1: Find the account_id for this project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("account_id")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          message: "Project not found.",
          projectId,
          segmentKind: input.segmentKind,
          segmentLabel: input.segmentLabel ?? null,
          segmentSize: 0,
          themes: [],
        };
      }

      // Step 2: Find the facet kind ID
      const { data: kindRow, error: kindError } = await supabase
        .from("facet_kind_global")
        .select("id")
        .eq("slug", input.segmentKind)
        .single();

      if (kindError || !kindRow) {
        return {
          success: false,
          message: `Unknown segment kind: "${input.segmentKind}". Valid kinds: persona, job_function, seniority_level, title, industry, life_stage, age_range, tool, workflow, preference, value.`,
          projectId,
          segmentKind: input.segmentKind,
          segmentLabel: input.segmentLabel ?? null,
          segmentSize: 0,
          themes: [],
        };
      }

      // Step 3: Find facet_account entries matching this kind (and optional label)
      let facetQuery = supabase
        .from("facet_account")
        .select("id, label")
        .eq("account_id", project.account_id)
        .eq("kind_id", kindRow.id);

      if (input.segmentLabel) {
        facetQuery = facetQuery.ilike("label", input.segmentLabel);
      }

      const { data: facets, error: facetError } = await facetQuery;

      if (facetError) {
        throw facetError;
      }

      if (!facets || facets.length === 0) {
        return {
          success: true,
          message: input.segmentLabel
            ? `No "${input.segmentLabel}" segment found for kind "${input.segmentKind}".`
            : `No segments found for kind "${input.segmentKind}".`,
          projectId,
          segmentKind: input.segmentKind,
          segmentLabel: input.segmentLabel ?? null,
          segmentSize: 0,
          themes: [],
        };
      }

      const facetIds = facets.map((f) => f.id);
      const effectiveLabel =
        input.segmentLabel ?? facets.map((f) => f.label).join(", ");

      // Step 4: Get person IDs in this segment
      const { data: personFacets, error: pfError } = await supabase
        .from("person_facet")
        .select("person_id")
        .in("facet_account_id", facetIds)
        .eq("project_id", projectId);

      if (pfError) {
        throw pfError;
      }

      const personIds = [
        ...new Set((personFacets ?? []).map((pf) => pf.person_id)),
      ];

      if (personIds.length === 0) {
        return {
          success: true,
          message: `No people found in the "${effectiveLabel}" segment.`,
          projectId,
          segmentKind: input.segmentKind,
          segmentLabel: effectiveLabel,
          segmentSize: 0,
          themes: [],
        };
      }

      // Step 5: Get top concerns for this segment
      const concerns = await getTopConcernsForSegment({
        supabase,
        projectId,
        segmentPersonIds: personIds,
        facetKinds,
        limit,
      });

      // Step 6: Add URLs
      const projectPath = accountId ? `/a/${accountId}/${projectId}` : "";
      const routes = projectPath ? createRouteDefinitions(projectPath) : null;

      const themes = concerns.map((c) => ({
        themeId: c.theme_id,
        themeName: c.theme_name,
        statement: c.statement,
        evidenceCount: c.evidence_count,
        personCount: c.person_count,
        frequencyPercent: Math.round(c.frequency * 100),
        sampleQuotes: c.sample_quotes,
        url: routes ? `${HOST}${routes.themes.detail(c.theme_id)}` : null,
      }));

      return {
        success: true,
        message: `Found ${themes.length} themes for ${personIds.length} people in "${effectiveLabel}" segment.`,
        projectId,
        segmentKind: input.segmentKind,
        segmentLabel: effectiveLabel,
        segmentSize: personIds.length,
        themes,
      };
    } catch (error) {
      consola.error("[fetch-segment-themes] unexpected error", error);
      return {
        success: false,
        message: "Unexpected error fetching segment themes.",
        projectId,
        segmentKind: input.segmentKind,
        segmentLabel: input.segmentLabel ?? null,
        segmentSize: 0,
        themes: [],
      };
    }
  },
});
