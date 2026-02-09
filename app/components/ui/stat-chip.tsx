/**
 * StatChip - Compact count display chip for activity metrics.
 * Shows icon + count + label. Ghost variant when count is zero.
 */

import { cn } from "~/lib/utils";

interface StatChipProps {
  icon: string;
  count: number;
  label: string;
  className?: string;
}

export function StatChip({ icon, count, label, className }: StatChipProps) {
  const isGhost = count === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
        isGhost
          ? "border-dashed border-border/50 opacity-40"
          : "border-border bg-muted/50 hover:bg-muted",
        className,
      )}
    >
      <span className="text-base">{icon}</span>
      <span className="font-bold text-foreground">{count}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
