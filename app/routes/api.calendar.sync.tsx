/**
 * Calendar Sync API
 *
 * POST /api/calendar/sync
 * Triggers a calendar sync for the current user
 */

import type { ActionFunctionArgs } from "react-router";
import consola from "consola";
import { getCalendarConnection } from "~/lib/integrations/calendar.server";
import { userContext } from "~/server/user-context";
import { syncCalendarTask } from "src/trigger/calendar";

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
    // Get user's calendar connection
    const connection = await getCalendarConnection(
      ctx.supabase,
      userId,
      provider,
    );

    if (!connection) {
      return Response.json(
        { error: "No calendar connection found" },
        { status: 404 },
      );
    }

    // Trigger sync task
    const handle = await syncCalendarTask.trigger({
      connectionId: connection.id,
      daysAhead: 14,
      daysBehind: 1,
    });

    consola.info("[calendar] Sync triggered", {
      userId,
      connectionId: connection.id,
      taskId: handle.id,
    });

    return Response.json({
      success: true,
      taskId: handle.id,
      message: "Calendar sync started",
    });
  } catch (error) {
    consola.error("[calendar] Failed to trigger sync:", error);
    return Response.json(
      { error: "Failed to start calendar sync" },
      { status: 500 },
    );
  }
}
