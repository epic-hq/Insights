import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr"
import { type LoaderFunctionArgs, redirect } from "react-router"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get("code")
	const next = requestUrl.searchParams.get("next") || "/"
	const headers = new Headers()

	if (code) {
		const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
			cookies: {
				getAll() {
					return parseCookieHeader(request.headers.get("Cookie") ?? "")
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) =>
						headers.append("Set-Cookie", serializeCookieHeader(name, value, options))
					)
				},
			},
		})

		const { error } = await supabase.auth.exchangeCodeForSession(code)

		if (!error) {
			return redirect(next, { headers })
		}
	}

	// return the user to an error page with instructions
	return redirect("/auth/auth-code-error", { headers })
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
