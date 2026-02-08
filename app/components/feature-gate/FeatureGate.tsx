/**
 * Feature Gate Component
 *
 * Wrapper component that conditionally renders children based on feature access.
 * Shows upgrade prompt when feature is not available.
 */

import { Lock, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { PlanId } from "~/config/plans";
import { useFeatureGate } from "~/hooks/useFeatureGate";
import { getFeatureDisplayName } from "~/lib/feature-gate";
import type { FeatureKey } from "~/lib/feature-gate/types";

interface FeatureGateProps {
	/** Feature to check */
	feature: FeatureKey;
	/** Current plan ID */
	planId: PlanId;
	/** Content to render if feature is enabled */
	children: React.ReactNode;
	/** Custom fallback when feature is disabled */
	fallback?: React.ReactNode;
	/** Style of fallback: "inline" for badges, "card" for full prompts */
	fallbackStyle?: "inline" | "card" | "overlay";
}

/**
 * Conditionally renders children based on feature access.
 *
 * @example
 * // Card-style fallback (default)
 * <FeatureGate feature="smart_personas" planId={currentPlan}>
 *   <PersonaGenerator />
 * </FeatureGate>
 *
 * // Inline fallback
 * <FeatureGate feature="smart_personas" planId={currentPlan} fallbackStyle="inline">
 *   <Button>Generate Personas</Button>
 * </FeatureGate>
 *
 * // Custom fallback
 * <FeatureGate feature="smart_personas" planId={currentPlan} fallback={<MyCustomPrompt />}>
 *   <PersonaGenerator />
 * </FeatureGate>
 */
export function FeatureGate({ feature, planId, children, fallback, fallbackStyle = "card" }: FeatureGateProps) {
	const { isEnabled, upgradeUrl, requiredPlan } = useFeatureGate(feature, planId);

	if (isEnabled) {
		return <>{children}</>;
	}

	// Custom fallback takes priority
	if (fallback) {
		return <>{fallback}</>;
	}

	// Default fallbacks based on style
	switch (fallbackStyle) {
		case "inline":
			return <InlineFallback feature={feature} upgradeUrl={upgradeUrl} />;
		case "overlay":
			return (
				<OverlayFallback feature={feature} upgradeUrl={upgradeUrl} requiredPlan={requiredPlan}>
					{children}
				</OverlayFallback>
			);
		case "card":
		default:
			return <CardFallback feature={feature} upgradeUrl={upgradeUrl} requiredPlan={requiredPlan} />;
	}
}

function InlineFallback({ feature, upgradeUrl }: { feature: FeatureKey; upgradeUrl?: string }) {
	return (
		<Link to={upgradeUrl ?? "/pricing"}>
			<Button variant="outline" size="sm" className="gap-2" disabled>
				<Lock className="h-3 w-3" />
				{getFeatureDisplayName(feature)}
				<span className="text-amber-600 dark:text-amber-400">Pro</span>
			</Button>
		</Link>
	);
}

function CardFallback({
	feature,
	upgradeUrl,
	requiredPlan,
}: {
	feature: FeatureKey;
	upgradeUrl?: string;
	requiredPlan?: PlanId;
}) {
	return (
		<Card className="border-dashed">
			<CardHeader className="text-center">
				<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
					<Sparkles className="h-6 w-6 text-amber-500" />
				</div>
				<CardTitle>{getFeatureDisplayName(feature)}</CardTitle>
				<CardDescription>Upgrade to {requiredPlan ?? "a paid plan"} to unlock this feature</CardDescription>
			</CardHeader>
			<CardContent className="text-center">
				<Link to={upgradeUrl ?? "/pricing"}>
					<Button className="gap-2">
						<Sparkles className="h-4 w-4" />
						Upgrade Now
					</Button>
				</Link>
			</CardContent>
		</Card>
	);
}

function OverlayFallback({
	feature,
	upgradeUrl,
	requiredPlan,
	children,
}: {
	feature: FeatureKey;
	upgradeUrl?: string;
	requiredPlan?: PlanId;
	children: React.ReactNode;
}) {
	return (
		<div className="relative">
			{/* Blurred content behind */}
			<div className="pointer-events-none select-none blur-sm">{children}</div>

			{/* Overlay */}
			<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
				<div className="text-center">
					<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
						<Lock className="h-5 w-5 text-amber-500" />
					</div>
					<p className="mb-3 font-medium">{getFeatureDisplayName(feature)}</p>
					<Link to={upgradeUrl ?? "/pricing"}>
						<Button size="sm" className="gap-2">
							<Sparkles className="h-4 w-4" />
							Upgrade to {requiredPlan}
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
