/**
 * Admin Usage Dashboard
 *
 * Platform admin view for monitoring usage across all accounts.
 * Shows per-account usage, daily trends, and feature breakdowns.
 */

import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  getAuthenticatedUser,
  getServerClient,
} from "~/lib/supabase/client.server";

type AccountUsage = {
  account_id: string;
  account_name: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  total_credits: number;
};

type DailyUsage = {
  usage_date: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  total_credits: number;
  unique_accounts: number;
};

type FeatureUsage = {
  feature_source: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  total_credits: number;
};

type UserUsage = {
  user_id: string;
  user_email: string;
  user_name: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  total_credits: number;
};

type DailyUsageByFeature = {
  usage_date: string;
  feature_source: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  total_credits: number;
};

type RecentFeature = {
  feature: string;
  model: string;
  tokens: number;
  credits: number;
  created_at: string;
};

type RecentLoginActivity = {
  user_id: string;
  user_email: string;
  user_name: string;
  last_sign_in_at: string;
  recent_features: RecentFeature[];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await getAuthenticatedUser(request);
  if (!user) {
    throw redirect("/login");
  }

  const { client: supabase } = getServerClient(request);

  // Check if user is platform admin
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("is_platform_admin")
    .eq("user_id", user.sub)
    .single();

  if (!userSettings?.is_platform_admin) {
    throw new Response("Access denied: Platform admin required", {
      status: 403,
    });
  }

  // Get date range from query params
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30";
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number.parseInt(range));

  // Fetch admin usage data via public wrapper functions
  const [
    accountUsageResult,
    dailyUsageResult,
    featureUsageResult,
    userUsageResult,
    dailyByFeatureResult,
    recentLoginResult,
  ] = await Promise.all([
    supabase.rpc("get_admin_usage_by_account", {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
    }),
    supabase.rpc("get_admin_daily_usage", {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
    }),
    supabase.rpc("get_admin_usage_by_feature", {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
    }),
    supabase.rpc("get_admin_usage_by_user", {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
    }),
    supabase.rpc("get_admin_daily_usage_by_feature", {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
    }),
    supabase.rpc("get_admin_recent_login_activity", {
      p_user_limit: 5,
      p_feature_limit: 10,
    }),
  ]);

  const accountUsage = (accountUsageResult.data as AccountUsage[]) || [];
  const dailyUsage = (dailyUsageResult.data as DailyUsage[]) || [];
  const featureUsage = (featureUsageResult.data as FeatureUsage[]) || [];
  const userUsage = (userUsageResult.data as UserUsage[]) || [];
  const dailyByFeature =
    (dailyByFeatureResult.data as DailyUsageByFeature[]) || [];
  const recentLoginActivity =
    (recentLoginResult.data as RecentLoginActivity[]) || [];

  // Calculate totals
  const totals = {
    events: accountUsage.reduce((sum, a) => sum + (a.event_count ?? 0), 0),
    tokens: accountUsage.reduce((sum, a) => sum + (a.total_tokens ?? 0), 0),
    cost: accountUsage.reduce((sum, a) => sum + (a.total_cost_usd ?? 0), 0),
    credits: accountUsage.reduce((sum, a) => sum + (a.total_credits ?? 0), 0),
    accounts: accountUsage.length,
  };

  // Calculate cost metrics
  const daysInRange = Number.parseInt(range);
  const weeksInRange = daysInRange / 7;
  const monthsInRange = daysInRange / 30;
  const uniqueUsers = userUsage.length;

  const costMetrics = {
    perDay: totals.cost / daysInRange,
    perWeek: totals.cost / weeksInRange,
    perMonth: totals.cost / monthsInRange,
    perUser: uniqueUsers > 0 ? totals.cost / uniqueUsers : 0,
    perUserPerDay:
      uniqueUsers > 0 ? totals.cost / uniqueUsers / daysInRange : 0,
  };

  return {
    accountUsage,
    dailyUsage,
    dailyByFeature,
    featureUsage,
    userUsage,
    recentLoginActivity,
    totals,
    costMetrics,
    range,
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
    transcription: "Audio Transcription",
  };
  return (
    labels[source] ??
    source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Feature colors for stacked chart - ensure distinct colors for all features
const FEATURE_COLORS: Record<string, string> = {
  project_status_agent: "hsl(221, 83%, 53%)", // blue
  embedding_generation: "hsl(262, 83%, 58%)", // purple
  theme_generation: "hsl(142, 71%, 45%)", // green
  interview_analysis: "hsl(340, 82%, 52%)", // pink
  interview_extraction: "hsl(25, 95%, 53%)", // orange
  voice_chat: "hsl(38, 92%, 50%)", // amber
  survey_analysis: "hsl(199, 89%, 48%)", // cyan
  lens_analysis: "hsl(280, 70%, 60%)", // violet
  chat_completion: "hsl(175, 70%, 45%)", // teal
  transcription: "hsl(350, 80%, 55%)", // red
  persona_synthesis: "hsl(45, 90%, 50%)", // gold
};

export default function AdminUsagePage() {
  const {
    accountUsage,
    dailyUsage,
    dailyByFeature,
    featureUsage,
    userUsage,
    recentLoginActivity,
    totals,
    costMetrics,
    range,
  } = useLoaderData<typeof loader>();
  const [selectedRange, setSelectedRange] = useState(range);

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    window.location.href = `/admin/usage?range=${value}`;
  };

  // Get unique feature sources for stacked bars
  const featureSources = [
    ...new Set(dailyByFeature.map((d) => d.feature_source)),
  ];

  // Transform daily by feature data into stacked chart format
  // Group by date, with each feature as a separate key
  const stackedChartData = (() => {
    const byDate = new Map<string, Record<string, number | string>>();

    for (const d of dailyByFeature) {
      const [year, month, day] = d.usage_date.split("-").map(Number);
      const localDate = new Date(year, month - 1, day);
      const dateKey = localDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { date: dateKey });
      }

      const entry = byDate.get(dateKey)!;
      entry[d.feature_source] = d.total_credits ?? 0;
    }

    return Array.from(byDate.values());
  })();

  // Fallback to simple chart if no stacked data
  const chartData =
    stackedChartData.length > 0
      ? stackedChartData
      : dailyUsage.map((d) => {
          const [year, month, day] = d.usage_date.split("-").map(Number);
          const localDate = new Date(year, month - 1, day);
          return {
            date: localDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            credits: d.total_credits ?? 0,
          };
        });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-3xl">Admin Usage Dashboard</h1>
          <p className="text-muted-foreground">
            Platform-wide usage metrics and trends
          </p>
        </div>
        <Select value={selectedRange} onValueChange={handleRangeChange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards - Total Events and Active Accounts on left, costs on right */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Total Events</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {totals.events.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">LLM API calls</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">
              Active Accounts
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totals.accounts}</div>
            <p className="text-muted-foreground text-xs">
              With usage in period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Total Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">${totals.cost.toFixed(2)}</div>
            <p className="text-muted-foreground text-xs">Estimated LLM cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Credits Used</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {totals.credits.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Internal credits consumed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Avg Cost/Day</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${costMetrics.perDay.toFixed(4)}
            </div>
            <p className="text-muted-foreground text-xs">
              Average daily LLM spend
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Avg Cost/Week</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${costMetrics.perWeek.toFixed(2)}
            </div>
            <p className="text-muted-foreground text-xs">
              Average weekly LLM spend
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">
              Avg Cost/Month
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${costMetrics.perMonth.toFixed(2)}
            </div>
            <p className="text-muted-foreground text-xs">
              Average monthly LLM spend
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-sm">Avg Cost/User</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${costMetrics.perUser.toFixed(4)}
            </div>
            <p className="text-muted-foreground text-xs">
              Average cost per active user
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart - Stacked by Feature */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Feature</CardTitle>
          <CardDescription>
            Daily credits by feature (stacked bar chart)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    value,
                    formatFeatureSource(name),
                  ]}
                />
                <Legend
                  formatter={(value) => formatFeatureSource(value)}
                  wrapperStyle={{ fontSize: "12px" }}
                />
                {featureSources.length > 0 ? (
                  featureSources.map((feature) => (
                    <Bar
                      key={feature}
                      dataKey={feature}
                      stackId="stack"
                      fill={FEATURE_COLORS[feature] || "hsl(var(--primary))"}
                      name={feature}
                    />
                  ))
                ) : (
                  <Bar
                    dataKey="credits"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Credits"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              No usage data for this period
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per-Account Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Usage by Account
            </CardTitle>
            <CardDescription>
              Top accounts by credit consumption
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountUsage.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountUsage.slice(0, 10).map((account) => (
                    <TableRow key={account.account_id}>
                      <TableCell className="font-medium">
                        {account.account_name || account.account_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(account.event_count ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {(account.total_credits ?? 0).toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${(account.total_cost_usd ?? 0).toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No account usage data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage by Feature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Usage by Feature
            </CardTitle>
            <CardDescription>Credit consumption per feature</CardDescription>
          </CardHeader>
          <CardContent>
            {featureUsage.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureUsage.map((feature) => (
                    <TableRow key={feature.feature_source}>
                      <TableCell className="font-medium">
                        {formatFeatureSource(feature.feature_source)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(feature.event_count ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {(feature.total_tokens ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {(feature.total_credits ?? 0).toLocaleString()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No feature usage data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage by User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Usage by User
          </CardTitle>
          <CardDescription>Top users by credit consumption</CardDescription>
        </CardHeader>
        <CardContent>
          {userUsage.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userUsage.slice(0, 20).map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      {user.user_name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.user_email || user.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(user.event_count ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(user.total_tokens ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${(user.total_cost_usd ?? 0).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {(user.total_credits ?? 0).toLocaleString()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No user usage data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Login Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Login Activity
          </CardTitle>
          <CardDescription>
            Last 5 logins with their recent feature usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoginActivity.length > 0 ? (
            <div className="space-y-6">
              {recentLoginActivity.map((activity) => (
                <div
                  key={activity.user_id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {activity.user_name || "Unknown User"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {activity.user_email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-sm">
                        Last login
                      </p>
                      <p className="font-medium text-sm">
                        {new Date(activity.last_sign_in_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {activity.recent_features.length > 0 ? (
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">
                        Recent Features Used
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activity.recent_features.map((feature, idx) => (
                          <Badge
                            key={`${activity.user_id}-${idx}`}
                            variant="outline"
                            className="text-xs"
                          >
                            {formatFeatureSource(feature.feature)}
                            <span className="ml-1 text-muted-foreground">
                              ({feature.credits} cr)
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-muted-foreground text-sm">
                      No recent feature usage
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No recent login activity
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
