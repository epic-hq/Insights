/**
 * Analysis Overview Tab - The executive briefing
 *
 * Shows AI-synthesized key findings across ALL lenses, coverage bars,
 * and recommended actions. This is the "just tell me what matters" view.
 */

import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Lightbulb,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import type {
  AnalysisOverview,
  CrossLensFinding,
  RecommendedAction,
} from "../lib/loadAnalysisData.server";

type OverviewTabProps = {
  overview: AnalysisOverview;
  isSubmitting: boolean;
  onSynthesize: (force: boolean) => void;
  routes: any;
  projectPath: string;
};

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800";
    case "important":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800";
    case "notable":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getSeverityDot(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500";
    case "important":
      return "bg-amber-500";
    case "notable":
      return "bg-blue-500";
    default:
      return "bg-muted-foreground";
  }
}

function getCategoryIcon(category: string | null) {
  switch (category) {
    case "research":
      return <FlaskConical className="h-4 w-4" />;
    case "sales":
      return <Briefcase className="h-4 w-4" />;
    case "product":
      return <Package className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function FindingCard({
  finding,
  totalPeople,
}: {
  finding: CrossLensFinding;
  totalPeople: number;
}) {
  const percentage =
    totalPeople > 0 ? Math.round((finding.peopleCount / totalPeople) * 100) : 0;

  return (
    <div className="flex gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div
        className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${getSeverityDot(finding.severity)}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{finding.title}</h4>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {finding.severity}
          </Badge>
        </div>
        <p className="text-foreground/70 text-sm leading-relaxed">
          {finding.description}
        </p>
        <div className="flex items-center gap-3 pt-1">
          {finding.peopleCount > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-[10px]"
            >
              <Users className="h-2.5 w-2.5" />
              {finding.peopleCount} of {totalPeople} ({percentage}%)
            </Badge>
          )}
          {finding.mentionCount > 0 && (
            <span className="text-foreground/50 text-xs">
              {finding.mentionCount} mention
              {finding.mentionCount !== 1 ? "s" : ""}
            </span>
          )}
          {finding.supportingLenses.length > 0 && (
            <span className="text-foreground/50 text-xs">
              via {finding.supportingLenses.join(", ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  index,
}: {
  action: RecommendedAction;
  index: number;
}) {
  const priorityColors = {
    high: "border-l-red-500",
    medium: "border-l-amber-500",
    low: "border-l-blue-500",
  };

  return (
    <div
      className={`rounded-lg border border-l-4 p-4 ${priorityColors[action.priority]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground text-xs">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h4 className="font-medium text-sm">{action.title}</h4>
          </div>
          {action.description && (
            <p className="text-muted-foreground text-sm">
              {action.description}
            </p>
          )}
        </div>
        <Badge variant="outline" className="flex-shrink-0 text-xs">
          {action.category}
        </Badge>
      </div>
    </div>
  );
}

export function AnalysisOverviewTab({
  overview,
  isSubmitting,
  onSynthesize,
  routes,
  projectPath,
}: OverviewTabProps) {
  const {
    crossLensSynthesis,
    lensStats,
    interviewCount,
    peopleCount,
    surveyResponseCount,
  } = overview;
  const hasData = interviewCount > 0;
  const totalAnalyses = lensStats.reduce(
    (sum, ls) => sum + ls.completedCount,
    0,
  );

  // Empty state
  if (!hasData) {
    return (
      <div className="py-20 text-center">
        <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h2 className="mb-2 font-semibold text-xl">No data to analyze yet</h2>
        <p className="mx-auto mb-6 max-w-md text-muted-foreground">
          Record interviews or collect survey responses to see AI-powered
          analysis across all your conversation lenses.
        </p>
      </div>
    );
  }

  // No synthesis yet - prompt to generate
  if (!crossLensSynthesis) {
    return (
      <div className="space-y-8">
        {/* Generate prompt */}
        <Card className="border-primary/30 border-dashed bg-primary/[0.02]">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 rounded-xl bg-primary/10 p-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold text-lg">
              Generate Analysis Overview
            </h3>
            <p className="mb-6 max-w-lg text-muted-foreground">
              Synthesize key findings, patterns, and recommended actions across
              all {totalAnalyses} analyses from{" "}
              {lensStats.filter((l) => l.completedCount > 0).length} active
              lenses.
            </p>
            <Button
              size="lg"
              onClick={() => onSynthesize(false)}
              disabled={isSubmitting || totalAnalyses === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Overview
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Coverage bars (always show) */}
        <CoverageSection lensStats={lensStats} routes={routes} />
      </div>
    );
  }

  // Processing state
  if (crossLensSynthesis.status === "processing") {
    return (
      <div className="space-y-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <h3 className="font-semibold text-lg">
                Generating Analysis Overview
              </h3>
              <p className="text-muted-foreground">
                Synthesizing {crossLensSynthesis.analysisCount} analyses across
                all lenses...
              </p>
            </div>
          </CardContent>
        </Card>
        <CoverageSection lensStats={lensStats} routes={routes} />
      </div>
    );
  }

  // Failed state
  if (crossLensSynthesis.status === "failed") {
    return (
      <div className="space-y-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Synthesis failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>The cross-lens analysis encountered an error.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSynthesize(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Retry"
              )}
            </Button>
          </AlertDescription>
        </Alert>
        <CoverageSection lensStats={lensStats} routes={routes} />
      </div>
    );
  }

  // Completed synthesis
  const isStale = totalAnalyses > crossLensSynthesis.analysisCount;

  return (
    <div className="space-y-8">
      {/* Stats at a Glance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="font-semibold text-2xl text-foreground">
            {peopleCount}
          </div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
            <Users className="h-3 w-3" />
            People
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="font-semibold text-2xl text-foreground">
            {interviewCount}
          </div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
            <MessageSquare className="h-3 w-3" />
            Conversations
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="font-semibold text-2xl text-foreground">
            {surveyResponseCount}
          </div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
            <ClipboardList className="h-3 w-3" />
            Surveys
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="font-semibold text-2xl text-foreground">
            {lensStats.filter((l) => l.completedCount > 0).length}
          </div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
            <Sparkles className="h-3 w-3" />
            Active Lenses
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Key Findings</CardTitle>
              {isStale && (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-600"
                >
                  New data available
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSynthesize(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Refresh
                </>
              )}
            </Button>
          </div>
          {isStale && (
            <p className="text-amber-600 text-sm">
              {totalAnalyses - crossLensSynthesis.analysisCount} new
              analysis(es) since last synthesis.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Executive summary text */}
          {crossLensSynthesis.executiveSummary && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-line text-sm leading-relaxed">
                {crossLensSynthesis.executiveSummary}
              </div>
            </div>
          )}

          {/* Key findings */}
          {crossLensSynthesis.keyFindings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Top Findings
                </h4>
                <div className="flex items-center gap-2">
                  {(() => {
                    const counts = crossLensSynthesis.keyFindings.reduce(
                      (acc, f) => {
                        acc[f.severity] = (acc[f.severity] || 0) + 1;
                        return acc;
                      },
                      {} as Record<string, number>,
                    );
                    return (
                      <>
                        {counts.critical && (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            {counts.critical} critical
                          </span>
                        )}
                        {counts.important && (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            {counts.important} important
                          </span>
                        )}
                        {counts.notable && (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            {counts.notable} notable
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="space-y-2">
                {crossLensSynthesis.keyFindings.map((finding, i) => (
                  <FindingCard
                    key={i}
                    finding={finding}
                    totalPeople={peopleCount}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      {crossLensSynthesis.recommendedActions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <CardTitle>Recommended Actions</CardTitle>
            </div>
            <CardDescription>
              AI-suggested next steps based on cross-lens analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {crossLensSynthesis.recommendedActions.map((action, i) => (
                <ActionCard key={i} action={action} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage */}
      <CoverageSection lensStats={lensStats} routes={routes} />

      {/* Metadata */}
      {crossLensSynthesis.processedAt && (
        <p className="text-muted-foreground text-xs">
          Last synthesized{" "}
          {new Date(crossLensSynthesis.processedAt).toLocaleDateString()} at{" "}
          {new Date(crossLensSynthesis.processedAt).toLocaleTimeString()}
          {crossLensSynthesis.overallConfidence && (
            <>
              {" "}
              &middot; {Math.round(crossLensSynthesis.overallConfidence * 100)}%
              confidence
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Coverage Section
// ============================================================================

function CoverageSection({
  lensStats,
  routes,
}: {
  lensStats: AnalysisOverview["lensStats"];
  routes: any;
}) {
  if (lensStats.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Analysis Coverage</CardTitle>
        <CardDescription>
          How much of your data has been analyzed by each lens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {lensStats.map((stat) => {
            const percentage =
              stat.totalInterviews > 0
                ? Math.round((stat.completedCount / stat.totalInterviews) * 100)
                : 0;
            const isComplete =
              stat.completedCount >= stat.totalInterviews &&
              stat.totalInterviews > 0;

            return (
              <Link
                key={stat.templateKey}
                to={routes.lenses.byTemplateKey(stat.templateKey)}
                className="group block"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(stat.category)}
                    <span className="font-medium text-sm group-hover:text-primary">
                      {stat.templateName}
                    </span>
                    {stat.synthesis?.status === "completed" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {stat.completedCount}/{stat.totalInterviews}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
