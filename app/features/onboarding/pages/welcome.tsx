/**
 * Welcome Page - Feature tour for new users
 *
 * Shows a swipeable feature tour on first visit.
 * Tracks completion in user_settings.onboarding_steps.
 */

import { useCallback, useEffect, useState } from "react"
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	redirect,
	useFetcher,
	useLoaderData,
	useNavigate,
} from "react-router"
import { FeatureTour, SplashScreen } from "~/features/onboarding/components/FeatureTour"
import { userContext } from "~/server/user-context"

const TOUR_STEP_KEY = "feature_tour_completed"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	if (!supabase || !userId) {
		// Not authenticated, show splash for login
		return { showTour: false, isAuthenticated: false, redirectTo: "/login" }
	}

	// Check if user has completed the tour
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("onboarding_steps, last_used_account_id, last_used_project_id")
		.eq("user_id", userId)
		.maybeSingle()

	const onboardingSteps = (userSettings?.onboarding_steps || {}) as Record<string, boolean>
	const tourCompleted = onboardingSteps[TOUR_STEP_KEY] === true

	// If tour completed, redirect to their last project or account selector
	if (tourCompleted) {
		if (userSettings?.last_used_account_id && userSettings?.last_used_project_id) {
			return redirect(`/a/${userSettings.last_used_account_id}/${userSettings.last_used_project_id}`)
		}
		return redirect("/")
	}

	// Build redirect URL for after tour
	let redirectTo = "/"
	if (userSettings?.last_used_account_id && userSettings?.last_used_project_id) {
		redirectTo = `/a/${userSettings.last_used_account_id}/${userSettings.last_used_project_id}`
	}

	return {
		showTour: true,
		isAuthenticated: true,
		redirectTo,
	}
}

export async function action({ request, context }: ActionFunctionArgs) {
	const formData = await request.formData()
	const intent = formData.get("intent")

	if (intent !== "complete_tour") {
		return { error: "Unknown action" }
	}

	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	if (!supabase || !userId) {
		return { error: "Not authenticated" }
	}

	// Get current onboarding steps
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("onboarding_steps")
		.eq("user_id", userId)
		.maybeSingle()

	const currentSteps = (userSettings?.onboarding_steps || {}) as Record<string, boolean>

	// Update with tour completed
	const updatedSteps = {
		...currentSteps,
		[TOUR_STEP_KEY]: true,
	}

	const { error } = await supabase
		.from("user_settings")
		.update({
			onboarding_steps: updatedSteps,
			updated_at: new Date().toISOString(),
		})
		.eq("user_id", userId)

	if (error) {
		console.error("[welcome] Failed to update onboarding_steps:", error)
		return { error: "Failed to save progress" }
	}

	return { success: true }
}

export default function WelcomePage() {
	const { showTour, isAuthenticated, redirectTo } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const fetcher = useFetcher()
	const [showingSplash, setShowingSplash] = useState(!isAuthenticated)

	const handleTourComplete = useCallback(() => {
		// Mark tour as complete
		fetcher.submit(
			{ intent: "complete_tour" },
			{ method: "post" }
		)
	}, [fetcher])

	// Navigate after successful tour completion
	useEffect(() => {
		if (fetcher.data?.success) {
			navigate(redirectTo || "/")
		}
	}, [fetcher.data, navigate, redirectTo])

	const handleSplashContinue = useCallback(() => {
		if (isAuthenticated) {
			setShowingSplash(false)
		} else {
			navigate("/login")
		}
	}, [isAuthenticated, navigate])

	// Show splash for unauthenticated users
	if (showingSplash || !isAuthenticated) {
		return (
			<SplashScreen
				onContinue={handleSplashContinue}
				showLogin={!isAuthenticated}
				loginHref="/login"
			/>
		)
	}

	// Show feature tour
	if (showTour) {
		return (
			<FeatureTour
				onComplete={handleTourComplete}
				onSkip={handleTourComplete}
				showSkip
			/>
		)
	}

	// Fallback - redirect handled by loader
	return null
}
