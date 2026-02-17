/**
 * Layer 1: Signal Summary — card with storytelling rows for top themes.
 * Each row: colored signal dot, theme name (clickable), stats, quote, trend badge.
 * Matches wireframe Layer 1 layout.
 */
import { TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { ThemeWithSignal } from "~/features/insights/types";

interface SignalSummaryProps {
  themes: ThemeWithSignal[];
  totalPeople: number;
  conversationCount?: number;
}

/** Map signal_level to dot color classes */
const SIGNAL_DOT_STYLES: Record<string, string> = {
  high: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
  medium: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.3)]",
  low: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]",
};

/** Map trend to badge style */
const TREND_STYLES: Record<string, { label: string; className: string }> = {
  growing: {
    label: "Growing",
    className:
      "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
  },
  stable: {
    label: "Stable",
    className:
      "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400",
  },
  fading: {
    label: "Fading",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function SignalSummary({
  themes,
  totalPeople,
  conversationCount,
}: SignalSummaryProps) {
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath);
  const top = themes.slice(0, 3);

  if (top.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Signal Summary
          </CardTitle>
          <Badge
            variant="outline"
            className="text-xs font-normal text-muted-foreground"
          >
            {conversationCount ?? totalPeople}{" "}
            {conversationCount ? "conversations" : "people"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pt-4">
        <div className="divide-y divide-border">
          {top.map((theme) => {
            const displayName = theme.name || theme.title || "Untitled";
            const displayStatement =
              theme.statement || theme.details || theme.content || "";
            const truncated =
              displayStatement.length > 120
                ? `${displayStatement.slice(0, 117)}...`
                : displayStatement;
            const trend = TREND_STYLES[theme.trend] ?? TREND_STYLES.stable;

            return (
              <Link
                key={theme.id}
                to={routes.insights.detail(theme.id)}
                className="flex w-full items-start gap-3 px-6 py-3.5 text-left no-underline transition-colors hover:bg-muted/50 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {/* Signal dot */}
                <div
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    SIGNAL_DOT_STYLES[theme.signal_level] ??
                      SIGNAL_DOT_STYLES.low,
                  )}
                />

                {/* Content: name, meta, quote */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-snug">
                    {displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {theme.evidence_count} evidence &middot;{" "}
                    {theme.person_count}{" "}
                    {theme.person_count === 1 ? "source" : "sources"}
                  </p>
                  {truncated && (
                    <p className="mt-1 text-xs text-muted-foreground italic leading-relaxed truncate">
                      &ldquo;{truncated}&rdquo;
                    </p>
                  )}
                </div>

                {/* Right side: trend badge */}
                <div className="shrink-0 pt-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                      trend.className,
                    )}
                  >
                    {theme.trend === "growing" ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <ArrowRight className="h-3 w-3" />
                    )}
                    {trend.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
