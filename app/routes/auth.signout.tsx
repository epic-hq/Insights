import type { ActionFunctionArgs } from "react-router"
import { redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

/**
 * Server action to handle user sign out
 * Clears the session cookies and redirects to auth page
 */
export async function action({ request }: ActionFunctionArgs) {
	const response = new Response()
	const supabase = getServerClient(request)

	try {
		// Sign out the user server-side
		const { error } = await supabase.client.auth.signOut()

		if (error) {
			// Log error for debugging but continue with redirect
			// Even if there's an error, we should still redirect to clear client state
		}

		// Clear any remaining auth cookies by setting them to expire
		response.headers.append(
			"Set-Cookie",
			"sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
		)
		response.headers.append(
			"Set-Cookie",
			"sb-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
		)

		// Redirect to auth page
		return redirect("/login", {
			headers: response.headers,
		})
	} catch {
		// Handle signOut action error gracefully
		// Always redirect to auth page even if signOut fails
		return redirect("/login", {
			headers: response.headers,
		})
	}
}
