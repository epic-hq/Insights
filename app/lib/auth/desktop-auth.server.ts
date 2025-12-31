import { getRlsClient } from "~/lib/supabase/client.server"

/**
 * Authenticates desktop requests using Bearer token auth.
 * Desktop app stores the user's JWT and sends it in Authorization header.
 * Returns the authenticated Supabase client and user, or null if invalid.
 */
export async function authenticateDesktopRequest(request: Request) {
	const authHeader = request.headers.get("Authorization")
	if (!authHeader?.startsWith("Bearer ")) {
		return null
	}

	const jwt = authHeader.slice(7)
	const supabase = getRlsClient(jwt)

	try {
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser()
		if (error || !user) {
			return null
		}
		return { supabase, user }
	} catch {
		return null
	}
}
