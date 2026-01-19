/**
 * Tool for recommending next actions based on project state.
 * Use proactively when user asks "what should I do next?" or seems stuck.
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import {
  getProjectResearchContext,
  type ProjectResearchContext,
} from "~/features/research-links/db";
import {
  determineProjectStage,
  generateRecommendations,
  type ProjectStage,
  type Recommendation,
} from "~/features/research-links/utils/recommendation-rules";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import type { Database } from "~/types";
import { createRouteDefinitions } from "~/utils/route-definitions";

function buildProjectPath(accountId: string, projectId: string) {
  return `/a/${accountId}/${projectId}`;
}

function resolveNavigateTo(
  projectPath: string,
  navigateTo?: string,
  focusThemeId?: string,
): string | undefined {
  if (!navigateTo) return undefined;
  const routes = createRouteDefinitions(projectPath);

  if (navigateTo === "/setup") return routes.setup();
  if (navigateTo === "/ask/new") return routes.ask.new();
  if (navigateTo === "/themes") return routes.themes.index();
  if (navigateTo === "/people") return routes.people.index();

  if (navigateTo.startsWith("/themes/")) {
    const themeId = navigateTo.split("/")[2] || focusThemeId;
    if (themeId) return routes.themes.detail(themeId);
  }

  return navigateTo.startsWith(projectPath) ? navigateTo : undefined;
}

const RecommendationSchema = z.object({
  id: z.string(),
  priority: z.number(),
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  actionType: z.enum([
    "setup",
    "interview",
    "survey",
    "validate",
    "deep_dive",
    "analyze",
    "decide",
    "data_quality",
  ]),
  navigateTo: z
    .string()
    .nullish()
    .describe("Relative path to navigate user to (e.g., /setup, /ask/new)"),
  focusTheme: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ProjectStateSchema = z.object({
  stage: z.enum(["setup", "discovery", "gathering", "validation", "synthesis"]),
  interviewCount: z.number(),
  surveyCount: z.number(),
  themeCount: z.number(),
  hasGoals: z.boolean(),
  dataQuality: z
    .object({
      peopleNeedingSegments: z.number(),
      totalPeople: z.number(),
      peopleWithoutTitles: z.number(),
    })
    .optional(),
});

export const recommendNextActionsTool = createTool({
  id: "recommend-next-actions",
  description: `Get personalized recommendations for what the user should do next in their research project.
Returns 1-3 actionable suggestions based on current project state (themes, evidence, interviews, surveys).

Use this tool proactively when:
- User asks "what should I do next?" or "what's the next step?"
- User seems unsure how to proceed
- User asks for guidance or recommendations
- Starting a conversation to orient the user

The recommendations are based on:
- Whether project goals are set
- Number of interviews and surveys completed
- Theme evidence levels (low = needs validation, high = ready for deep dive)
- Pricing themes (special handling)
- Recency of surveys (NPS check if stale)`,
  inputSchema: z.object({
    projectId: z
      .string()
      .nullish()
      .describe(
        "Project ID to get recommendations for. If not provided, uses runtime context.",
      ),
    reason: z
      .string()
      .nullish()
      .describe("Why you are fetching recommendations (for logging)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    recommendations: z.array(RecommendationSchema),
    projectState: ProjectStateSchema,
  }),
  execute: async (input, context?) => {
    const supabase = supabaseAdmin as SupabaseClient<Database>;
    // Prefer explicit input, fall back to runtime context
    const runtimeProjectId = context?.requestContext?.get?.("project_id");
    const projectId = input.projectId ?? runtimeProjectId;
    const accountId = context?.requestContext?.get?.("account_id");

    consola.debug("recommend-next-actions: execute start", {
      inputProjectId: input.projectId,
      runtimeProjectId,
      resolvedProjectId: projectId,
      accountId,
      reason: input.reason,
    });

    if (!projectId) {
      consola.warn("recommend-next-actions: missing projectId", {
        hasContext: !!context,
        hasRequestContext: !!context?.requestContext,
      });
      return {
        success: false,
        message:
          "Missing projectId. Pass projectId parameter or ensure runtime context sets project_id.",
        recommendations: [],
        projectState: {
          stage: "setup" as ProjectStage,
          interviewCount: 0,
          surveyCount: 0,
          themeCount: 0,
          hasGoals: false,
        },
      };
    }

    try {
      // Fetch comprehensive project context
      const projectContext = await getProjectResearchContext({
        supabase,
        projectId,
      });

      // Generate recommendations using rule engine
      const recommendations = generateRecommendations(projectContext);
      const projectPath =
        accountId && projectId ? buildProjectPath(accountId, projectId) : null;
      const resolvedRecommendations = projectPath
        ? recommendations.map((rec) => ({
            ...rec,
            navigateTo: resolveNavigateTo(
              projectPath,
              rec.navigateTo,
              rec.focusTheme?.id,
            ),
          }))
        : recommendations;
      const stage = determineProjectStage(projectContext);

      consola.debug("recommend-next-actions: generated recommendations", {
        projectId,
        stage,
        recommendationCount: recommendations.length,
        recommendationIds: recommendations.map((r) => r.id),
      });

      return {
        success: true,
        message: `Found ${recommendations.length} recommendations for your project.`,
        recommendations: resolvedRecommendations,
        projectState: {
          stage,
          interviewCount: projectContext.interviewCount,
          surveyCount: projectContext.surveyCount,
          themeCount: projectContext.themes.length,
          hasGoals: projectContext.hasGoals,
          dataQuality: projectContext.dataQuality,
        },
      };
    } catch (error) {
      consola.error("recommend-next-actions: unexpected error", error);
      return {
        success: false,
        message: "Unexpected error generating recommendations.",
        recommendations: [],
        projectState: {
          stage: "setup" as ProjectStage,
          interviewCount: 0,
          surveyCount: 0,
          themeCount: 0,
          hasGoals: false,
        },
      };
    }
  },
});
