/**
 * PersonInsights - AI summary, heuristic next steps, and theme badges.
 *
 * Replaces the old PersonOverviewTab with a focused, single-card layout
 * that surfaces the most actionable information about a person: what the
 * AI has learned, what you should do next, and which themes they care about.
 */

import { differenceInDays } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Theme {
  id: string;
  name: string;
  statement: string | null;
  evidence_count: number;
}

interface NextStep {
  text: string;
  context: string;
}

interface AINextStep {
  action: string;
  reasoning: string;
  priority: number;
}

interface PersonInsightsProps {
  /** AI-generated description / key takeaways */
  description: string | null;
  /** Themes this person's evidence supports */
  themes: Theme[];
  /** When the person was last contacted */
  lastContactDate: Date | null;
  /** Number of survey responses linked to this person */
  surveyCount: number;
  /** Number of conversations linked to this person */
  conversationCount: number;
  /** ICP match result, if available */
  icpMatch: { band: string | null; score: number | null } | null;
  /** Route helpers for linking to theme detail pages */
  routes: {
    themes: { detail: (id: string) => string };
  };
  /** Callback to regenerate the AI description */
  onRefreshDescription: () => void;
  /** Whether the description is currently being regenerated */
  isRefreshing?: boolean;
  /** AI-generated next steps (null = use heuristic fallback) */
  aiNextSteps?: AINextStep[] | null;
}

// ---------------------------------------------------------------------------
// Heuristic next-step generation
// ---------------------------------------------------------------------------

/**
 * Generates up to 3 recommended next steps based on the person's data.
 *
 * Rules are evaluated in priority order; the first 3 that apply are returned.
 * A fallback is always available so the list is never empty.
 */
function generateNextSteps({
  lastContactDate,
  surveyCount,
  conversationCount,
  icpMatch,
}: Pick<
  PersonInsightsProps,
  "lastContactDate" | "surveyCount" | "conversationCount" | "icpMatch"
>): NextStep[] {
  const steps: NextStep[] = [];
  const MAX_STEPS = 3;

  // 1. Follow-up based on recency of last contact
  if (lastContactDate === null) {
    steps.push({
      text: "Make initial contact",
      context: "no conversations recorded yet",
    });
  } else {
    const daysSince = differenceInDays(new Date(), lastContactDate);
    if (daysSince > 14) {
      steps.push({
        text: "Schedule a follow-up call",
        context: `last contact was ${daysSince} days ago`,
      });
    }
  }

  // 2 / 3. Survey-related
  if (steps.length < MAX_STEPS) {
    if (surveyCount === 0) {
      steps.push({
        text: "Send a survey to gather structured feedback",
        context: "no survey data collected yet",
      });
    } else {
      steps.push({
        text: "Review latest survey responses",
        context: `${surveyCount} survey${surveyCount === 1 ? "" : "s"} with actionable feedback`,
      });
    }
  }

  // 4. ICP scoring
  if (steps.length < MAX_STEPS && icpMatch === null) {
    steps.push({
      text: "Run ICP scoring to assess prospect fit",
      context: "no ICP score calculated yet",
    });
  }

  // 5. Discovery depth
  if (steps.length < MAX_STEPS && conversationCount < 2) {
    steps.push({
      text: "Schedule a discovery call to deepen understanding",
      context: `only ${conversationCount} conversation${conversationCount === 1 ? "" : "s"} so far`,
    });
  }

  // 6. Fallback
  if (steps.length < MAX_STEPS) {
    steps.push({
      text: "Add notes from your last interaction",
      context: "keep the record up to date",
    });
  }

  return steps.slice(0, MAX_STEPS);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VISIBLE_THEME_COUNT = 6;

export function PersonInsights({
  description,
  themes,
  lastContactDate,
  surveyCount,
  conversationCount,
  icpMatch,
  routes,
  onRefreshDescription,
  isRefreshing = false,
  aiNextSteps,
}: PersonInsightsProps) {
  const [showAllThemes, setShowAllThemes] = useState(false);

  const hasDescription = description && description.trim().length > 0;
  const hasThemes = themes.length > 0;

  // Empty state -- nothing to show at all
  if (!hasDescription && !hasThemes) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
        <Sparkles className="mb-4 h-10 w-10 text-muted-foreground/40" />
        <h3 className="mb-1 font-semibold text-base text-foreground">
          No insights yet
        </h3>
        <p className="max-w-sm text-muted-foreground text-sm">
          Add conversations or surveys linked to this person to generate
          AI-powered insights, themes, and next steps.
        </p>
      </div>
    );
  }

  // Use AI next steps when available, fall back to heuristic
  const useAI = aiNextSteps && aiNextSteps.length > 0;
  const heuristicSteps = generateNextSteps({
    lastContactDate,
    surveyCount,
    conversationCount,
    icpMatch,
  });

  const visibleThemes = showAllThemes
    ? themes
    : themes.slice(0, VISIBLE_THEME_COUNT);
  const hiddenCount = themes.length - VISIBLE_THEME_COUNT;

  const hasSteps = useAI || heuristicSteps.length > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-0">
        <h2 className="flex items-center gap-2 font-semibold text-base text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Insights
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={isRefreshing}
          onClick={onRefreshDescription}
          aria-label="Refresh AI insights"
          className="gap-1.5 text-muted-foreground"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* ── AI Summary ─────────────────────────────────────────── */}
      {hasDescription && (
        <div className="px-6 pt-4">
          <p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* ── Divider ────────────────────────────────────────────── */}
      {hasDescription && hasSteps && (
        <div className="mx-6 my-4 h-px bg-border" />
      )}

      {/* ── Recommended Next Steps ─────────────────────────────── */}
      {hasSteps && (
        <div className="px-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-muted-foreground text-sm">
            <Target className="h-3.5 w-3.5" />
            Recommended Next Steps
            {useAI && (
              <Badge
                variant="outline"
                className="ml-1 gap-1 px-1.5 py-0 text-[10px] font-normal text-primary"
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI
              </Badge>
            )}
          </h3>

          {useAI ? (
            <ul className="space-y-3">
              {aiNextSteps.map((step) => (
                <li key={step.action} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {step.priority}
                  </span>
                  <div className="min-w-0">
                    <span className="text-foreground text-sm">
                      {step.action}
                    </span>
                    <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                      {step.reasoning}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {heuristicSteps.map((step) => (
                <li key={step.text} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 shrink-0 font-medium text-primary text-sm"
                    aria-hidden="true"
                  >
                    &rarr;
                  </span>
                  <div className="min-w-0">
                    <span className="text-foreground text-sm">{step.text}</span>
                    <span className="ml-1.5 text-muted-foreground text-xs">
                      ({step.context})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Divider ────────────────────────────────────────────── */}
      {hasThemes && <div className="mx-6 my-4 h-px bg-border" />}

      {/* ── Themes ─────────────────────────────────────────────── */}
      {hasThemes && (
        <div className="px-6 pb-5">
          <h3 className="mb-3 font-semibold text-muted-foreground text-sm">
            Themes
          </h3>
          <div className="flex flex-wrap gap-2">
            {visibleThemes.map((theme) => (
              <Link key={theme.id} to={routes.themes.detail(theme.id)}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1.5 px-3 py-1.5 transition-colors hover:bg-secondary/80"
                >
                  {theme.name}
                  <span className="text-muted-foreground">
                    {theme.evidence_count}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>

          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 gap-1 text-muted-foreground"
              onClick={() => setShowAllThemes(!showAllThemes)}
            >
              {showAllThemes ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />+{hiddenCount} more
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Bottom padding when themes section is absent */}
      {!hasThemes && <div className="pb-5" />}
    </div>
  );
}
