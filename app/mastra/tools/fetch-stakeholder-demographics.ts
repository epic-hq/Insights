/**
 * Tool: fetch-stakeholder-demographics
 *
 * Aggregates facet distributions across the project or a filtered subset of people.
 * Answers questions like:
 * - "What's the seniority distribution of my participants?"
 * - "What industries are represented among people who mentioned Theme X?"
 * - "How many people are from enterprise vs SMB?"
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import {
  SEGMENT_KIND_SLUGS,
  SEGMENT_KIND_LABELS,
} from "../../features/segments/services/segmentData.server";

const distributionItemSchema = z.object({
  label: z.string(),
  count: z.number(),
  percent: z.number().describe("Percentage of the analyzed population"),
});

const kindDistributionSchema = z.object({
  kind: z.string(),
  kindLabel: z.string(),
  totalTagged: z
    .number()
    .describe("Number of people with at least one value for this kind"),
  values: z.array(distributionItemSchema),
});

export const fetchStakeholderDemographicsTool = createTool({
  id: "fetch-stakeholder-demographics",
  description:
    "Aggregate demographic distributions (job function, seniority, industry, etc.) across all project stakeholders or a filtered subset. Use to understand the composition of your research participants.",
  inputSchema: z.object({
    projectId: z
      .string()
      .nullish()
      .describe("Project ID. Defaults to runtime context project_id."),
    kinds: z
      .array(z.string())
      .nullish()
      .describe(
        "Facet kinds to include. Default: all segment kinds. Requesting 'industry' or 'company_industry' automatically includes org-derived industry from the organizations table. Requesting 'company_size' includes org-derived company size ranges. Available slugs: persona, job_function, seniority_level, title, industry, company_size, company_industry, life_stage, age_range, tool, workflow, preference, value.",
      ),
    personIds: z
      .array(z.string())
      .nullish()
      .describe(
        "Optional: restrict analysis to specific people (e.g., people from a theme lookup). If omitted, analyzes all project people.",
      ),
    themeId: z
      .string()
      .nullish()
      .describe(
        "Optional: restrict analysis to people linked to a specific theme. If provided, personIds is ignored.",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    projectId: z.string().nullable(),
    totalPeople: z.number().describe("Total people in the analyzed population"),
    distributions: z.array(kindDistributionSchema),
  }),
  execute: async (input, context?) => {
    const { supabaseAdmin } = await import("../../lib/supabase/client.server");

    const supabase = supabaseAdmin as SupabaseClient<any>;
    const runtimeProjectId = context?.requestContext?.get?.("project_id");

    const projectId = String(input.projectId ?? runtimeProjectId ?? "").trim();
    const requestedKinds = input.kinds ?? SEGMENT_KIND_SLUGS;

    if (!projectId) {
      return {
        success: false,
        message: "Missing projectId.",
        projectId: null,
        totalPeople: 0,
        distributions: [],
      };
    }

    try {
      // Step 1: Determine the population (all project people or filtered subset)
      let personIds: string[];

      if (input.themeId) {
        // Get people linked to this theme via theme_evidence → evidence_facet / evidence_people
        const { getUsersWithThemes } =
          await import("../../features/themes/services/segmentThemeQueries.server");
        const people = await getUsersWithThemes({
          supabase,
          projectId,
          themeIds: [input.themeId],
          limit: 500,
        });
        personIds = people.map((p) => p.person_id);
      } else if (input.personIds && input.personIds.length > 0) {
        personIds = input.personIds;
      } else {
        // All project people
        const { data: projectPeople, error: ppError } = await supabase
          .from("project_people")
          .select("person_id")
          .eq("project_id", projectId);

        if (ppError) throw ppError;
        personIds = (projectPeople ?? []).map((pp) => pp.person_id);
      }

      if (personIds.length === 0) {
        return {
          success: true,
          message: "No people found for the specified criteria.",
          projectId,
          totalPeople: 0,
          distributions: [],
        };
      }

      // Step 2: Get project's account_id for facet lookup
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
          totalPeople: 0,
          distributions: [],
        };
      }

      // Step 3: Get relevant facet kind IDs
      const { data: kindRows, error: kindError } = await supabase
        .from("facet_kind_global")
        .select("id, slug, label")
        .in("slug", requestedKinds);

      if (kindError) throw kindError;

      const kindMap = new Map<number, { slug: string; label: string }>();
      for (const k of kindRows ?? []) {
        kindMap.set(k.id, { slug: k.slug, label: k.label });
      }

      if (kindMap.size === 0) {
        return {
          success: true,
          message: "No matching facet kinds found.",
          projectId,
          totalPeople: personIds.length,
          distributions: [],
        };
      }

      // Step 4: Get facet_account entries for this account
      const { data: facetAccounts, error: faError } = await supabase
        .from("facet_account")
        .select("id, kind_id, label")
        .eq("account_id", project.account_id)
        .in("kind_id", Array.from(kindMap.keys()));

      if (faError) throw faError;

      const facetAccountMap = new Map<
        number,
        { kindSlug: string; label: string }
      >();
      for (const fa of facetAccounts ?? []) {
        const kind = kindMap.get(fa.kind_id);
        if (kind) {
          facetAccountMap.set(fa.id, { kindSlug: kind.slug, label: fa.label });
        }
      }

      // Step 5: Get person_facet records for our population (skip if no facet_accounts)
      // Step 6: Aggregate into distributions
      // kind_slug -> label -> Set<person_id>
      const agg = new Map<string, Map<string, Set<string>>>();
      const kindTaggedPeople = new Map<string, Set<string>>();

      if (facetAccountMap.size > 0) {
        const { data: personFacets, error: pfError } = await supabase
          .from("person_facet")
          .select("person_id, facet_account_id")
          .eq("project_id", projectId)
          .in("person_id", personIds)
          .in("facet_account_id", Array.from(facetAccountMap.keys()));

        if (pfError) throw pfError;

        for (const pf of personFacets ?? []) {
          const fa = facetAccountMap.get(pf.facet_account_id);
          if (!fa) continue;

          if (!agg.has(fa.kindSlug)) {
            agg.set(fa.kindSlug, new Map());
            kindTaggedPeople.set(fa.kindSlug, new Set());
          }

          const kindAgg = agg.get(fa.kindSlug)!;
          if (!kindAgg.has(fa.label)) {
            kindAgg.set(fa.label, new Set());
          }
          kindAgg.get(fa.label)!.add(pf.person_id);
          kindTaggedPeople.get(fa.kindSlug)!.add(pf.person_id);
        }
      }

      // Step 7: Add org-derived distributions (industry, company_size) from organizations table
      const wantsOrgIndustry =
        requestedKinds.includes("industry") ||
        requestedKinds.includes("company_industry");
      const wantsOrgSize = requestedKinds.includes("company_size");

      if (wantsOrgIndustry || wantsOrgSize) {
        const { data: peopleWithOrgs } = await supabase
          .from("people")
          .select(
            "id, default_organization_id, organizations!default_organization_id(industry, size_range)",
          )
          .in("id", personIds)
          .not("default_organization_id", "is", null);

        if (peopleWithOrgs && peopleWithOrgs.length > 0) {
          for (const person of peopleWithOrgs) {
            const org = (person as any).organizations;
            if (!org) continue;

            if (wantsOrgIndustry && org.industry) {
              const slug = "company_industry";
              if (!agg.has(slug)) {
                agg.set(slug, new Map());
                kindTaggedPeople.set(slug, new Set());
              }
              const kindAgg = agg.get(slug)!;
              if (!kindAgg.has(org.industry))
                kindAgg.set(org.industry, new Set());
              kindAgg.get(org.industry)!.add(person.id);
              kindTaggedPeople.get(slug)!.add(person.id);
            }

            if (wantsOrgSize && org.size_range) {
              const slug = "company_size";
              if (!agg.has(slug)) {
                agg.set(slug, new Map());
                kindTaggedPeople.set(slug, new Set());
              }
              const kindAgg = agg.get(slug)!;
              if (!kindAgg.has(org.size_range))
                kindAgg.set(org.size_range, new Set());
              kindAgg.get(org.size_range)!.add(person.id);
              kindTaggedPeople.get(slug)!.add(person.id);
            }
          }
        }
      }

      // Step 8: Build output sorted by requested kind order
      // Include org-derived kinds in output even if not in requestedKinds
      const outputKinds = [...requestedKinds];
      if (wantsOrgIndustry && !outputKinds.includes("company_industry")) {
        outputKinds.push("company_industry");
      }
      if (wantsOrgSize && !outputKinds.includes("company_size")) {
        outputKinds.push("company_size");
      }

      const totalPeople = personIds.length;
      const distributions = outputKinds
        .filter((slug) => agg.has(slug))
        .map((slug) => {
          const kindAgg = agg.get(slug)!;
          const tagged = kindTaggedPeople.get(slug)!;

          const values = Array.from(kindAgg.entries())
            .map(([label, people]) => ({
              label,
              count: people.size,
              percent: Math.round((people.size / totalPeople) * 100),
            }))
            .sort((a, b) => b.count - a.count);

          return {
            kind: slug,
            kindLabel: SEGMENT_KIND_LABELS[slug] || slug,
            totalTagged: tagged.size,
            values,
          };
        });

      const kindsWithData = distributions.filter((d) => d.values.length > 0);

      return {
        success: true,
        message: `Demographics for ${totalPeople} people across ${kindsWithData.length} facet kinds.`,
        projectId,
        totalPeople,
        distributions,
      };
    } catch (error) {
      consola.error("[fetch-stakeholder-demographics] unexpected error", error);
      return {
        success: false,
        message: "Unexpected error fetching stakeholder demographics.",
        projectId,
        totalPeople: 0,
        distributions: [],
      };
    }
  },
});
