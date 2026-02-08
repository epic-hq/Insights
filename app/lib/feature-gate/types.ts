/**
 * Feature Gate Types
 *
 * Type definitions for the feature gating system.
 * @see docs/20-features-prds/specs/feature-gating-implementation.md
 */

import type { PlanFeatures, PlanId, PlanLimits } from "~/config/plans";

export type FeatureKey = keyof PlanFeatures;
export type LimitKey = keyof PlanLimits;

export interface FeatureGateContext {
	accountId: string;
	userId: string;
	planId: PlanId;
}

export interface FeatureCheckResult {
	allowed: boolean;
	reason?: "feature_disabled" | "limit_exceeded" | "limit_approaching";
	currentUsage?: number;
	limit?: number;
	upgradeUrl?: string;
	requiredPlan?: PlanId;
}

export interface LimitCheckResult extends FeatureCheckResult {
	remaining?: number;
	percentUsed?: number;
}
