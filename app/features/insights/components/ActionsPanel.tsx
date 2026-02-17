/**
 * Layer 4: Suggested Next Steps — horizontal action rows.
 * Each row: emoji + title + description on left, confidence badge + CTA button on right.
 * Matches wireframe Layer 4 layout.
 */
import { Link } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { SuggestedAction } from "~/features/insights/types";

/** Map confidence to emoji for the left side */
const CONFIDENCE_EMOJI: Record<string, string> = {
  high: "\uD83D\uDD34",
  medium: "\uD83D\uDFE1",
  low: "\uD83D\uDFE2",
};

/** Map confidence to badge styling */
const CONFIDENCE_BADGE_STYLES: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
  medium:
    "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400",
  low: "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400",
};

/** Map confidence to human label */
const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium",
  low: "Low",
};

interface ActionsPanelProps {
  actions: SuggestedAction[];
}

export function ActionsPanel({ actions }: ActionsPanelProps) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      {actions.slice(0, 3).map((action, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3.5 transition-colors hover:border-foreground/20"
        >
          {/* Left: emoji + text */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0" role="img" aria-hidden>
              {CONFIDENCE_EMOJI[action.confidence] ?? "\uD83D\uDCCB"}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">
                {action.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {action.description}
              </p>
            </div>
          </div>

          {/* Right: confidence badge + CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className={cn(
                "hidden sm:inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium border",
                CONFIDENCE_BADGE_STYLES[action.confidence] ??
                  CONFIDENCE_BADGE_STYLES.low,
              )}
            >
              {CONFIDENCE_LABEL[action.confidence] ?? "Low"}
            </span>
            {action.href ? (
              <Button variant="default" size="sm" asChild className="text-xs">
                <Link to={action.href}>
                  {action.cta} <span aria-hidden>&rarr;</span>
                </Link>
              </Button>
            ) : (
              <Button variant="default" size="sm" className="text-xs" disabled>
                {action.cta} <span aria-hidden>&rarr;</span>
              </Button>
            )}
          </div>
        </div>
      ))}

      {/* Share Discovery Brief placeholder */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed bg-card p-3.5 opacity-60">
        <div className="flex items-center gap-3">
          <span className="text-lg" role="img" aria-hidden>
            {"\uD83D\uDCCB"}
          </span>
          <div>
            <p className="font-semibold text-sm text-foreground">
              Share Discovery Brief
            </p>
            <p className="text-xs text-muted-foreground">
              Compile themes, evidence, and gaps into a shareable view
            </p>
          </div>
        </div>
        <Button variant="default" size="sm" className="text-xs" disabled>
          Generate Link <span aria-hidden>&rarr;</span>
        </Button>
      </div>
    </div>
  );
}
