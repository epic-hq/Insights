import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { json, redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

/**
 * Receives a client session (access/refresh tokens) and sets server cookies.
 * Use this after email/password sign-in to avoid SSR auth mismatches.
 */
export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase, headers } = getServerClient(request)
		const body = await request.json()

		const access_token = body?.access_token as string | undefined
		const refresh_token = body?.refresh_token as string | undefined

		if (!access_token || !refresh_token) {
			return json({ error: "Missing tokens" }, { status: 400 })
		}

		const { error } = await supabase.auth.setSession({ access_token, refresh_token })
		if (error) {
			consola.error("auth.session setSession error:", error)
			return json({ error: error.message }, { status: 400 })
		}

		// Redirect through login_success to preserve existing flow
		return redirect("/login_success", { headers })
	} catch (err) {
		consola.error("auth.session action error:", err)
		return json({ error: "Internal error" }, { status: 500 })
	}
}

export default function AuthSession() {
	return null
}
