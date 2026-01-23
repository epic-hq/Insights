/**
 * Calendar Connection API - Initiate OAuth flow
 *
 * POST /api/calendar/connect
 * Redirects user to Google Calendar OAuth authorization
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import type { PlanId } from "~/config/plans";
import { hasFeature, PLANS } from "~/config/plans";
import {
  getGoogleCalendarAuthUrl,
  isPicaConfigured,
} from "~/lib/integrations/pica.server";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

/**
 * GET requests should redirect - this endpoint requires POST with accountId
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect GET requests back to home - this is a POST-only endpoint
  return redirect("/home");
}

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

  // Check if user's plan allows calendar sync (query billing_subscriptions as source of truth)
  const { data: subscription } = await supabaseAdmin
    .schema("accounts")
    .from("billing_subscriptions")
    .select("plan_name, status")
    .eq("account_id", accountId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let planId: PlanId = "free";
  if (subscription?.plan_name) {
    const normalizedPlan = subscription.plan_name.toLowerCase() as PlanId;
    if (normalizedPlan in PLANS) {
      planId = normalizedPlan;
    }
  }

  if (!hasFeature(planId, "calendar_sync")) {
    return Response.json(
      { error: "Calendar sync requires a paid plan" },
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
