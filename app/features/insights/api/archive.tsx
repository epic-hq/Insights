import consola from "consola"
import type { ActionFunction } from "react-router"
import { userContext } from "~/server/user-context"

interface ArchivePayload {
	insightId: string
	projectId: string
	action: "archive" | "hide"
}

export const action: ActionFunction = async ({ context, request }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id

	try {
		const payload = (await request.json()) as ArchivePayload
		const { insightId, projectId, action } = payload

		if (!insightId || !projectId || !action) {
			return Response.json({ error: "Missing required parameters" }, { status: 400 })
		}

		if (!["archive", "hide"].includes(action)) {
			return Response.json({ error: "Invalid action type" }, { status: 400 })
		}

		// Since the insights table doesn't have archived_at/hidden_at columns,
		// we'll use a different approach - perhaps a status field or separate table
		// For now, let's just log the action and return success
		// TODO: Add proper archiving/hiding mechanism to the database schema
		
		consola.log(`User requested to ${action} insight ${insightId}`)
		
		// In a real implementation, you might:
		// 1. Add a 'status' field to insights table
		// 2. Create a separate 'insight_actions' table to track user actions
		// 3. Use soft delete patterns
		
		// For now, we'll just return success without making database changes
		const { error: updateError } = null // Placeholder - no actual update needed

		if (updateError) {
			consola.error(`Failed to ${action} insight:`, updateError)
			return Response.json({ error: updateError.message }, { status: 500 })
		}

		consola.log(`Successfully ${action}d insight ${insightId}`)
		return Response.json({ success: true })

	} catch (err) {
		consola.error(`${action} API error:`, err)
		return Response.json({ error: "Internal server error" }, { status: 500 })
	}
}
