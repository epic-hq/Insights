/**
 * Billing Context - Required for all instrumented LLM calls
 *
 * This module defines the context that MUST be passed to all instrumented
 * LLM/AI calls for proper billing attribution.
 *
 * @see docs/20-features-prds/specs/billing-credits-entitlements.md
 */

/**
 * Billing context for LLM call attribution.
 * Required for all instrumented calls - TypeScript enforces this.
 */
export interface BillingContext {
  /** Account to bill (required) */
  accountId: string;
  /** User who triggered the action (null for system/background tasks) */
  userId: string | null;
  /** Project context if applicable */
  projectId?: string;
  /** Feature source for categorization (e.g., 'interview_analysis') */
  featureSource: FeatureSource;
}

/**
 * Feature sources for usage categorization.
 * Used for analytics and understanding cost drivers.
 */
export const FEATURE_SOURCES = [
  // Interview processing
  "interview_analysis",
  "interview_extraction",
  "interview_insights",
  "interview_personas",
  "interview_transcription",

  // Lens analysis
  "lens_application",
  "lens_synthesis",
  "lens_qa",

  // Survey processing
  "survey_analysis",
  "survey_responses",

  // Agent interactions
  "project_status_agent",
  "project_setup_agent",
  "interview_agent",
  "signup_agent",
  "research_agent",

  // Search and embeddings
  "semantic_search",
  "embedding_generation",
  "web_research",

  // Other
  "question_improvement",
  "theme_consolidation",
  "persona_summary",
  "auto_insights",
  "voice_chat",
] as const;

export type FeatureSource = (typeof FEATURE_SOURCES)[number];

/**
 * Validate that a billing context is complete
 */
export function validateBillingContext(ctx: BillingContext): void {
  if (!ctx.accountId) {
    throw new Error("BillingContext.accountId is required");
  }
  if (!ctx.featureSource) {
    throw new Error("BillingContext.featureSource is required");
  }
}

/**
 * Create a billing context for system/background tasks.
 * Use this when there's no specific user triggering the action.
 */
export function systemBillingContext(
  accountId: string,
  featureSource: FeatureSource,
  projectId?: string,
): BillingContext {
  return {
    accountId,
    userId: null,
    projectId,
    featureSource,
  };
}

/**
 * Create a billing context from request/auth context.
 * Use this in API routes and user-triggered actions.
 */
export function userBillingContext(params: {
  accountId: string;
  userId: string;
  featureSource: FeatureSource;
  projectId?: string;
}): BillingContext {
  return {
    accountId: params.accountId,
    userId: params.userId,
    projectId: params.projectId,
    featureSource: params.featureSource,
  };
}
