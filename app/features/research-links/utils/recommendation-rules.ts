/**
 * Recommendation rules engine for generating next-action suggestions.
 * Pure functions that analyze project state and return prioritized recommendations.
 * No LLM calls - deterministic rules based on project data.
 */

import type { ProjectResearchContext } from "../db";

/**
 * A recommendation for the user's next action.
 */
export interface Recommendation {
  /** Unique identifier for the recommendation */
  id: string;
  /** Priority (1 = highest) */
  priority: number;
  /** Short title for the recommendation */
  title: string;
  /** Longer description of what this recommendation involves */
  description: string;
  /** Why this recommendation is being made */
  reasoning: string;
  /** The type of action */
  actionType:
    | "setup"
    | "interview"
    | "survey"
    | "validate"
    | "deep_dive"
    | "analyze"
    | "decide"
    | "data_quality";
  /** Optional: relative path to navigate to (e.g., "/setup", "/ask/new") */
  navigateTo?: string;
  /** Optional: theme this recommendation focuses on */
  focusTheme?: {
    id: string;
    name: string;
  };
  /** Optional: metadata for the action */
  metadata?: Record<string, unknown>;
}

/**
 * Project stage based on research progress.
 */
export type ProjectStage =
  | "setup"
  | "discovery"
  | "gathering"
  | "validation"
  | "synthesis";

/**
 * Determine the current stage of the project.
 * Stage reflects actual research progress, not just setup completeness.
 */
export function determineProjectStage(
  context: ProjectResearchContext,
): ProjectStage {
  const hasResearchData = context.interviewCount > 0 || context.surveyCount > 0;

  // Only "setup" if no goals AND no research data at all
  if (!context.hasGoals && !hasResearchData) {
    return "setup";
  }

  if (!hasResearchData) {
    return "discovery";
  }

  if (context.themes.length === 0) {
    return "gathering";
  }

  // Check if themes need validation (low evidence)
  const lowEvidenceThemes = context.themes.filter((t) => t.evidence_count < 3);
  if (lowEvidenceThemes.length > context.themes.length / 2) {
    return "validation";
  }

  return "synthesis";
}

/**
 * Generate recommendations based on project state.
 * Returns up to 3 prioritized recommendations.
 */
export function generateRecommendations(
  context: ProjectResearchContext,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Rule 1: Project setup incomplete
  if (!context.hasGoals) {
    recommendations.push({
      id: "setup-project",
      priority: 1,
      title: "Complete project setup",
      description:
        "Define your research goals to get personalized guidance and recommendations.",
      reasoning: "Project goals help me suggest the right next steps for you.",
      actionType: "setup",
      navigateTo: "/setup",
    });
  }

  // Rule 2: No research data at all
  if (context.interviewCount === 0 && context.surveyCount === 0) {
    recommendations.push({
      id: "start-research",
      priority: 2,
      title: "Start gathering insights",
      description:
        "Run discovery interviews or create a survey to learn about your customers.",
      reasoning: "You have no research data yet - time to start learning!",
      actionType: "interview",
      navigateTo: "/ask/new",
      metadata: {
        suggestedOptions: ["interviews", "survey"],
      },
    });
  }

  // Rule 2b: Has interviews but no themes/evidence extracted yet
  if (
    context.interviewCount > 0 &&
    context.themes.length === 0 &&
    recommendations.length < 3
  ) {
    recommendations.push({
      id: "review-interviews",
      priority: 2,
      title: "Review your interviews",
      description: `You have ${context.interviewCount} interview${context.interviewCount === 1 ? "" : "s"}. Review them to identify themes and extract evidence.`,
      reasoning: `${context.interviewCount} interview${context.interviewCount === 1 ? " has" : "s have"} been added but no themes or evidence have been extracted yet.`,
      actionType: "analyze",
      navigateTo: "/themes",
    });
  }

  // Rule 3: Low evidence themes need validation
  const lowEvidenceThemes = context.themes.filter((t) => t.evidence_count < 3);
  if (lowEvidenceThemes.length > 0) {
    const topTheme = lowEvidenceThemes[0];
    recommendations.push({
      id: `validate-theme-${topTheme.id}`,
      priority: 3,
      title: `Validate: ${topTheme.name}`,
      description:
        "This theme needs more evidence to be confident. Create a survey or interview more customers.",
      reasoning: `Only ${topTheme.evidence_count} piece${topTheme.evidence_count === 1 ? "" : "s"} of evidence - need at least 3 to validate.`,
      actionType: "validate",
      navigateTo: "/ask/new",
      focusTheme: {
        id: topTheme.id,
        name: topTheme.name,
      },
    });
  }

  // Rule 4: High-confidence themes - go deeper
  const highEvidenceThemes = context.themes.filter(
    (t) => t.evidence_count >= 5,
  );
  if (highEvidenceThemes.length > 0 && recommendations.length < 3) {
    const topTheme = highEvidenceThemes[0];
    recommendations.push({
      id: `deep-dive-${topTheme.id}`,
      priority: 4,
      title: `Go deeper: ${topTheme.name}`,
      description:
        "This theme has strong evidence. Explore specific aspects or test assumptions.",
      reasoning: `${topTheme.evidence_count} pieces of evidence - ready for deeper exploration.`,
      actionType: "deep_dive",
      navigateTo: `/themes/${topTheme.id}`,
      focusTheme: {
        id: topTheme.id,
        name: topTheme.name,
      },
    });
  }

  // Rule 5: Pricing themes detected - special handling
  const pricingThemes = context.themes.filter(
    (t) =>
      t.name.toLowerCase().includes("pricing") ||
      t.name.toLowerCase().includes("price") ||
      t.pain?.toLowerCase().includes("cost") ||
      t.pain?.toLowerCase().includes("budget"),
  );
  if (pricingThemes.length > 0 && recommendations.length < 3) {
    const pricingTheme = pricingThemes[0];
    recommendations.push({
      id: "pricing-validation",
      priority: 5,
      title: "Pricing validation survey",
      description:
        "Understand willingness to pay and pricing sensitivity with a focused survey.",
      reasoning: "Pricing-related themes detected - validate before decisions.",
      actionType: "survey",
      navigateTo: "/ask/new",
      focusTheme: {
        id: pricingTheme.id,
        name: pricingTheme.name,
      },
      metadata: {
        surveyType: "pricing",
      },
    });
  }

  // Rule 6: No recent surveys - NPS check
  const hasRecentSurvey = context.previousSurveys.some((s) => {
    const createdAt = new Date(s.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return createdAt > thirtyDaysAgo;
  });

  if (
    !hasRecentSurvey &&
    context.surveyResponseCount > 0 &&
    recommendations.length < 3
  ) {
    recommendations.push({
      id: "nps-check",
      priority: 6,
      title: "NPS & satisfaction check",
      description:
        "Measure customer satisfaction and loyalty with a quick NPS survey.",
      reasoning: "No recent satisfaction surveys - time for a check-in.",
      actionType: "survey",
      navigateTo: "/ask/new",
      metadata: {
        surveyType: "nps",
      },
    });
  }

  // Rule 7: Lots of data, no decisions - time to synthesize
  if (
    context.themes.length >= 5 &&
    context.interviewCount >= 5 &&
    recommendations.length < 3
  ) {
    recommendations.push({
      id: "synthesize-findings",
      priority: 7,
      title: "Synthesize your findings",
      description:
        "You have enough data to draw conclusions. Review themes and make decisions.",
      reasoning: `${context.themes.length} themes from ${context.interviewCount} interviews - ready for synthesis.`,
      actionType: "analyze",
      navigateTo: "/themes",
    });
  }

  // Rule 8: People need segment inference (data quality)
  // Trigger when >5 people have titles but missing job_function/seniority
  const { peopleNeedingSegments, totalPeople } = context.dataQuality;
  if (peopleNeedingSegments >= 5 && recommendations.length < 3) {
    const percentage = Math.round((peopleNeedingSegments / totalPeople) * 100);
    recommendations.push({
      id: "infer-segments",
      priority: 8,
      title: "Enrich contact segmentation",
      description:
        "Run AI inference to fill in job functions and seniority levels for your contacts. This improves filtering and analysis on the Insights table.",
      reasoning: `${peopleNeedingSegments} of ${totalPeople} people (${percentage}%) have titles but are missing segmentation data.`,
      actionType: "data_quality",
      navigateTo: "/people",
      metadata: {
        taskType: "infer-segments",
        peopleNeedingSegments,
        totalPeople,
      },
    });
  }

  // Sort by priority and return top 3
  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

/**
 * Filter recommendations to only survey-related ones.
 * Used by the survey creation UI.
 */
export function getSurveyRecommendations(
  context: ProjectResearchContext,
): Recommendation[] {
  const allRecommendations = generateRecommendations(context);

  // Include recommendations that can be addressed with a survey
  const surveyActionable = allRecommendations.filter(
    (r) =>
      r.actionType === "survey" ||
      r.actionType === "validate" ||
      r.actionType === "deep_dive",
  );

  // If no survey-specific recommendations, suggest a discovery survey
  if (surveyActionable.length === 0 && context.themes.length === 0) {
    return [
      {
        id: "discovery-survey",
        priority: 1,
        title: "Discovery survey",
        description:
          "Learn about customer pains, needs, and motivations with a broad discovery survey.",
        reasoning:
          "Start with open-ended questions to identify themes and patterns.",
        actionType: "survey",
        navigateTo: "/ask/new",
        metadata: {
          surveyType: "discovery",
        },
      },
    ];
  }

  return surveyActionable;
}
