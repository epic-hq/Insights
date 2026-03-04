/**
 * Hook for PostHog multivariate experiments on any page (including public marketing pages).
 *
 * Unlike usePostHogFeatureFlag (which requires PostHogProvider from _ProtectedLayout),
 * this hook lazily initializes a standalone PostHog instance using window.env credentials,
 * making it safe to use on the public landing page.
 *
 * Returns the variant key string (e.g. "control", "outcome", "category") and a loading state.
 * While loading, returns `defaultVariant` so the page renders without a flash of empty content.
 */
import { useEffect, useState } from "react";
import { resolvePosthogHost } from "~/lib/posthog/config";

let sharedInstance: import("posthog-js").PostHog | null = null;

export function usePostHogExperiment(
	flagKey: string,
	defaultVariant = "control"
): { variant: string; isLoading: boolean } {
	const [variant, setVariant] = useState(defaultVariant);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (typeof window === "undefined") {
			setIsLoading(false);
			return;
		}

		const posthogKey = window.env?.POSTHOG_KEY;
		if (!posthogKey || typeof posthogKey !== "string" || !posthogKey.trim()) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				if (!sharedInstance) {
					const posthogModule = await import("posthog-js");
					const ph = posthogModule.default;

					// Only init if not already initialized (another component may have beaten us)
					if (!ph.__loaded) {
						ph.init(posthogKey.trim(), {
							api_host: resolvePosthogHost(window.env?.POSTHOG_HOST),
							persistence: "localStorage+cookie",
							autocapture: false,
							capture_pageview: false,
							loaded: (instance) => {
								sharedInstance = instance;
							},
						});
					}
					sharedInstance = ph;
				}

				const ph = sharedInstance;

				// Wait for feature flags to load
				ph.onFeatureFlags(() => {
					if (cancelled) return;
					const flagValue = ph.getFeatureFlag(flagKey);
					if (typeof flagValue === "string") {
						setVariant(flagValue);
					}
					setIsLoading(false);
				});

				// Check immediately in case flags are already loaded
				const currentValue = ph.getFeatureFlag(flagKey);
				if (currentValue !== undefined && !cancelled) {
					if (typeof currentValue === "string") {
						setVariant(currentValue);
					}
					setIsLoading(false);
				}
			} catch {
				if (!cancelled) setIsLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [flagKey, defaultVariant]);

	return { variant, isLoading };
}
