import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { acceptInvitation } from "~/features/teams/db"
import { getServerClient } from "~/lib/supabase/client.server"

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const token = url.searchParams.get("token") || null

	consola.log("[ACCEPT INVITE] Received request with token:", token ? "present" : "missing")

	const { client: supabase, headers: supabaseHeaders } = getServerClient(request)

	// Check auth
	const {
		data: { user },
	} = await supabase.auth.getUser()

	// If no user, set a short-lived cookie with the token (if present) and redirect to login with next
	if (!user) {
		const next = token ? `/accept-invite?token=${encodeURIComponent(token)}` : "/accept-invite"
		consola.log("[ACCEPT INVITE] User not authenticated, redirecting to login with next:", next)
		return redirect(`/login?next=${encodeURIComponent(next)}`, { headers: supabaseHeaders })
	}

	consola.log("[ACCEPT INVITE] User authenticated:", user.email, "proceeding with token:", token)

	// User is authenticated; token must be present in URL

	if (!token) {
		consola.warn("[ACCEPT INVITE] No invitation token found. Redirecting to /home")
		return redirect("/home", { headers: supabaseHeaders })
	}

	// Lookup invitation first to provide better errors
	const { data: lookup, error: lookupError } = await supabase.rpc("lookup_invitation", {
		lookup_invitation_token: token,
	})

	if (lookupError) {
		consola.error("[ACCEPT INVITE] lookup_invitation error:", lookupError)
	}

	const isActive = Boolean((lookup as Record<string, unknown> | null | undefined)?.active)
	if (!isActive) {
		consola.warn("[ACCEPT INVITE] Invitation inactive or expired")
		// Could render a page here. Minimal behavior: send home.
		return redirect("/home", { headers: supabaseHeaders })
	}

	// Accept invitation
	const { data: accepted, error: acceptError } = await acceptInvitation({
		supabase,
		lookup_invitation_token: token,
	})

	let destination = "/home"

	if (acceptError) {
		// If already a member, proceed to destination anyway
		const msg = acceptError.message || ""
		consola.warn("[ACCEPT INVITE] accept_invitation error:", msg)
		// Continue, destination remains default
	} else if (accepted && (accepted.slug || accepted.account_id)) {
		const slug = accepted?.slug
		const account_id = accepted?.account_id
		if (slug) destination = `/a/${slug}`
		else if (account_id) destination = `/a/${account_id}`
	}

	return redirect(destination, { headers: supabaseHeaders })
}

export default function AcceptInvite() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h2 className="font-semibold text-lg">Accepting your invitation…</h2>
				<p className="text-gray-600">Please wait while we complete the process.</p>
			</div>
		</div>
	)
}
