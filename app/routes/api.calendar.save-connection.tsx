/**
 * Save Pica Connection
 *
 * POST /api/calendar/save-connection
 * Saves a Pica connection to our database after AuthKit flow completes.
 */

import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"

export async function action({ context, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const userId = ctx?.claims?.sub

	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const formData = await request.formData()
	const connectionId = formData.get("connectionId") as string
	const connectionKey = formData.get("connectionKey") as string
	const platform = formData.get("platform") as string
	const accountId = formData.get("accountId") as string

	if (!connectionId || !connectionKey || !platform || !accountId) {
		return Response.json({ error: "Missing required fields" }, { status: 400 })
	}

	try {
		// Map Pica platform names to our provider names
		const providerMap: Record<string, string> = {
			"google-calendar": "google",
			"microsoft-outlook": "outlook",
			google_calendar: "google",
			outlook: "outlook",
		}

		const provider = providerMap[platform] || platform

		// Upsert the connection
		const { data, error } = await ctx.supabase
			.from("calendar_connections")
			.upsert(
				{
					user_id: userId,
					account_id: accountId,
					provider,
					pica_connection_id: connectionId,
					pica_connection_key: connectionKey,
					sync_enabled: true,
					sync_error: null,
				},
				{
					onConflict: "user_id,provider",
				}
			)
			.select()
			.single()

		if (error) {
			consola.error("[calendar] Failed to save connection:", error)
			return Response.json({ error: "Failed to save connection" }, { status: 500 })
		}

		consola.info("[calendar] Connection saved via Pica AuthKit", {
			userId,
			accountId,
			platform,
			connectionId: data.id,
		})

		return Response.json({
			success: true,
			connectionId: data.id,
		})
	} catch (error) {
		consola.error("[calendar] Error saving connection:", error)
		return Response.json({ error: "Failed to save connection" }, { status: 500 })
	}
}
