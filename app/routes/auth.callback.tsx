import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get("code")
	const next = requestUrl.searchParams.get("next") || "/dashboard"
	// const headers = new Headers()

	if (code) {
		const { client: supabase, headers } = getServerClient(request)
		consola.log("[AUTH CALLBACK] Exchanging code for session...")
		const { data, error } = await supabase.auth.exchangeCodeForSession(code)

		if (error) {
			consola.error("[AUTH CALLBACK] Exchange error:", error)
		} else {
			consola.log("[AUTH CALLBACK] Exchange successful, user:", data?.user?.email)
			consola.log("[AUTH CALLBACK] Redirecting to:", next)
			// Successfully authenticated, redirect to dashboard
			return redirect(next, { headers })
		}
	}

	consola.log("[AUTH CALLBACK] No code or error occurred, redirecting to login")
	// If no code or error, redirect back to login with error message
	return redirect("/login?error=auth_failed")
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

// import { redirect } from "react-router"
// import type { Route } from "./+types/auth.callback"
// import { getServerClient } from "~/lib/supabase/server"
// import { PATHS } from "~/paths"

// export async function loader({ request }: Route.LoaderArgs) {
// 	const url = new URL(request.url)
// 	const code = url.searchParams.get("code")

// 	if (code) {
// 		const { client: supabase } = getServerClient(request)

// 		// Exchange the code for a session
// 		const { error } = await supabase.auth.exchangeCodeForSession(code)

// 		if (!error) {
// 			// Successfully authenticated, redirect to dashboard
// 			return redirect(PATHS.DASHBOARD)
// 		}
// 	}

// 	// If no code or error, redirect to login
// 	return redirect("/login")
// }

// export default function AuthCallback() {
// 	return (
// 		<div className="flex h-screen items-center justify-center">
// 			<div className="text-center">
// 				<h2 className="text-lg font-semibold">Completing sign in...</h2>
// 				<p className="text-gray-600">Please wait while we redirect you.</p>
// 			</div>
// 		</div>
// 	)
// }
