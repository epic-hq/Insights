import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

/**
 * Server action to handle user sign out
 * Clears the session cookies and redirects to auth page
 */
export async function action({ request }: ActionFunctionArgs) {
	const { client, headers } = getServerClient(request)

	try {
		// Sign out the user server-side
		const { error } = await client.auth.signOut()

		if (error) {
			// Log error for debugging but continue with redirect
			// Even if there's an error, we should still redirect to clear client state
			consola.log('Signout: Error ', error)
		}

		// Redirect to auth page
		return redirect("/login", {
			headers,
		})
	} catch {
		// Handle signOut action error gracefully
		// Always redirect to auth page even if signOut fails
		return redirect("/login", {
			headers,
		})
	}
}
