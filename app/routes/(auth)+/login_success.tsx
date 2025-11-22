import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { getPostHogServerClient } from "~/lib/posthog.server"
import { getServerClient } from "~/lib/supabase/client.server"
import type { SupabaseClient } from "~/types"
import { generateTwoWordSlug } from "~/utils/random-name"
import { createProjectRoutes } from "~/utils/routes.server"
import type { UtmParams } from "~/utils/utm"
import { clearUtmCookie, collectPersistedUtmParams, extractUtmParamsFromRequest } from "~/utils/utm.server"

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

	const shouldUseLastUsed = isDefaultHomeDestination(next, requestUrl.origin)
	let destination = inviteRedirect ?? next

	if (isNewUser && !inviteRedirect && shouldUseLastUsed) {
		const defaultProjectPath = await ensureDefaultAccountAndProject({ supabase, userId: user.id })
		if (defaultProjectPath) {
			destination = defaultProjectPath
		}
	} else if (!inviteRedirect && shouldUseLastUsed) {
		const lastUsedPath = await resolveLastUsedProjectRedirect({ supabase, userId: user.id })
		if (lastUsedPath) {
			destination = lastUsedPath
		}
	}

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

type AccountWithProjects = {
	account_id: string
	personal_account?: boolean | null
	projects?: Array<{
		id: string
	}>
}

async function ensureDefaultAccountAndProject({
	supabase,
	userId,
}: {
	supabase: SupabaseClient
	userId: string
}): Promise<string | null> {
	try {
		const { data: rawAccounts, error: accountsError } = await supabase.rpc("get_user_accounts")
		if (accountsError) {
			consola.warn("[LOGIN_SUCCESS] Failed to load user accounts for default selection:", accountsError.message)
			return null
		}

		const accounts: AccountWithProjects[] = Array.isArray(rawAccounts) ? (rawAccounts as AccountWithProjects[]) : []
		if (accounts.length === 0) {
			consola.warn("[LOGIN_SUCCESS] No accounts available for new user when ensuring default account/project")
			return null
		}

		// Prefer non-personal account when available, otherwise first account
		const currentAccount = accounts.find((acc) => acc.personal_account === false) ?? accounts[0]
		const accountId = currentAccount.account_id
		const projects = Array.isArray(currentAccount.projects) ? currentAccount.projects : []

		let projectId: string | null = null

		if (projects.length > 0) {
			projectId = projects[0]?.id ?? null
		} else {
			// Auto-create a minimal default project for brand new users
			const defaultName = generateTwoWordSlug()
			const { data: createdProject, error: createError } = await supabase
				.from("projects")
				.insert({
					account_id: accountId,
					name: defaultName,
					status: "planning",
				})
				.select("id")
				.single()

			if (createError || !createdProject) {
				consola.error("[LOGIN_SUCCESS] Failed to auto-create default project for new user:", createError)
				return null
			}

			projectId = createdProject.id
		}

		if (!projectId) {
			return null
		}

		// Persist last-used account/project for this user to align sidebar and future redirects
		const { error: settingsError } = await supabase.from("user_settings").upsert(
			{
				user_id: userId,
				last_used_account_id: accountId,
				last_used_project_id: projectId,
			},
			{ onConflict: "user_id" }
		)

		if (settingsError) {
			consola.warn("[LOGIN_SUCCESS] Failed to persist default account/project in user_settings:", settingsError.message)
		}

		const projectRoutes = createProjectRoutes(accountId, projectId)
		return projectRoutes.projects.setup()
	} catch (error) {
		consola.warn("[LOGIN_SUCCESS] Error ensuring default account/project:", error)
		return null
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
		const { data: rawAccounts } = await supabase.rpc("get_user_accounts")
		const accounts: AccountWithProjects[] = Array.isArray(rawAccounts) ? (rawAccounts as AccountWithProjects[]) : []
		const accountId = accounts.length > 0 ? accounts[0].account_id : undefined

		// Get user settings for additional context
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("role, company_name, referral_source, signup_data")
			.eq("user_id", userId)
			.single()

		const rawProvider = metadata?.provider
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
		return parsed.searchParams.get("invite_token")
	} catch {
		return null
	}
}

function isDefaultHomeDestination(next: string, origin: string): boolean {
	try {
		const parsed = new URL(next, origin)
		return parsed.pathname === "/home"
	} catch {
		return next === "/home"
	}
}

async function resolveLastUsedProjectRedirect({
	supabase,
	userId,
}: {
	supabase: SupabaseClient
	userId: string
}): Promise<string | null> {
	try {
		const { data: settings, error } = await supabase
			.from("user_settings")
			.select("last_used_account_id, last_used_project_id")
			.eq("user_id", userId)
			.single()

		if (error) {
			consola.warn("[LOGIN_SUCCESS] Failed to resolve user_settings for redirect:", error.message)
			return null
		}

		const accountId = settings?.last_used_account_id
		const projectId = settings?.last_used_project_id

		// If no last_used preferences, try to set defaults from available accounts/projects
		if (!accountId || !projectId) {
			consola.log("[LOGIN_SUCCESS] No last_used preferences, attempting to set defaults")
			return await ensureDefaultAccountAndProject({ supabase, userId })
		}

		const { data: project, error: projectError } = await supabase
			.from("projects")
			.select("id")
			.eq("id", projectId)
			.eq("account_id", accountId)
			.single()

		if (projectError || !project) {
			consola.warn("[LOGIN_SUCCESS] Last used project unavailable, setting new defaults", {
				accountId,
				projectId,
				error: projectError?.message,
			})
			return await ensureDefaultAccountAndProject({ supabase, userId })
		}

		return `/a/${accountId}/${project.id}`
	} catch (error) {
		consola.warn("[LOGIN_SUCCESS] Error resolving last used redirect:", error)
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
