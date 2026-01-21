/**
 * Calendar OAuth Callback
 *
 * GET /api/calendar/callback
 * Handles OAuth callback from Google Calendar via Pica
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import consola from "consola";
import { upsertCalendarConnection } from "~/lib/integrations/calendar.server";
import { exchangeCodeForTokens } from "~/lib/integrations/pica.server";
import { supabaseAdmin } from "~/lib/supabase/client.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    consola.error("[calendar] OAuth error:", error);
    return redirect("/settings?calendar_error=oauth_denied");
  }

  if (!code || !stateParam) {
    consola.error("[calendar] Missing code or state");
    return redirect("/settings?calendar_error=invalid_callback");
  }

  // Parse state to get user and account IDs
  let state: { user_id: string; account_id: string };
  try {
    state = JSON.parse(stateParam);
  } catch {
    consola.error("[calendar] Invalid state param");
    return redirect("/settings?calendar_error=invalid_state");
  }

  const { user_id: userId, account_id: accountId } = state;

  if (!userId || !accountId) {
    consola.error("[calendar] Missing user_id or account_id in state");
    return redirect("/settings?calendar_error=invalid_state");
  }

  // Build redirect URI (must match what was used in authorization)
  const redirectUri = `${url.origin}/api/calendar/callback`;

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
    });

    // Save connection to database (using admin client since we don't have user session in callback)
    await upsertCalendarConnection(supabaseAdmin, {
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

    // Redirect back to settings with success
    return redirect(`/a/${accountId}/settings?calendar_connected=1`);
  } catch (err) {
    consola.error("[calendar] Failed to complete OAuth:", err);
    return redirect(`/a/${accountId}/settings?calendar_error=token_exchange`);
  }
}
