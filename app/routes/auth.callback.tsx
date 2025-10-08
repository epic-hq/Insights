import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get("code")
	const error = requestUrl.searchParams.get("error")
	const next = requestUrl.searchParams.get("next") || "/home"

	consola.log("[AUTH CALLBACK] Received callback with next:", next, "code:", !!code, "error:", error)

	// Handle OAuth error from provider (e.g., user cancelled Google login)
	if (error) {
		consola.error("[AUTH CALLBACK] OAuth error:", error)
		return redirect("/login_failure")
	}

	// Handle OAuth code exchange (for Google, etc.)
	if (code) {
		const { client: supabase, headers } = getServerClient(request)
		consola.log("[AUTH CALLBACK] Exchanging OAuth code for session...")
		const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

		if (exchangeError) {
			consola.error("[AUTH CALLBACK] Exchange error:", exchangeError)
			return redirect("/login_failure")
		}
		const accountId = data?.user?.app_metadata?.claims?.sub || data?.user?.user_metadata?.account_id || data?.user?.id
		consola.log("[AUTH CALLBACK] Exchange successful, user:", data?.user?.email, "accountId:", accountId, "redirecting to:", next)
		const loginSuccessUrl = `/login_success?next=${encodeURIComponent(next)}`
		return redirect(loginSuccessUrl, { headers })
	}

	// Check if user is already authenticated (for email/password direct login)
	const { client: supabase, headers } = getServerClient(request)
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (user) {
		consola.log("[AUTH CALLBACK] User already authenticated, redirecting to:", next)
		const loginSuccessUrl = `/login_success?next=${encodeURIComponent(next)}`
		return redirect(loginSuccessUrl, { headers })
	}

	consola.log("[AUTH CALLBACK] No code, no error, no user - redirecting to login_failure")
	return redirect("/login_failure")
}

// Default component for cases where loader doesn't redirect immediately
export default function AuthCallback() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h2 className="font-semibold text-lg">Completing sign in...</h2>
				<p className="text-gray-600">Please wait while we redirect you.</p>
			</div>
		</div>
	)
}
