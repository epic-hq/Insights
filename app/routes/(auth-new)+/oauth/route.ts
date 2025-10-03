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
	if (!next.startsWith("/")) {
		// if "next" is not a relative URL, use the default
		next = "/"
	}
	consola.log(`redirecting to ${next}`)

	if (code) {
		const { client, headers } = getServerClient(request)
		const { error } = await client.auth.exchangeCodeForSession(code)
		if (!error) {
			const forwardedHost = headers.get("x-forwarded-host") // original origin before load balancer
			const isLocalEnv = process.env.NODE_ENV === "development"
			if (isLocalEnv) {
				// we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
				consola.log(`redirecting to ${origin}${next}`)
				return redirect(`${origin}${next}`, { headers })
			}
			if (forwardedHost) {
				return redirect(`https://${forwardedHost}${next}`, { headers })
			}
			return redirect(`${origin}${next}`, { headers })
		}
	}

	// return the user to an error page with instructions
	return redirect(`${origin}/auth/error`)
}
