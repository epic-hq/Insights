import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { getPostHogServerClient } from "~/lib/posthog.server"
import { getServerClient } from "~/lib/supabase/server"
import { collectPersistedUtmParams, clearUtmCookie, extractUtmParamsFromRequest } from "~/utils/utm.server"
import type { UtmParams } from "~/utils/utm"
import type { SupabaseClient } from "~/types"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const next = requestUrl.searchParams.get("next") || "/home"

	const { client: supabase, headers } = getServerClient(request)
	const utmParams = collectPersistedUtmParams(request, extractUtmParamsFromRequest(request))
	headers.append("Set-Cookie", clearUtmCookie())

	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) {
		consola.warn("[LOGIN_SUCCESS] No authenticated user found, redirecting to login")
		return redirect(`/login?next=${encodeURIComponent(next)}`)
	}

	// Check if this is a new user signup (first time login)
	const isNewUser = await checkIfNewUser(supabase, user.id)

	if (isNewUser) {
		// Capture account_signed_up event for new users
		await captureSignupEvent({
			supabase,
			userId: user.id,
			email: user.email,
			metadata: user.user_metadata,
			utmParams,
		})
	}

	const inviteRedirect = await resolveInviteRedirect({
		supabase,
		next,
		origin: requestUrl.origin,
	})

	const destination = inviteRedirect ?? next
	consola.log("[LOGIN_SUCCESS] redirecting to:", destination)
	return redirect(destination, { headers })
}

/**
 * Check if user is signing up for the first time by checking user_settings creation timestamp
 */
async function checkIfNewUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
	try {
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("created_at")
			.eq("user_id", userId)
			.single()

		if (!userSettings) {
			return true // No user_settings record = brand new user
		}

		// Check if created within last 10 seconds (indicates fresh signup)
		const createdAt = new Date(userSettings.created_at)
		const now = new Date()
		const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000

		return diffSeconds < 10
	} catch (error) {
		consola.warn("[LOGIN_SUCCESS] Error checking if new user:", error)
		return false // Default to not new user on error
	}
}

/**
 * Capture account_signed_up event to PostHog
 * This only fires once per user, on their first successful authentication
 */
async function captureSignupEvent({
	supabase,
	userId,
	email,
	metadata,
	utmParams,
}: {
	supabase: SupabaseClient
	userId: string
	email?: string
	metadata?: Record<string, unknown>
	utmParams: UtmParams
}) {
	try {
		const posthog = getPostHogServerClient()
		if (!posthog) {
			consola.warn("[LOGIN_SUCCESS] PostHog server client unavailable; skipping signup event")
			return
		}

		const utmProperties = Object.fromEntries(
			Object.entries(utmParams).filter(([, value]) => typeof value === "string" && value.length > 0)
		) as Record<string, string>
		const personUtmProperties = Object.fromEntries(
			Object.entries(utmProperties).map(([key, value]) => [`source_${key}`, value])
		) as Record<string, string>

		// Get user's account info
		const { data: accounts } = await supabase.rpc("get_user_accounts")
		const accountId = Array.isArray(accounts) && accounts.length > 0 ? accounts[0].account_id : undefined

		// Get user settings for additional context
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("role, company_name, referral_source, signup_data")
			.eq("user_id", userId)
			.single()

		const rawProvider = metadata?.["provider"]
		const provider = typeof rawProvider === "string" ? rawProvider : undefined

		// Capture the signup event
		await posthog.capture({
			distinctId: userId,
			event: "account_signed_up",
			properties: {
				email,
				auth_provider: provider || "email",
				account_id: accountId,
				plan: "free",
				...utmProperties,
				role: userSettings?.role,
				company_name: userSettings?.company_name,
				referral_source: userSettings?.referral_source,
				signup_source: provider === "google" ? "oauth_google" : "email_password",
				$set_once: {
					created_at: new Date().toISOString(),
				},
			},
		})

		// Identify user with person properties
		await posthog.identify({
			distinctId: userId,
			properties: {
				email,
				role: userSettings?.role || "founder",
				company_name: userSettings?.company_name,
				lifecycle_stage: "new_customer",
				...personUtmProperties,
			},
		})

		// Set group analytics for account-level tracking
		if (accountId) {
			await posthog.groupIdentify({
				groupType: "account",
				groupKey: accountId,
				properties: {
					plan: "free",
					seats: 1,
				},
			})
		}

		await posthog.flush()
		consola.log("[LOGIN_SUCCESS] Captured account_signed_up event for user:", userId)
	} catch (error) {
		consola.error("[LOGIN_SUCCESS] Error capturing signup event:", error)
		// Don't throw - signup tracking failure shouldn't block user flow
	}
}

async function resolveInviteRedirect({
	supabase,
	next,
	origin,
}: {
	supabase: SupabaseClient
	next: string
	origin: string
}): Promise<string | null> {
	const tokenFromNext = extractInviteToken(next, origin)
	if (tokenFromNext) {
		const manageUrl = await computeManagePathFromToken({ supabase, token: tokenFromNext })
		if (manageUrl) return manageUrl
	}

	const { data: rawInvites, error } = await supabase.rpc("list_invitations_for_current_user")
	if (error) {
		consola.warn("[LOGIN_SUCCESS] Unable to list invitations for current user:", error.message)
		return null
	}

	let invites: Array<Record<string, unknown>> = []
	if (Array.isArray(rawInvites)) {
		invites = rawInvites as Array<Record<string, unknown>>
	} else if (rawInvites) {
		try {
			const parsed = JSON.parse(String(rawInvites))
			if (Array.isArray(parsed)) invites = parsed as Array<Record<string, unknown>>
		} catch (parseError) {
			consola.warn("[LOGIN_SUCCESS] Failed to parse invitations payload", parseError)
		}
	}

	const firstInviteWithToken = invites.find((inv) => typeof inv?.token === "string")
	if (!firstInviteWithToken) return null

	const token = String(firstInviteWithToken.token)
	return computeManagePathFromToken({ supabase, token })
}

async function computeManagePathFromToken({
	supabase,
	token,
}: {
	supabase: SupabaseClient
	token: string
}): Promise<string | null> {
	const { data: lookupData, error: lookupError } = await supabase.rpc("lookup_invitation", {
		lookup_invitation_token: token,
	})
	if (lookupError) {
		consola.warn("[LOGIN_SUCCESS] lookup_invitation failed for token", lookupError)
		return null
	}

	const lookup = (lookupData as Record<string, unknown> | null) ?? null
	const accountId = (lookup?.account_id as string | undefined) ?? null
	if (!accountId) return null

	return `/a/${accountId}/team/manage?token=${encodeURIComponent(token)}`
}

function extractInviteToken(next: string, origin: string): string | null {
	try {
		const parsed = new URL(next, origin)
		return parsed.searchParams.get("token")
	} catch {
		return null
	}
}

// Default component for cases where loader doesn't redirect immediately
export default function LoginSuccess() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h2 className="font-semibold text-lg">You're in!</h2>
				<p className="text-gray-600">You can now start using the app.</p>
			</div>
		</div>
	)
}
