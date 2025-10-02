// The client you created from the Server-Side Auth instructions

import { redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader(request: Request) {
	const { searchParams, origin } = new URL(request.url)
	const code = searchParams.get("code")
	// if "next" is in param, use it as the redirect URL
	let next = searchParams.get("next") ?? "/"
	if (!next.startsWith("/")) {
		// if "next" is not a relative URL, use the default
		next = "/"
	}

	if (code) {
		const supabase = getServerClient(request)
		const { error } = await supabase.client.auth.exchangeCodeForSession(code)
		if (!error) {
			const forwardedHost = request.headers.get("x-forwarded-host") // original origin before load balancer
			const isLocalEnv = process.env.NODE_ENV === "development"
			if (isLocalEnv) {
				// we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
				return redirect(`${origin}${next}`)
			}
			if (forwardedHost) {
				return redirect(`https://${forwardedHost}${next}`)
			}
			return redirect(`${origin}${next}`)
		}
	}

	// return the user to an error page with instructions
	return redirect(`${origin}/auth/error`)
}
