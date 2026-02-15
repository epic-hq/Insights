/**
 * Save Gmail Connection
 *
 * POST /api/gmail/save-connection
 * Saves a Pica Gmail connection to our database after AuthKit flow completes.
 * Fetches the real Gmail email via Pica passthrough profile endpoint,
 * falls back to the user's Supabase auth email.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { upsertGmailConnection } from "~/lib/integrations/gmail.server";
import { GMAIL_ACTIONS, picaPassthrough } from "~/lib/integrations/pica.server";
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

  if (!connectionKey || !accountId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Get email via Pica passthrough (Gmail API profile)
    let gmailEmail: string | null = null;
    try {
      const profile = await picaPassthrough<{ emailAddress: string }>(
        connectionKey,
        "gmail",
        {
          method: "GET",
          path: "users/me/profile",
          actionId: GMAIL_ACTIONS.GET_PROFILE,
        },
      );
      gmailEmail = profile.data?.emailAddress ?? null;
      if (gmailEmail) {
        consola.info("[gmail] Got email from Gmail profile:", gmailEmail);
      }
    } catch {
      consola.debug("[gmail] Gmail profile passthrough failed");
    }

    // Fallback: use the user's auth email from Supabase session
    if (!gmailEmail) {
      gmailEmail = ctx.user_metadata?.email ?? null;
      if (gmailEmail) {
        consola.info("[gmail] Using auth email as fallback:", gmailEmail);
      }
    }

    const connection = await upsertGmailConnection(ctx.supabase!, {
      user_id: userId,
      account_id: accountId,
      pica_connection_id: connectionId || connectionKey,
      pica_connection_key: connectionKey,
      email: gmailEmail,
    });

    consola.info("[gmail] Connection saved via Pica AuthKit", {
      userId,
      accountId,
      connectionId: connection.id,
      email: gmailEmail,
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
