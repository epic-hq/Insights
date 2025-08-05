import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get("code")
	const _next = requestUrl.searchParams.get("next") || "/home"
	// const headers = new Headers()

	if (code) {
		const { client: supabase, headers } = getServerClient(request)
		consola.log("[AUTH CALLBACK] Exchanging code for session...")
		const { data, error } = await supabase.auth.exchangeCodeForSession(code)

		if (error) {
			consola.error("[AUTH CALLBACK] Exchange error:", error)
			return redirect("/login_failure")
		}
		const accountId = data?.user?.app_metadata?.claims?.sub || data?.user?.user_metadata?.account_id || data?.user?.id
		consola.log("[AUTH CALLBACK] Exchange successful, user:", data?.user?.email, "accountId:", accountId)
		const loginSuccessUrl = _next ? `/login_success?next=${encodeURIComponent(_next)}` : "/login_success"
		return redirect(loginSuccessUrl, { headers })
	}
	consola.log("[AUTH CALLBACK] No code or error occurred, redirecting to login_failure")
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
