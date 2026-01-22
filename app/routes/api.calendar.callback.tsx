/**
 * Calendar OAuth Callback
 *
 * GET /api/calendar/callback
 * Handles OAuth callback from Google Calendar via Pica
 */

import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { upsertCalendarConnection } from "~/lib/integrations/calendar.server";
import { exchangeCodeForTokens } from "~/lib/integrations/pica.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { syncCalendarTask } from "src/trigger/calendar";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Helper to build settings redirect with optional accountId
  const settingsRedirect = (accountId: string | null, errorCode: string) => {
    if (accountId) {
      return redirect(`/a/${accountId}/settings?calendar_error=${errorCode}`);
    }
    return redirect(`/home?calendar_error=${errorCode}`);
  };

  // Try to parse state early to get accountId for error redirects
  let parsedState: { user_id?: string; account_id?: string } | null = null;
  if (stateParam) {
    try {
      parsedState = JSON.parse(stateParam);
    } catch {
      // Will handle below
    }
  }
  const accountIdFromState = parsedState?.account_id || null;

  // Handle OAuth errors
  if (error) {
    consola.error("[calendar] OAuth error:", error);
    return settingsRedirect(accountIdFromState, "oauth_denied");
  }

  if (!code || !stateParam) {
    consola.error("[calendar] Missing code or state");
    return settingsRedirect(accountIdFromState, "invalid_callback");
  }

  if (!parsedState) {
    consola.error("[calendar] Invalid state param");
    return settingsRedirect(null, "invalid_state");
  }

  const { user_id: userId, account_id: accountId } = parsedState;

  if (!userId || !accountId) {
    consola.error("[calendar] Missing user_id or account_id in state");
    return settingsRedirect(accountIdFromState, "invalid_state");
  }

  // Build redirect URI (must match what was used in authorization)
  const redirectUri = `${url.origin}/api/calendar/callback`;

  const supabase = createSupabaseAdminClient();

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
    });

    // Save connection to database (using admin client since we don't have user session in callback)
    const connection = await upsertCalendarConnection(supabase, {
      user_id: userId,
      account_id: accountId,
      provider: "google",
      provider_account_id: tokens.provider_account_id,
      provider_email: tokens.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expires_at,
    });

    consola.info("[calendar] Connection established", {
      userId,
      accountId,
      email: tokens.email,
    });

    // Trigger initial calendar sync in background
    try {
      await syncCalendarTask.trigger({
        connectionId: connection.id,
        daysAhead: 14,
        daysBehind: 1,
      });
      consola.info("[calendar] Initial sync triggered", {
        connectionId: connection.id,
      });
    } catch (syncErr) {
      // Don't fail the callback if sync trigger fails
      consola.warn("[calendar] Failed to trigger initial sync:", syncErr);
    }

    // Redirect back to settings with success
    return redirect(`/a/${accountId}/settings?calendar_connected=1`);
  } catch (err) {
    consola.error("[calendar] Failed to complete OAuth:", err);
    return redirect(`/a/${accountId}/settings?calendar_error=token_exchange`);
  }
}
