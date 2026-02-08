/**
 * Calendar Disconnect API
 *
 * POST /api/calendar/disconnect
 * Removes user's calendar connection from the database.
 * Token revocation is handled by Pica automatically when connections expire.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { deleteCalendarConnection } from "~/lib/integrations/calendar.server";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const userId = ctx.claims?.sub;

	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const formData = await request.formData();
	const provider = (formData.get("provider") as "google" | "outlook") || "google";

	try {
		// Delete connection from database
		// Token revocation is handled automatically by Pica when the connection is no longer used
		await deleteCalendarConnection(ctx.supabase, userId, provider);

		consola.info("[calendar] Connection deleted", { userId, provider });
		return Response.json({ success: true });
	} catch (error) {
		consola.error("[calendar] Failed to disconnect:", error);
		return Response.json({ error: "Failed to disconnect calendar" }, { status: 500 });
	}
}
