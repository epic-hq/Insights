/**
 * Admin Usage Dashboard
 *
 * Platform admin view for monitoring usage across all accounts.
 * Shows per-account usage, daily trends, and feature breakdowns.
 */

import { Building2, Calendar, TrendingUp, Users, Zap } from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  startDate.setDate(startDate.getDate() - parseInt(range));

  // Fetch admin usage data
  const [accountUsageResult, dailyUsageResult, featureUsageResult] =
    await Promise.all([
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
    ]);

  const accountUsage = (accountUsageResult.data as AccountUsage[]) || [];
  const dailyUsage = (dailyUsageResult.data as DailyUsage[]) || [];
  const featureUsage = (featureUsageResult.data as FeatureUsage[]) || [];

  // Calculate totals
  const totals = {
    events: accountUsage.reduce((sum, a) => sum + (a.event_count ?? 0), 0),
    tokens: accountUsage.reduce((sum, a) => sum + (a.total_tokens ?? 0), 0),
    cost: accountUsage.reduce((sum, a) => sum + (a.total_cost_usd ?? 0), 0),
    credits: accountUsage.reduce((sum, a) => sum + (a.total_credits ?? 0), 0),
    accounts: accountUsage.length,
  };

  return {
    accountUsage,
    dailyUsage,
    featureUsage,
    totals,
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
  };
  return (
    labels[source] ??
    source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function AdminUsagePage() {
  const { accountUsage, dailyUsage, featureUsage, totals, range } =
    useLoaderData<typeof loader>();
  const [selectedRange, setSelectedRange] = useState(range);

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    window.location.href = `/admin/usage?range=${value}`;
  };

  // Format daily data for chart
  const chartData = dailyUsage.map((d) => ({
    date: new Date(d.usage_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    credits: d.total_credits ?? 0,
    cost: d.total_cost_usd ?? 0,
    accounts: d.unique_accounts ?? 0,
  }));

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

      {/* Summary Cards */}
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
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trend</CardTitle>
          <CardDescription>Daily credits and cost over time</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
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
                />
                <Area
                  type="monotone"
                  dataKey="credits"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorCredits)"
                  name="Credits"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
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
    </div>
  );
}
