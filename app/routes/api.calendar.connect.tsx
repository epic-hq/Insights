/**
 * Calendar Connection API - Initiate OAuth flow
 *
 * POST /api/calendar/connect
 * Redirects user to Google Calendar OAuth authorization
 */

import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { hasFeature } from "~/config/plans";
import {
  getGoogleCalendarAuthUrl,
  isPicaConfigured,
} from "~/lib/integrations/pica.server";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const userId = ctx.claims?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get account from form data
  const formData = await request.formData();
  const accountId = formData.get("accountId") as string;

  if (!accountId) {
    return Response.json({ error: "Account ID required" }, { status: 400 });
  }

  // Check if Pica is configured
  if (!isPicaConfigured()) {
    return Response.json(
      { error: "Calendar integration not configured" },
      { status: 503 },
    );
  }

  // Check if user's plan allows calendar sync
  const { data: account } = await ctx.supabase
    .schema("accounts")
    .from("accounts")
    .select("plan_id")
    .eq("id", accountId)
    .single();

  const planId =
    (account?.plan_id as "free" | "starter" | "pro" | "team") || "free";

  if (!hasFeature(planId, "calendar_sync")) {
    return Response.json(
      { error: "Calendar sync requires Pro plan or higher" },
      { status: 403 },
    );
  }

  // Build callback URL
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/calendar/callback`;

  try {
    const authUrl = await getGoogleCalendarAuthUrl({
      userId,
      accountId,
      redirectUri,
    });

    return redirect(authUrl);
  } catch (error) {
    console.error("[calendar] Failed to initiate OAuth:", error);
    return Response.json(
      { error: "Failed to start calendar connection" },
      { status: 500 },
    );
  }
}
