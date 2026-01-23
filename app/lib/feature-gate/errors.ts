/**
 * Feature Gate Errors
 *
 * Custom error classes for feature gating.
 */

import type { FeatureCheckResult, FeatureKey, LimitKey } from "./types"

export class FeatureGateError extends Error {
	public readonly feature: FeatureKey | LimitKey
	public readonly result: FeatureCheckResult

	constructor(feature: FeatureKey | LimitKey, result: FeatureCheckResult) {
		super(`Feature "${String(feature)}" not available: ${result.reason}`)
		this.name = "FeatureGateError"
		this.feature = feature
		this.result = result
	}

	toJSON() {
		return {
			error: "upgrade_required",
			feature: this.feature,
			reason: this.result.reason,
			upgradeUrl: this.result.upgradeUrl,
			requiredPlan: this.result.requiredPlan,
			currentUsage: this.result.currentUsage,
			limit: this.result.limit,
		}
	}
}
