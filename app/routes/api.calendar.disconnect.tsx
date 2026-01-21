/**
 * Calendar Disconnect API
 *
 * POST /api/calendar/disconnect
 * Removes user's calendar connection
 */

import type { ActionFunctionArgs } from "react-router";
import consola from "consola";
import {
  deleteCalendarConnection,
  getCalendarConnection,
} from "~/lib/integrations/calendar.server";
import { revokeConnection } from "~/lib/integrations/pica.server";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const userId = ctx.claims?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const provider =
    (formData.get("provider") as "google" | "outlook") || "google";

  try {
    // Get existing connection to revoke tokens
    const connection = await getCalendarConnection(
      ctx.supabase,
      userId,
      provider,
    );

    if (connection) {
      // Revoke tokens with Pica (best effort)
      try {
        await revokeConnection(connection.access_token);
      } catch (err) {
        consola.warn("[calendar] Failed to revoke tokens:", err);
        // Continue anyway - we'll delete from our DB
      }

      // Delete from database
      await deleteCalendarConnection(ctx.supabase, userId, provider);
    }

    return Response.json({ success: true });
  } catch (error) {
    consola.error("[calendar] Failed to disconnect:", error);
    return Response.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 },
    );
  }
}
