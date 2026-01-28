/**
 * Polar Checkout Redirect Endpoint
 *
 * Creates a Polar checkout session and redirects the user.
 *
 * Usage:
 * - GET /api/billing/checkout?plan=starter
 * - GET /api/billing/checkout?plan=pro
 * - GET /api/billing/checkout?plan=team
 *
 * Query params:
 * - plan (required): Plan ID to purchase (starter, pro, team)
 * - interval (optional): "month" or "year" (default: month)
 *
 * The account_id is automatically extracted from the authenticated user's session.
 */

import { Polar } from "@polar-sh/sdk"
import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { redirect } from "react-router"
import type { PlanId } from "~/config/plans"
import { PLANS } from "~/config/plans"
import { getServerEnv } from "~/env.server"
import { getPostHogServerClient } from "~/lib/posthog.server"
import { getAuthenticatedUser, supabaseAdmin } from "~/lib/supabase/client.server"

/**
 * Get Polar product ID for a plan and interval.
 */
function getPolarProductId(env: ReturnType<typeof getServerEnv>, plan: PlanId, interval: string): string | undefined {
	const products: Record<PlanId, { monthly?: string; annual?: string }> = {
		free: {},
		starter: {
			monthly: env.POLAR_PRODUCT_STARTER_MONTHLY,
			annual: env.POLAR_PRODUCT_STARTER_ANNUAL,
		},
		pro: {
			monthly: env.POLAR_PRODUCT_PRO_MONTHLY,
			annual: env.POLAR_PRODUCT_PRO_ANNUAL,
		},
		team: {
			monthly: env.POLAR_PRODUCT_TEAM_MONTHLY,
			annual: env.POLAR_PRODUCT_TEAM_ANNUAL,
		},
	}

	const config = products[plan]
	return interval === "year" ? config?.annual : config?.monthly
}

export async function loader({ request }: LoaderFunctionArgs) {
	const env = getServerEnv()
	const { user } = await getAuthenticatedUser(request)

	// Require authentication - preserve full checkout URL for redirect after login
	if (!user) {
		consola.warn("[checkout] Unauthenticated checkout attempt")
		const returnUrl = new URL(request.url).pathname + new URL(request.url).search
		return redirect(`/login?redirect=${encodeURIComponent(returnUrl)}`)
	}

	// Get team account_id (not personal account) for billing
	// Personal accounts have personal_account=true, we want team accounts
	const { data: membership, error: membershipError } = await supabaseAdmin
		.schema("accounts")
		.from("account_user")
		.select("account_id, accounts!inner(id, personal_account)")
		.eq("user_id", user.sub)
		.eq("accounts.personal_account", false)
		.limit(1)
		.maybeSingle()

	if (membershipError) {
		consola.warn("[checkout] Error fetching team account", {
			userId: user.sub,
			error: membershipError.message,
		})
	}

	const accountId = membership?.account_id
	if (!accountId) {
		consola.warn("[checkout] No team account for user", { userId: user.sub })
		// User doesn't have a team account yet - this shouldn't happen normally
		return redirect("/home?error=no_team_account")
	}

	const url = new URL(request.url)
	const plan = url.searchParams.get("plan") as PlanId | null
	const interval = url.searchParams.get("interval") || "month"

	// Validate plan
	if (!plan || !PLANS[plan]) {
		consola.warn("[checkout] Invalid plan", { plan })
		return redirect("/pricing?error=invalid_plan")
	}

	// Free plan doesn't need checkout
	if (plan === "free") {
		return redirect("/pricing?error=free_plan")
	}

	// Get product ID for this plan
	const productId = getPolarProductId(env, plan, interval)

	if (!productId) {
		consola.error("[checkout] Missing Polar product ID", { plan, interval })
		return redirect("/pricing?error=product_not_configured")
	}

	// Check for access token
	const accessToken = env.POLAR_ACCESS_TOKEN
	if (!accessToken) {
		consola.error("[checkout] POLAR_ACCESS_TOKEN not configured")
		return redirect("/pricing?error=billing_not_configured")
	}

	// Build metadata to pass to Polar
	const metadata = {
		account_id: accountId,
		user_id: user.sub,
		plan_id: plan,
	}

	// Determine server environment
	const server = env.APP_ENV === "production" ? "production" : ("sandbox" as const)

	// Build success URL - redirect to welcome-upgrade page with plan param
	const origin = url.origin
	const successUrl = `${origin}/a/${accountId}/welcome-upgrade?plan=${plan}`

	consola.info("[checkout] Creating Polar checkout session", {
		plan,
		interval,
		productId,
		accountId,
		server,
	})

	// Initialize Polar SDK with appropriate server
	const polar = new Polar({
		accessToken,
		server: server === "sandbox" ? "sandbox" : "production",
	})

	// Get minimum seats for per-user plans (Team plan starts at 2 seats)
	// Only send seats if product supports seat-based pricing (production)
	const planConfig = PLANS[plan]
	const minSeats = server === "production" && planConfig.perUser ? (planConfig.minSeats ?? 1) : undefined
	const billingErrorUrl = `/a/${accountId}/billing?error=subscription_update_failed`

	try {
		// If the account already has an active/trialing Polar subscription, update it instead of creating a new checkout.
		const { data: existingSubscription } = await supabaseAdmin
			.schema("accounts")
			.from("billing_subscriptions")
			.select("id, plan_name, status, quantity")
			.eq("account_id", accountId)
			.eq("provider", "polar")
			.in("status", ["active", "trialing"])
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle()

		if (existingSubscription) {
			consola.info("[checkout] Updating existing Polar subscription", {
				accountId,
				subscriptionId: existingSubscription.id,
				fromPlan: existingSubscription.plan_name,
				toPlan: plan,
			})

			try {
				await polar.subscriptions.update({
					id: existingSubscription.id,
					subscriptionUpdate: {
						productId,
					},
				})

				let seatCount: number | undefined
				if (server === "production" && planConfig.perUser) {
					const { count: memberCount, error: memberCountError } = await supabaseAdmin
						.schema("accounts")
						.from("account_user")
						.select("*", { count: "exact", head: true })
						.eq("account_id", accountId)

					if (memberCountError) {
						consola.warn("[checkout] Failed to count team members for seat update", {
							accountId,
							error: memberCountError.message,
						})
					}

					const requestedSeats = memberCount ?? 1
					const minimumSeats = planConfig.minSeats ?? 1
					seatCount = Math.max(requestedSeats, minimumSeats)

					await polar.subscriptions.update({
						id: existingSubscription.id,
						subscriptionUpdate: {
							seats: seatCount,
						},
					})
				}

				// Update local subscription record immediately for UI consistency (webhook will also sync)
				const updatePayload: {
					plan_name: string
					price_id: string
					quantity?: number
				} = {
					plan_name: planConfig.name,
					price_id: productId,
				}

				if (typeof seatCount === "number") {
					updatePayload.quantity = seatCount
				}

				const { error: updateError } = await supabaseAdmin
					.schema("accounts")
					.from("billing_subscriptions")
					.update(updatePayload)
					.eq("id", existingSubscription.id)

				if (updateError) {
					consola.warn("[checkout] Failed to update local subscription after product switch", {
						accountId,
						error: updateError.message,
					})
				}

				return redirect(successUrl)
			} catch (error) {
				const errorBody = (error as { body?: string | Record<string, unknown>; rawValue?: Record<string, unknown> })
					?.body
				const rawValue = (error as { rawValue?: Record<string, unknown> })?.rawValue
				const errorDescription =
					(typeof errorBody === "string" ? errorBody : undefined) ?? (rawValue?.error_description as string | undefined)
				const errorCode = rawValue?.error as string | undefined
				const requiresScopes = errorCode === "insufficient_scope"

				consola.error("[checkout] Failed to update subscription", {
					accountId,
					subscriptionId: existingSubscription.id,
					error,
					errorCode,
					errorDescription,
				})

				if (requiresScopes) {
					return redirect(`/a/${accountId}/billing?error=subscription_update_insufficient_scope`)
				}

				return redirect(billingErrorUrl)
			}
		}

		// Create checkout session via Polar API
		// Note: SDK uses `products` array, not `productId`
		const checkout = await polar.checkouts.create({
			products: [productId],
			successUrl: `${successUrl}&checkout_id={CHECKOUT_ID}`,
			customerEmail: user.email || undefined,
			metadata,
			// For per-user plans (Team), set minimum seats (production only)
			...(minSeats && { seats: minSeats }),
		})

		consola.info("[checkout] Checkout session created", {
			checkoutId: checkout.id,
			url: checkout.url,
		})

		// Track checkout_started event for PLG instrumentation
		try {
			const posthogServer = getPostHogServerClient()
			if (posthogServer) {
				posthogServer.capture({
					distinctId: user.sub,
					event: "checkout_started",
					properties: {
						account_id: accountId,
						plan: plan,
						interval: interval,
						checkout_id: checkout.id,
						$groups: { account: accountId },
					},
				})
			}
		} catch (trackingError) {
			consola.warn("[CHECKOUT] PostHog tracking failed:", trackingError)
		}

		return redirect(checkout.url)
	} catch (error) {
		consola.error("[checkout] Failed to create checkout session", { error })
		return redirect("/pricing?error=checkout_failed")
	}
}
