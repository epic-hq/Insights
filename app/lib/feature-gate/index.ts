/**
 * Feature Gate Module
 *
 * Client-safe exports only. Server-only code must be imported directly:
 * - import { checkFeatureAccess } from "~/lib/feature-gate/check-feature.server"
 * - import { checkLimitAccess } from "~/lib/feature-gate/check-limit.server"
 *
 * @see docs/20-features-prds/specs/feature-gating-implementation.md
 */

// Client-safe utilities
export { getFeatureDisplayName } from "./display-names"
// Errors (client-safe)
export { FeatureGateError } from "./errors"
// Types (client-safe)
export type {
	FeatureCheckResult,
	FeatureGateContext,
	FeatureKey,
	LimitCheckResult,
	LimitKey,
} from "./types"

// NOTE: Server-only exports must be imported directly:
// import { checkFeatureAccess, requireFeatureAccess } from "~/lib/feature-gate/check-feature.server"
// import { checkLimitAccess, requireLimitAccess } from "~/lib/feature-gate/check-limit.server"
