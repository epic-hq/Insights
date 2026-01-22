/**
 * Welcome Upgrade Page
 *
 * Shown after a successful plan upgrade via Polar checkout.
 * Focuses on activating the user with calendar connection.
 */

import consola from "consola";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import { PicaConnectButton } from "~/components/integrations/PicaConnectButton";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { hasFeature, PLANS, type PlanId } from "~/config/plans";
import { getCalendarConnection } from "~/lib/integrations/calendar.server";
import { userContext } from "~/server/user-context";

type LoaderData = {
  planName: string;
  accountId: string;
  userId: string;
  hasCalendarFeature: boolean;
  calendarAlreadyConnected: boolean;
};

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const userId = ctx?.claims?.sub;

  if (!userId) {
    return redirect("/login");
  }

  const accountId = params.accountId;
  if (!accountId) {
    return redirect("/home");
  }

  const url = new URL(request.url);
  const planParam = url.searchParams.get("plan") as PlanId | null;
  const planId: PlanId = planParam && PLANS[planParam] ? planParam : "starter";
  const plan = PLANS[planId];

  let calendarAlreadyConnected = false;

  if (ctx?.supabase && hasFeature(planId, "calendar_sync")) {
    try {
      const connection = await getCalendarConnection(
        ctx.supabase,
        userId,
        "google",
      );
      calendarAlreadyConnected = !!connection;
    } catch (err) {
      // If calendar check fails (e.g., table doesn't exist), just show the CTA
      consola.warn(
        "[welcome-upgrade] Failed to check calendar connection:",
        err,
      );
    }
  }

  return {
    planName: plan.name,
    accountId,
    userId,
    hasCalendarFeature: hasFeature(planId, "calendar_sync"),
    calendarAlreadyConnected,
  };
}

export default function WelcomeUpgradePage() {
  const {
    planName,
    accountId,
    userId,
    hasCalendarFeature,
    calendarAlreadyConnected,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(calendarAlreadyConnected);

  const dashboardUrl = accountId ? `/a/${accountId}/home` : "/home";

  const handleCalendarSuccess = () => {
    setConnected(true);
    // Give time for user to see success, then redirect
    setTimeout(() => navigate(dashboardUrl), 1500);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brief Welcome */}
        <div className="text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mb-1 font-semibold text-2xl">You're on {planName}</h1>
        </div>

        {/* Calendar CTA - Primary focus */}
        {hasCalendarFeature && !connected && (
          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="mb-2 font-semibold text-lg">
                  Prep for every customer call
                </h2>
                <p className="mb-5 text-muted-foreground text-sm">
                  Connect your calendar to get AI briefings before meetings and
                  follow-up drafts after.
                </p>
                <PicaConnectButton
                  userId={userId}
                  accountId={accountId}
                  platform="google-calendar"
                  onSuccess={handleCalendarSuccess}
                  size="lg"
                  className="w-full"
                >
                  Connect Google Calendar
                </PicaConnectButton>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar already connected */}
        {hasCalendarFeature && connected && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm">Calendar connected</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skip to Dashboard */}
        <div className="text-center">
          <Button
            variant={hasCalendarFeature && !connected ? "ghost" : "default"}
            size="lg"
            className="w-full"
            asChild
          >
            <Link to={dashboardUrl}>
              {hasCalendarFeature && !connected
                ? "Skip for now"
                : "Go to Dashboard"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
