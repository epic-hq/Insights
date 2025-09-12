import { usePostHog } from "posthog-js/react"
import { useEffect, useState } from "react"

/**
 * Hook for PostHog feature flags with proper initialization and loading state
 */
export function usePostHogFeatureFlag(flagKey: string): {
	isEnabled: boolean
	isLoading: boolean
} {
	const posthog = usePostHog()
	const [isEnabled, setIsEnabled] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		if (!posthog) {
			setIsLoading(false)
			return
		}

		// Set person properties if needed (as per your example)
		// posthog.setPersonPropertiesForFlags({'email': 'value'})

		// Wait for flags to be loaded
		posthog.onFeatureFlags(() => {
			const flagValue = posthog.isFeatureEnabled(flagKey)
			setIsEnabled(flagValue)
			setIsLoading(false)
		})

		// Also check immediately in case flags are already loaded
		const currentValue = posthog.isFeatureEnabled(flagKey)
		if (currentValue !== undefined) {
			setIsEnabled(Boolean(currentValue))
			setIsLoading(false)
		}
	}, [posthog, flagKey])

	return { isEnabled, isLoading }
}