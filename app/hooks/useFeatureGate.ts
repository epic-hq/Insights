/**
 * Feature Gate Hooks
 *
 * Client-side hooks for checking feature access based on plan.
 * Use in components to show/hide features or display upgrade prompts.
 *
 * @example
 * const { isEnabled, upgradeUrl } = useFeatureGate("smart_personas", planId)
 * if (!isEnabled) {
 *   return <UpgradeBadge feature="smart_personas" />
 * }
 */

import { useMemo } from "react";
import { hasFeature, PLAN_IDS, type PlanId } from "~/config/plans";
import type { FeatureKey } from "~/lib/feature-gate/types";

interface UseFeatureGateReturn {
	/** Whether the feature is available on current plan */
	isEnabled: boolean;
	/** Upgrade URL if feature is disabled */
	upgradeUrl?: string;
	/** The minimum plan required */
	requiredPlan?: PlanId;
}

/**
 * Check if a boolean feature is enabled for the given plan.
 *
 * @param feature - The feature key to check
 * @param planId - The account's current plan (defaults to "free")
 *
 * @example
 * // In a component with plan data from loader
 * const { currentPlan } = useLoaderData<typeof loader>()
 * const { isEnabled, upgradeUrl } = useFeatureGate("smart_personas", currentPlan)
 *
 * if (!isEnabled) {
 *   return <UpgradeBanner href={upgradeUrl} feature="Smart Personas" />
 * }
 */
export function useFeatureGate(feature: FeatureKey, planId: PlanId = "free"): UseFeatureGateReturn {
	return useMemo(() => {
		const isEnabled = hasFeature(planId, feature);

		if (isEnabled) {
			return { isEnabled: true };
		}

		// Find minimum plan that has this feature
		const requiredPlan = findMinimumPlanForFeature(feature);

		return {
			isEnabled: false,
			// Go directly to checkout - user has already decided they want this feature
			upgradeUrl: `/api/billing/checkout?plan=${requiredPlan}`,
			requiredPlan,
		};
	}, [planId, feature]);
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
	return "team";
}
