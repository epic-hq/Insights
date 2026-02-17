/**
 * GitHub-style dot grid showing person coverage per theme.
 * Filled squares use the theme's signal color, empty squares are muted.
 */
import { cn } from "~/lib/utils";

const LEVEL_COLORS = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
} as const;

interface BreadthGridProps {
  covered: number;
  total: number;
  level: "high" | "medium" | "low";
  size?: "default" | "compact";
}

export function BreadthGrid({
  covered,
  total,
  level,
  size = "default",
}: BreadthGridProps) {
  if (total === 0) return null;

  const squareSize = size === "compact" ? "h-2 w-2" : "h-3 w-3";
  const gap = size === "compact" ? "gap-0.5" : "gap-1";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex flex-wrap", gap)}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-sm",
              squareSize,
              i < covered ? LEVEL_COLORS[level] : "bg-muted/30",
            )}
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs">
        {covered}/{total}
      </span>
    </div>
  );
}
