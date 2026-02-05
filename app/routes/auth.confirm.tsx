import type { EmailOtpType } from "@supabase/supabase-js"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { createClient } from "~/lib/supabase/client.server"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const token_hash = requestUrl.searchParams.get("token_hash")
	const type = requestUrl.searchParams.get("type") as EmailOtpType | null
	const _next = requestUrl.searchParams.get("next")
	const next = _next?.startsWith("/") ? _next : "/"

	// Handle Supabase error redirects (e.g., expired links)
	const error = requestUrl.searchParams.get("error")
	const errorCode = requestUrl.searchParams.get("error_code")
	const errorDescription = requestUrl.searchParams.get("error_description")

	if (error || errorCode) {
		const params = new URLSearchParams()
		if (errorCode) params.set("code", errorCode)
		if (errorDescription) params.set("description", errorDescription)
		if (error) params.set("error", error)
		return redirect(`/auth/error?${params.toString()}`)
	}

	if (token_hash && type) {
		const { supabase, headers } = createClient(request)
		const { error } = await supabase.auth.verifyOtp({
			type,
			token_hash,
		})
		if (!error) {
			return redirect(next, { headers })
		}
		return redirect(`/auth/error?error=${encodeURIComponent(error?.message)}`)
	}

	// redirect the user to an error page with some instructions
	return redirect("/auth/error?error=missing_token")
}
