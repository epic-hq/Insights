/**
 * Upgrade Badge Component
 *
 * Small inline badge that indicates a feature requires an upgrade.
 * Links directly to checkout for the required plan.
 */

import { Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import type { PlanId } from "~/config/plans";
import { useFeatureGate } from "~/hooks/useFeatureGate";
import { getFeatureDisplayName } from "~/lib/feature-gate";
import type { FeatureKey, LimitKey } from "~/lib/feature-gate/types";

interface UpgradeBadgeProps {
	/** Feature or limit key */
	feature: FeatureKey | LimitKey;
	/** Current plan ID (used to determine upgrade URL) */
	planId?: PlanId;
	/** Size variant */
	size?: "sm" | "md";
	/** Optional custom label */
	label?: string;
}

/**
 * Displays a small badge indicating upgrade is required.
 *
 * @example
 * <UpgradeBadge feature="smart_personas" planId="free" />
 * <UpgradeBadge feature="smart_personas" planId="free" size="md" />
 */
export function UpgradeBadge({ feature, planId = "free", size = "sm", label }: UpgradeBadgeProps) {
	const { upgradeUrl } = useFeatureGate(feature as FeatureKey, planId);
	const displayLabel = label ?? (size === "md" ? "Upgrade to unlock" : "Upgrade");

	return (
		<Link to={upgradeUrl ?? "/pricing"}>
			<Badge
				variant="outline"
				className="gap-1 border-amber-500/50 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
			>
				<Sparkles className="h-3 w-3" />
				{displayLabel}
			</Badge>
		</Link>
	);
}

/**
 * Displays feature name with upgrade badge inline.
 *
 * @example
 * <FeatureLabel feature="smart_personas" />
 * // Renders: "Smart Personas [Upgrade]"
 */
export function FeatureLabel({ feature }: { feature: FeatureKey }) {
	return (
		<span className="inline-flex items-center gap-2">
			{getFeatureDisplayName(feature)}
			<UpgradeBadge feature={feature} size="sm" />
		</span>
	);
}
