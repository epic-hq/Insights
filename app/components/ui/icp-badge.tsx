/**
 * IcpBadge - Color-coded ICP match display.
 * Shows band (Strong/Moderate/Weak) and optional score percentage.
 */

import { cn } from "~/lib/utils";

interface IcpBadgeProps {
  band: string | null;
  score?: number | null;
  confidence?: number | null;
  className?: string;
}

const BAND_STYLES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  strong: {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  moderate: {
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
  },
  weak: {
    bg: "bg-rose-50 dark:bg-rose-950",
    border: "border-rose-200 dark:border-rose-800",
    text: "text-rose-700 dark:text-rose-400",
  },
};

function getBandStyle(band: string | null) {
  if (!band) return null;
  const key = band.toLowerCase();
  return BAND_STYLES[key] ?? null;
}

export function IcpBadge({ band, score, className }: IcpBadgeProps) {
  const style = getBandStyle(band);

  if (!style) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted px-4 py-2.5 text-center",
          className,
        )}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          ICP Match
        </div>
        <div className="font-medium text-muted-foreground text-sm">
          Unscored
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2.5 text-center",
        style.bg,
        style.border,
        className,
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          style.text,
        )}
      >
        ICP Match
      </div>
      <div className={cn("font-bold text-base", style.text)}>{band}</div>
      {score != null && (
        <div className="mt-0.5 text-muted-foreground text-[11px]">
          Score: {Math.round(score * 100)}%
        </div>
      )}
    </div>
  );
}
