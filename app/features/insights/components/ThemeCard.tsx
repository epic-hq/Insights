/**
 * Layer 2: Theme Card — signal badge, title, quote, subtle stats.
 * The entire card is a link to the theme detail page.
 * Matches wireframe Layer 2 layout.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "~/components/ui/card";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { ThemeWithSignal } from "~/features/insights/types";

interface ThemeCardProps {
  theme: ThemeWithSignal;
  totalPeople: number;
  highlightId?: string | null;
}

/** Signal badge config keyed by signal_level */
const SIGNAL_BADGE_CONFIG: Record<
  string,
  { label: string; trendIcon: string; className: string }
> = {
  high: {
    label: "High Signal",
    trendIcon: "",
    className:
      "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  },
  medium: {
    label: "Investigate",
    trendIcon: "",
    className:
      "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
  },
  low: {
    label: "Monitor",
    trendIcon: "",
    className:
      "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  },
};

/** Map trend to arrow character */
function trendArrow(trend: string): string {
  if (trend === "growing") return " \u2191";
  if (trend === "fading") return " \u2193";
  return " \u2192";
}

export function ThemeCard({ theme, totalPeople, highlightId }: ThemeCardProps) {
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath);
  const cardRef = useRef<HTMLDivElement>(null);

  // Highlight + scroll effect when this card is targeted
  const [isHighlighted, setIsHighlighted] = useState(false);
  useEffect(() => {
    if (highlightId === theme.id && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setIsHighlighted(true);
      const timeout = setTimeout(() => setIsHighlighted(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightId, theme.id]);

  const displayName = theme.name || theme.title || "Untitled";
  const displayStatement =
    theme.statement || theme.details || theme.content || "";
  const truncatedStatement =
    displayStatement.length > 140
      ? `${displayStatement.slice(0, 137)}...`
      : displayStatement;

  const badge =
    SIGNAL_BADGE_CONFIG[theme.signal_level] ?? SIGNAL_BADGE_CONFIG.low;
  const arrow = trendArrow(theme.trend);

  return (
    <Card
      ref={cardRef}
      data-theme-id={theme.id}
      className={cn(
        "transition-all duration-300 hover:border-foreground/20 hover:shadow-sm",
        isHighlighted && "ring-2 ring-amber-400",
      )}
    >
      <Link
        to={routes.insights.detail(theme.id)}
        className="block p-4 no-underline"
      >
        {/* Signal badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold",
            badge.className,
          )}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {badge.label}
          {arrow}
        </span>

        {/* Title */}
        <h3 className="mt-2.5 font-semibold text-foreground text-sm leading-snug">
          {displayName}
        </h3>

        {/* Quote */}
        {truncatedStatement && (
          <p className="mt-2 text-muted-foreground text-xs italic leading-relaxed">
            &ldquo;{truncatedStatement}&rdquo;
          </p>
        )}

        {/* Subtle stats */}
        <div className="mt-3 flex items-center gap-3 text-muted-foreground text-xs">
          <span>
            {theme.person_count}{" "}
            {theme.person_count === 1 ? "person" : "people"}
          </span>
          <span className="text-muted-foreground/40">&middot;</span>
          <span>{theme.evidence_count} evidence</span>
        </div>
      </Link>
    </Card>
  );
}
