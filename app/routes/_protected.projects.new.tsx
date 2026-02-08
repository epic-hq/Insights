/**
 * Route: /projects/new
 * Purpose: Handle new project creation, either in normal mode or onboarding mode
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import OnboardingPage from "~/features/onboarding/pages";
import { userContext } from "~/server/user-context";

export async function loader({ context, request }: LoaderFunctionArgs) {
	// Get user context to ensure authentication
	const ctx = context.get(userContext);

	// If no user context, redirect to login
	if (!ctx?.claims) {
		return redirect("/login");
	}

	// Extract search params to check for onboarding mode
	const url = new URL(request.url);
	const isOnboarding = url.searchParams.get("onboarding") === "true";

	// User is authenticated and can access project creation
	return {
		isOnboarding,
		accountId: ctx.account_id,
	};
}

export default function NewProjectPage() {
	// Use the onboarding component which handles the complete flow
	return <OnboardingPage />;
}
