/**
 * Feature Gate - Boolean Feature Checks
 *
 * Server-side checks for boolean feature entitlements.
 * Use in API routes before executing feature logic.
 */

import { hasFeature, PLAN_IDS, type PlanId } from "~/config/plans";
import { FeatureGateError } from "./errors";
import type {
  FeatureCheckResult,
  FeatureGateContext,
  FeatureKey,
} from "./types";

/**
 * Check if account has access to a boolean feature.
 * Use in API routes before executing feature logic.
 *
 * @example
 * const result = await checkFeatureAccess(ctx, "smart_personas")
 * if (!result.allowed) {
 *   return json({ error: "upgrade_required", ...result }, { status: 403 })
 * }
 */
export async function checkFeatureAccess(
  ctx: FeatureGateContext,
  feature: FeatureKey,
): Promise<FeatureCheckResult> {
  const allowed = hasFeature(ctx.planId, feature);

  if (!allowed) {
    const requiredPlan = findMinimumPlanForFeature(feature);
    return {
      allowed: false,
      reason: "feature_disabled",
      requiredPlan,
      upgradeUrl: `/pricing?highlight=${requiredPlan}&feature=${String(feature)}`,
    };
  }

  return { allowed: true };
}

/**
 * Require feature access - throws FeatureGateError if not allowed.
 * Use for cleaner control flow in API routes.
 *
 * @example
 * try {
 *   await requireFeatureAccess(ctx, "smart_personas")
 *   // ... feature logic
 * } catch (error) {
 *   if (error instanceof FeatureGateError) {
 *     return json(error.toJSON(), { status: 403 })
 *   }
 *   throw error
 * }
 */
export async function requireFeatureAccess(
  ctx: FeatureGateContext,
  feature: FeatureKey,
): Promise<void> {
  const result = await checkFeatureAccess(ctx, feature);
  if (!result.allowed) {
    throw new FeatureGateError(feature, result);
  }
}

/**
 * Find the minimum plan tier that includes a feature.
 */
function findMinimumPlanForFeature(feature: FeatureKey): PlanId {
  for (const planId of PLAN_IDS) {
    if (hasFeature(planId, feature)) {
      return planId;
    }
  }
  return "team"; // Default to highest tier if not found
}

/**
 * Get a human-readable name for a feature.
 */
export function getFeatureDisplayName(feature: FeatureKey): string {
  const names: Record<FeatureKey, string> = {
    survey_ai_analysis: "Survey AI Analysis",
    team_workspace: "Team Workspace",
    sso: "Single Sign-On",
    interview_guide: "Interview Guide",
    smart_personas: "Smart Personas",
    ai_crm: "AI CRM",
  };
  return names[feature] ?? String(feature);
}
