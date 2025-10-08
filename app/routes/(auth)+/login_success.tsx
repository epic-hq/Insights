import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import type { SupabaseClient } from "~/types"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const next = requestUrl.searchParams.get("next") || "/home"

	const { client: supabase, headers } = getServerClient(request)
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) {
		consola.warn("[LOGIN_SUCCESS] No authenticated user found, redirecting to login")
		return redirect(`/login?next=${encodeURIComponent(next)}`)
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

	const firstInviteWithToken = invites.find((inv) => typeof inv?.["token"] === "string")
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
	const accountId = (lookup?.["account_id"] as string | undefined) ?? null
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
