/**
 * Feature Gate Module
 *
 * Server-side feature gating based on plan entitlements.
 * Use in API routes to enforce feature and limit access.
 *
 * @example
 * import { requireFeatureAccess, checkLimitAccess, FeatureGateError } from "~/lib/feature-gate"
 *
 * // In API route
 * try {
 *   await requireFeatureAccess(ctx, "smart_personas")
 *   // Feature is available, proceed
 * } catch (error) {
 *   if (error instanceof FeatureGateError) {
 *     return json(error.toJSON(), { status: 403 })
 *   }
 *   throw error
 * }
 *
 * @see docs/20-features-prds/specs/feature-gating-implementation.md
 */

// Types
export type {
  FeatureCheckResult,
  FeatureGateContext,
  FeatureKey,
  LimitCheckResult,
  LimitKey,
} from "./types";

// Boolean feature checks
export {
  checkFeatureAccess,
  getFeatureDisplayName,
  requireFeatureAccess,
} from "./check-feature.server";

// Usage limit checks
export { checkLimitAccess, requireLimitAccess } from "./check-limit.server";

// Errors
export { FeatureGateError } from "./errors";
