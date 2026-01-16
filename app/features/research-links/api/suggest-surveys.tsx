/**
 * API endpoint for getting survey recommendations based on project state.
 * Returns 1-3 suggested surveys with reasoning and pre-filled data.
 */

import type { LoaderFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";
import { getProjectResearchContext } from "../db";
import { getSurveyRecommendations } from "../utils/recommendation-rules";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { projectId } = params;

  if (!projectId) {
    return Response.json({ error: "Project ID required" }, { status: 400 });
  }

  try {
    const { client: supabase } = getServerClient(request);

    // Fetch project research context
    const context = await getProjectResearchContext({
      supabase,
      projectId,
    });

    // Get survey-specific recommendations
    const recommendations = getSurveyRecommendations(context);

    // Transform recommendations for the UI
    const suggestions = recommendations.map((rec) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      reasoning: rec.reasoning,
      actionType: rec.actionType,
      focusTheme: rec.focusTheme,
      // Pre-fill data for survey creation
      prefill: {
        name: rec.title,
        description: rec.description,
        // Pass metadata for context-aware question generation
        surveyGoal: rec.actionType,
        focusThemeId: rec.focusTheme?.id,
        focusThemeName: rec.focusTheme?.name,
      },
    }));

    return Response.json({
      success: true,
      suggestions,
      projectState: {
        hasGoals: context.hasGoals,
        interviewCount: context.interviewCount,
        surveyCount: context.surveyCount,
        themeCount: context.themes.length,
      },
    });
  } catch (error) {
    console.error("Failed to get survey suggestions:", error);
    return Response.json(
      { error: "Failed to get suggestions. Please try again." },
      { status: 500 },
    );
  }
}
