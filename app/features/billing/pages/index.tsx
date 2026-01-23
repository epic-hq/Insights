import consola from "consola";
import {
  Calendar,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Mic,
  Sparkles,
  TrendingUp,
  Zap,
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
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { PLANS } from "~/config/plans";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

type PlanKey = keyof typeof PLANS;

type UsageSummaryRow = {
  feature_source: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  total_credits: number;
};

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

  // Get account info (name only - plan comes from billing_subscriptions)
  const { data: account } = await supabase
    .from("account_members")
    .select("account_id, role, accounts(name, metadata)")
    .eq("account_id", accountId)
    .single();

  // Get current plan from billing_subscriptions (single source of truth)
  let currentPlan: PlanKey = "free";
  const { data: subscription, error: subError } = await supabaseAdmin
    .schema("accounts")
    .from("billing_subscriptions")
    .select("plan_name, status")
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
    const planKey = subscription.plan_name.toLowerCase() as PlanKey;
    if (planKey in PLANS) {
      currentPlan = planKey;
    }
  }

  // Get monthly usage summary from billing schema
  let usageSummary: UsageSummaryRow[] = [];
  let totalAiEvents = 0;
  let totalVoiceMinutes = 0;
  let totalCredits = 0;

  if (accountId) {
    const { data: usageData } = await supabase.rpc(
      "get_monthly_usage_summary",
      {
        p_account_id: accountId,
      },
    );

    if (usageData) {
      usageSummary = usageData as UsageSummaryRow[];
      // Calculate totals from usage summary
      for (const row of usageSummary) {
        totalCredits += row.total_credits;
        // Count AI analysis events (non-voice sources)
        if (row.feature_source !== "voice_chat") {
          totalAiEvents += row.event_count;
        }
      }
    }

    // Get voice minutes from entitlements
    const { data: voiceEntitlement } = await supabase.rpc(
      "get_active_entitlement",
      {
        p_account_id: accountId,
        p_feature_key: "voice_chat",
      },
    );

    if (voiceEntitlement && voiceEntitlement.length > 0) {
      totalVoiceMinutes = voiceEntitlement[0].quantity_used ?? 0;
    }
  }

  // Map to the usage object structure
  const usage = {
    ai_analyses: totalAiEvents,
    voice_minutes: totalVoiceMinutes,
    survey_responses: 0, // TODO: count from surveys table
  };

  // Check if Polar customer exists (needed for "Manage Subscription" button)
  const { data: billingCustomer } = await supabaseAdmin
    .schema("accounts")
    .from("billing_customers")
    .select("id")
    .eq("account_id", accountId)
    .eq("provider", "polar")
    .maybeSingle();

  return {
    currentPlan,
    usage,
    usageSummary,
    totalCredits,
    accountName:
      (account?.accounts as { name?: string })?.name ?? "Your Account",
    renewalDate: null as string | null, // TODO: Get from billing provider
    hasBillingCustomer: !!billingCustomer,
  };
}

function formatFeatureSource(source: string): string {
  const labels: Record<string, string> = {
    interview_analysis: "Interview Analysis",
    project_status_agent: "Project Status Agent",
    voice_chat: "Voice Chat",
    survey_analysis: "Survey Analysis",
    lens_analysis: "Lens Analysis",
    chat_completion: "Chat Messages",
  };
  return (
    labels[source] ??
    source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function BillingPage() {
  const {
    currentPlan,
    usage,
    usageSummary,
    totalCredits,
    accountName,
    renewalDate,
    hasBillingCustomer,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const plan = PLANS[currentPlan];
  const limits = plan.limits;

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
      // Clear the URL params
      searchParams.delete("checkout");
      searchParams.delete("plan");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Calculate usage percentages
  const analysisPercent =
    limits.ai_analyses === Number.POSITIVE_INFINITY
      ? 0
      : (usage.ai_analyses / limits.ai_analyses) * 100;
  const voicePercent =
    limits.voice_minutes === 0
      ? 0
      : (usage.voice_minutes / limits.voice_minutes) * 100;
  const surveyPercent =
    (usage.survey_responses / limits.survey_responses) * 100;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl">Billing & Usage</h1>
        <p className="text-muted-foreground">
          Manage your plan and track usage for {accountName}.
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
        <CardFooter>
          {hasBillingCustomer && (
            <Button variant="outline" asChild>
              <Link to="/api/billing/portal">
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscription
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Usage Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* AI Analyses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-2xl">{usage.ai_analyses}</span>
                <span className="text-muted-foreground text-sm">
                  {limits.ai_analyses === Number.POSITIVE_INFINITY
                    ? "Unlimited"
                    : `of ${limits.ai_analyses}`}
                </span>
              </div>
              {limits.ai_analyses !== Number.POSITIVE_INFINITY && (
                <Progress value={analysisPercent} className="h-2" />
              )}
              {limits.ai_analyses === Number.POSITIVE_INFINITY && (
                <p className="text-muted-foreground text-xs">
                  Unlimited on your plan
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Voice Minutes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-blue-500" />
              Voice Chat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-2xl">
                  {usage.voice_minutes}
                </span>
                <span className="text-muted-foreground text-sm">
                  {limits.voice_minutes === 0
                    ? "Not included"
                    : `of ${limits.voice_minutes} min`}
                </span>
              </div>
              {limits.voice_minutes > 0 ? (
                <Progress value={voicePercent} className="h-2" />
              ) : (
                <p className="text-muted-foreground text-xs">
                  <Link
                    to="/pricing"
                    className="text-primary underline underline-offset-2"
                  >
                    Upgrade
                  </Link>{" "}
                  to unlock voice chat
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Survey Responses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Survey Responses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-2xl">
                  {usage.survey_responses}
                </span>
                <span className="text-muted-foreground text-sm">
                  of {limits.survey_responses}
                </span>
              </div>
              <Progress value={surveyPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage Breakdown */}
      {false && usageSummary.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-xl">Usage This Month</h2>
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                {totalCredits} credits used
              </Badge>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageSummary.map((row) => (
                    <TableRow key={row.feature_source}>
                      <TableCell className="font-medium">
                        {formatFeatureSource(row.feature_source)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(row.event_count ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {(row.total_tokens ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(row.total_cost_usd ?? 0).toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}

      <Separator />

      {/* Upgrade / Change Plan CTA */}
      <Card className="bg-muted/50">
        <CardContent className="flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
          <div>
            <h3 className="font-semibold">
              {currentPlan === "free" ? "Upgrade your plan" : "Compare plans"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {currentPlan === "free"
                ? "Unlock unlimited AI analyses, voice chat, and more."
                : "See all plan features and switch plans anytime."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/pricing">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Plans
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://cal.com/rickmoy"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Talk to Sales
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
