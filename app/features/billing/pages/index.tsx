/**
 * Billing Page
 *
 * Displays current subscription status and plan comparison for upgrades.
 * Uses PLANS config as single source of truth for plan data.
 */

import consola from "consola";
import {
  Calendar,
  Check,
  CheckCircle,
  CreditCard,
  Users,
  X,
} from "lucide-react";
import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { PLANS, type PlanId } from "~/config/plans";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;
  const accountId = params.accountId;

  if (!supabase) {
    throw new Response("Database connection unavailable", { status: 500 });
  }
  if (!accountId) {
    throw new Response("Account ID is required", { status: 400 });
  }

  // Get account info
  const { data: account } = await supabase
    .from("account_members")
    .select("account_id, role, accounts(name)")
    .eq("account_id", accountId)
    .single();

  // Get current plan from billing_subscriptions (single source of truth)
  let currentPlan: PlanId = "free";
  const { data: subscription, error: subError } = await supabaseAdmin
    .schema("accounts")
    .from("billing_subscriptions")
    .select("plan_name, status, current_period_end")
    .eq("account_id", accountId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  consola.info("[billing] Subscription query", {
    accountId,
    subscription,
    error: subError?.message,
  });

  if (subscription?.plan_name) {
    const planKey = subscription.plan_name.toLowerCase() as PlanId;
    if (planKey in PLANS) {
      currentPlan = planKey;
    }
  }

  // Check if Polar customer exists (needed for "Manage Subscription" button)
  const { data: billingCustomer } = await supabaseAdmin
    .schema("accounts")
    .from("billing_customers")
    .select("id")
    .eq("account_id", accountId)
    .eq("provider", "polar")
    .maybeSingle();

  // Format renewal date if available
  let renewalDate: string | null = null;
  if (subscription?.current_period_end) {
    renewalDate = new Date(subscription.current_period_end).toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    );
  }

  // Track billing_page_viewed event for PLG instrumentation
  try {
    const posthogServer = getPostHogServerClient();
    if (posthogServer) {
      const userId = ctx.claims.sub;
      posthogServer.capture({
        distinctId: userId,
        event: "billing_page_viewed",
        properties: {
          account_id: accountId,
          current_plan: currentPlan,
          has_active_subscription: !!subscription,
          subscription_status: subscription?.status || null,
          $groups: { account: accountId },
        },
      });
    }
  } catch (trackingError) {
    consola.warn("[BILLING_PAGE] PostHog tracking failed:", trackingError);
  }

  return {
    currentPlan,
    accountName:
      (account?.accounts as { name?: string })?.name ?? "Your Account",
    renewalDate,
    hasBillingCustomer: !!billingCustomer,
  };
}

// Feature display names for the comparison table
const FEATURE_LABELS: Record<string, string> = {
  ai_analyses: "AI Analyses",
  voice_minutes: "Voice Chat",
  survey_responses: "Survey Responses",
  projects: "Projects",
  interview_guide: "Interview Guide",
  smart_personas: "Smart Personas",
  ai_crm: "AI CRM",
  calendar_sync: "Calendar Sync",
  team_workspace: "Team Workspace",
  sso: "SSO / SAML",
  white_label: "White Label",
};

export default function BillingPage() {
  const { currentPlan, accountName, renewalDate, hasBillingCustomer } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const plan = PLANS[currentPlan];

  // Show success toast after checkout
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      const planName = searchParams.get("plan");
      toast.success("Welcome to UpSight!", {
        description: planName
          ? `You're now on the ${planName.charAt(0).toUpperCase() + planName.slice(1)} plan.`
          : "Your subscription is now active.",
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      });
      searchParams.delete("checkout");
      searchParams.delete("plan");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Show error toast for billing errors
  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;

    const errorMessages: Record<
      string,
      { title: string; description: string }
    > = {
      billing_not_configured: {
        title: "Billing unavailable",
        description:
          "Payment system is not configured. Please contact support.",
      },
      no_subscription: {
        title: "Complete your subscription",
        description: "Select a plan below to activate billing.",
      },
      checkout_failed: {
        title: "Checkout failed",
        description: "Unable to start checkout. Please try again.",
      },
      invalid_plan: {
        title: "Invalid plan",
        description: "The selected plan is not available.",
      },
    };

    const msg = errorMessages[error] || {
      title: "Something went wrong",
      description: "Please try again or contact support.",
    };

    toast.error(msg.title, { description: msg.description });
    searchParams.delete("error");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Format limit value for display
  const formatLimit = (value: number, suffix?: string): string => {
    if (value === Number.POSITIVE_INFINITY) return "Unlimited";
    if (value === 0) return "—";
    return suffix
      ? `${value.toLocaleString()} ${suffix}`
      : value.toLocaleString();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription for {accountName}.
        </p>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Current Plan
              <Badge variant={currentPlan === "free" ? "secondary" : "default"}>
                {plan.name}
              </Badge>
            </CardTitle>
            <CardDescription>
              {currentPlan === "free" ? (
                "You're on the free tier. Upgrade to unlock more features."
              ) : renewalDate ? (
                <>Next billing date: {renewalDate}</>
              ) : (
                "Active subscription"
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="font-bold text-3xl">
              ${plan.price.monthly}
              {plan.price.monthly > 0 && (
                <span className="font-normal text-muted-foreground text-sm">
                  /mo
                </span>
              )}
            </div>
            {plan.perUser && (
              <p className="text-muted-foreground text-sm">per user</p>
            )}
          </div>
        </CardHeader>
        {hasBillingCustomer && (
          <CardFooter>
            <Button variant="outline" asChild>
              <Link to="/api/billing/portal">
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscription
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      <Separator />

      {/* Compare Plans */}
      <div className="space-y-4">
        <h2 className="font-semibold text-xl">Compare Plans</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(
            ([key, p]) => {
              const isCurrent = key === currentPlan;
              const isHighlighted = p.badge === "Most Popular";

              return (
                <Card
                  key={key}
                  className={`relative ${isCurrent ? "border-primary ring-1 ring-primary" : ""} ${isHighlighted && !isCurrent ? "border-amber-500/50" : ""}`}
                >
                  {/* Badge */}
                  {p.badge && !isCurrent && (
                    <div className="-top-3 -translate-x-1/2 absolute left-1/2">
                      <span className="whitespace-nowrap rounded-full bg-amber-500 px-3 py-1 font-semibold text-stone-900 text-xs">
                        {p.badge}
                      </span>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      {isCurrent && <Badge variant="outline">Current</Badge>}
                    </div>
                    <CardDescription className="text-xs">
                      {p.description}
                    </CardDescription>
                    <div className="pt-2">
                      <span className="font-bold text-2xl">
                        ${p.price.monthly}
                      </span>
                      {p.price.monthly > 0 && (
                        <span className="text-muted-foreground text-sm">
                          /mo
                        </span>
                      )}
                      {p.perUser && (
                        <span className="text-muted-foreground text-sm">
                          {" "}
                          per user
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0 text-sm">
                    {/* Limits */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          AI Analyses
                        </span>
                        <span className="font-medium">
                          {formatLimit(p.limits.ai_analyses)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Voice Chat
                        </span>
                        <span className="font-medium">
                          {formatLimit(p.limits.voice_minutes, "min")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Surveys</span>
                        <span className="font-medium">
                          {formatLimit(p.limits.survey_responses)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projects</span>
                        <span className="font-medium">
                          {formatLimit(p.limits.projects)}
                        </span>
                      </div>
                    </div>

                    {/* Key Features */}
                    <div className="space-y-1 border-muted border-t pt-2">
                      {(
                        [
                          "smart_personas",
                          "calendar_sync",
                          "team_workspace",
                          "sso",
                        ] as const
                      ).map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          {p.features[feature] ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                          <span
                            className={
                              p.features[feature]
                                ? ""
                                : "text-muted-foreground/50"
                            }
                          >
                            {FEATURE_LABELS[feature]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter>
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : p.cta.external ? (
                      <Button variant="outline" className="w-full" asChild>
                        <a
                          href={p.cta.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Users className="mr-2 h-4 w-4" />
                          {p.cta.label}
                        </a>
                      </Button>
                    ) : !hasBillingCustomer ? (
                      // Users without billing customer (free or trial): go through checkout
                      <Button
                        variant={
                          p.cta.style === "primary" ? "default" : "outline"
                        }
                        className="w-full"
                        asChild
                      >
                        <Link to={`/api/billing/checkout?plan=${key}`}>
                          {currentPlan === "free" ? "Upgrade" : "Subscribe"}
                        </Link>
                      </Button>
                    ) : (
                      // Paying subscribers: use portal for plan changes
                      <Button
                        variant={
                          p.cta.style === "primary" ? "default" : "outline"
                        }
                        className="w-full"
                        asChild
                      >
                        <Link to="/api/billing/portal">Switch Plan</Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            },
          )}
        </div>
      </div>

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
          <div>
            <h3 className="font-semibold">Need help choosing a plan?</h3>
            <p className="text-muted-foreground text-sm">
              Talk to our team to find the best fit for your needs.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a
              href="https://cal.com/rickmoy"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Schedule a Call
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
