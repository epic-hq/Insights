/**
 * Insights Explainer Card
 *
 * Displays contextual guidance about the insights building process.
 * Shows when themes exist but have not been consolidated yet,
 * explaining that more interviews = better consolidated insights.
 */

import { Layers, Sparkles, TrendingUp } from "lucide-react";
import { useFetcher } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";

interface InsightsExplainerCardProps {
  interviewCount: number;
  themeCount: number;
  evidenceCount: number;
  projectId: string;
  accountId: string;
  /** Whether consolidation has ever been run */
  hasConsolidated?: boolean;
  /** Whether auto-consolidation is available (enough data) */
  canAutoConsolidate?: boolean;
}

export function InsightsExplainerCard({
  interviewCount,
  themeCount,
  evidenceCount,
  projectId,
  accountId,
  hasConsolidated = false,
  canAutoConsolidate = false,
}: InsightsExplainerCardProps) {
  const consolidateFetcher = useFetcher();
  const isConsolidating = consolidateFetcher.state !== "idle";

  // Determine the state
  const needsMoreData = interviewCount < 3;
  const hasEnoughForConsolidation = interviewCount >= 3 || evidenceCount >= 15;
  const tooManyThemes =
    themeCount > 15 && hasEnoughForConsolidation && !hasConsolidated;

  // Early stage: Not enough data yet
  if (needsMoreData) {
    return (
      <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          Building Your Insights
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <p className="mb-2">
            You have <strong>{interviewCount}</strong> interview
            {interviewCount !== 1 ? "s" : ""} and <strong>{themeCount}</strong>{" "}
            emerging theme{themeCount !== 1 ? "s" : ""}.
          </p>
          <p className="text-sm opacity-80">
            Add {3 - interviewCount} more interview
            {3 - interviewCount !== 1 ? "s" : ""} to unlock automatic theme
            consolidation. The more interviews you add, the stronger your
            insights will become.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Ready for consolidation but hasn't been done yet
  if (tooManyThemes) {
    return (
      <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          Ready to Consolidate
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <p className="mb-3">
            You have <strong>{themeCount}</strong> themes from{" "}
            <strong>{interviewCount}</strong> interviews. That's a lot to
            navigate. Consolidation will merge similar themes into 5-12 powerful
            insights.
          </p>
          <consolidateFetcher.Form
            method="post"
            action="/api/consolidate-themes"
            className="inline"
          >
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="account_id" value={accountId} />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={isConsolidating}
              className="gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50"
            >
              <Sparkles className="h-4 w-4" />
              {isConsolidating ? "Consolidating..." : "Consolidate Themes"}
            </Button>
          </consolidateFetcher.Form>
        </AlertDescription>
      </Alert>
    );
  }

  // Good state - already consolidated or reasonable theme count
  if (hasConsolidated || themeCount <= 15) {
    return null; // No card needed
  }

  return null;
}
