/**
 * Route: /onboarding
 * Purpose: Handle new project creation and setup flow
 * This route is specifically for NEW project creation, not editing existing projects
 * IMPORTANT: This is the entry point for creating new projects, not for editing existing ones
 */

import { redirect } from "react-router-dom"
import OnboardingPage from "~/features/onboarding/pages"
import { userContext } from "~/server/user-context"

type LoaderArgs = {
	context: {
		get: (ctx: typeof userContext) => { user?: unknown } | null | undefined
	}
}

export async function loader({ context }: LoaderArgs) {
	// Get user context to ensure authentication
	const ctx = context.get(userContext)

	// If no user context, redirect to login
	if (!ctx?.user) {
		return redirect("/login")
	}

	// User is authenticated and can access onboarding for new project creation
	return {}
}

// Use the proper onboarding component for NEW project creation
export default OnboardingPage
