/**
 * Save Gmail Connection
 *
 * POST /api/gmail/save-connection
 * Saves a Pica Gmail connection to our database after AuthKit flow completes.
 * Pattern matches api.calendar.save-connection.tsx
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { upsertGmailConnection } from "~/lib/integrations/gmail.server";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const userId = ctx?.claims?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const connectionId = formData.get("connectionId") as string;
  const connectionKey = formData.get("connectionKey") as string;
  const accountId = formData.get("accountId") as string;
  const email = formData.get("email") as string | null;

  if (!connectionId || !connectionKey || !accountId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const connection = await upsertGmailConnection(ctx.supabase, {
      user_id: userId,
      account_id: accountId,
      pica_connection_id: connectionId,
      pica_connection_key: connectionKey,
      email,
    });

    consola.info("[gmail] Connection saved via Pica AuthKit", {
      userId,
      accountId,
      connectionId: connection.id,
    });

    return Response.json({
      success: true,
      connectionId: connection.id,
      email: connection.email,
    });
  } catch (error) {
    consola.error("[gmail] Error saving connection:", error);
    return Response.json(
      { error: "Failed to save connection" },
      { status: 500 },
    );
  }
}
