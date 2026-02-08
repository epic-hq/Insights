/**
 * Polar Customer Portal Redirect
 *
 * Creates an authenticated customer portal session via the Polar SDK
 * and redirects the user to manage subscriptions, payment methods, and billing.
 *
 * Usage:
 * - GET /api/billing/portal
 *
 * Requires the user to have an existing Polar customer ID linked to their account.
 */

import { Polar } from "@polar-sh/sdk"
import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { redirect } from "react-router"
import { getServerEnv } from "~/env.server"
import { getAuthenticatedUser, supabaseAdmin } from "~/lib/supabase/client.server"

export async function loader({ request }: LoaderFunctionArgs) {
	const env = getServerEnv()
	const { user } = await getAuthenticatedUser(request)

	// Require authentication
	if (!user) {
		consola.warn("[portal] Unauthenticated portal access attempt")
		return redirect("/login?redirect=/api/billing/portal")
	}

	// Get account_id from user's membership (use admin client to bypass RLS)
	// Only allow owners of a team account to access billing
	const { data: membership, error: membershipError } = await supabaseAdmin
		.schema("accounts")
		.from("account_user")
		.select("account_id, account_role, accounts!inner(id, personal_account)")
		.eq("user_id", user.sub)
		.eq("account_role", "owner")
		.eq("accounts.personal_account", false)
		.limit(1)
		.single()

	if (membershipError) {
		consola.warn("[portal] Error fetching account membership", {
			userId: user.sub,
			error: membershipError.message,
		})
	}

	const accountId = membership?.account_id
	if (!accountId) {
		consola.warn("[portal] No owned team account for user", {
			userId: user.sub,
		})
		return redirect("/home?error=owner_required")
	}

	// Build the billing page URL for this account
	const billingUrl = `/a/${accountId}/billing`

	// Check for access token
	const accessToken = env.POLAR_ACCESS_TOKEN
	if (!accessToken) {
		consola.error("[portal] POLAR_ACCESS_TOKEN not configured")
		return redirect(`${billingUrl}?error=billing_not_configured`)
	}

	// Look up the Polar customer ID for this account
	const { data: customer, error } = await supabaseAdmin
		.schema("accounts")
		.from("billing_customers")
		.select("id")
		.eq("account_id", accountId)
		.eq("provider", "polar")
		.single()

	if (error || !customer) {
		consola.warn("[portal] No Polar customer found for account", {
			accountId,
			error,
		})
		// No subscription yet - redirect to billing page where they can upgrade
		return redirect(`${billingUrl}?error=no_subscription`)
	}

	// Determine server environment
	const server = env.APP_ENV === "production" ? "production" : "sandbox"

	consola.info("[portal] Creating customer portal session", {
		accountId,
		customerId: customer.id,
		server,
	})

	try {
		const polar = new Polar({
			accessToken,
			server: server === "sandbox" ? "sandbox" : "production",
		})

		// Create an authenticated customer portal session
		const session = await polar.customerSessions.create({
			customerId: customer.id,
		})

		consola.info("[portal] Redirecting to Polar customer portal", {
			accountId,
			customerId: customer.id,
		})

		return redirect(session.customerPortalUrl)
	} catch (portalError) {
		consola.error("[portal] Failed to create customer portal session", {
			accountId,
			customerId: customer.id,
			error: portalError,
		})
		return redirect(`${billingUrl}?error=portal_failed`)
	}
}
