import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"

/**
 * API endpoint to persist user's last used account and project preferences
 * This ensures the sidebar shows the correct project when navigating without URL context
 */
export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase } = await getServerClient(request)

		// Get authenticated user
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return { success: false, error: "Unauthorized" }
		}

		const formData = await request.formData()
		const accountId = formData.get("accountId") as string
		const projectId = formData.get("projectId") as string

		if (!accountId || !projectId) {
			return { success: false, error: "Missing accountId or projectId" }
		}

		// Update user_settings with last used account and project
		const { error } = await supabase
			.from("user_settings")
			.update({
				last_used_account_id: accountId,
				last_used_project_id: projectId,
			})
			.eq("user_id", user.id)

		if (error) {
			consola.error("Failed to update user project preference:", error)
			return { success: false, error: error.message }
		}

		consola.log(`Updated user project preference: account=${accountId}, project=${projectId}`)
		return { success: true }
	} catch (error) {
		consola.error("Error updating user project preference:", error)
		return { success: false, error: "Internal server error" }
	}
}
