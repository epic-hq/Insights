// The client you created from the Server-Side Auth instructions

import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	consola.log(`oauth loader request: ${request.url}`)
	const { searchParams, origin } = new URL(request.url)
	const code = searchParams.get("code")
	// if "next" is in param, use it as the redirect URL
	let next = searchParams.get("next") ?? "/"
	const invite_token = searchParams.get("invite_token")

	if (!next.startsWith("/")) {
		// if "next" is not a relative URL, use the default
		next = "/"
	}
	consola.log(`redirecting to ${next}`)

	if (code) {
		const { client, headers } = getServerClient(request)
		const { error } = await client.auth.exchangeCodeForSession(code)
		consola.log(`exchangeCodeForSession error: ${error}`)
		if (!error) {
			// Prefer original host if behind a proxy, otherwise use relative redirect in dev
			const forwardedHost = request.headers.get("x-forwarded-host")
			const isLocalEnv = process.env.NODE_ENV === "development"
			const suffix = invite_token ? `?invite_token=${invite_token}` : ""
			if (isLocalEnv) {
				// Relative redirect avoids any subtle cross-origin handling in dev and preserves Set-Cookie
				consola.log(`redirecting to (relative) ${next}${suffix}`)
				return redirect(`${next}${suffix}`, { headers })
			}
			if (forwardedHost) {
				return redirect(`https://${forwardedHost}${next}${suffix}`, { headers })
			}
			return redirect(`${origin}${next}${suffix}`, { headers })
		}
	}

	// return the user to an error page with instructions
	return redirect(`${origin}/auth/error`)
}
