/**
 * Disconnect Gmail
 *
 * POST /api/gmail/disconnect
 * Removes user's Gmail connection.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { deleteGmailConnection } from "~/lib/integrations/gmail.server";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const userId = ctx?.claims?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const accountId = formData.get("accountId") as string;

  if (!accountId) {
    return Response.json({ error: "Missing accountId" }, { status: 400 });
  }

  try {
    await deleteGmailConnection(ctx.supabase, userId, accountId);

    consola.info("[gmail] Connection disconnected", { userId, accountId });

    return Response.json({ success: true });
  } catch (error) {
    consola.error("[gmail] Error disconnecting:", error);
    return Response.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
