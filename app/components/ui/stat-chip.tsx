/**
 * StatChip - Compact count display chip for activity metrics.
 * Shows icon + count + label. Ghost variant when count is zero.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface StatChipProps {
	icon: LucideIcon;
	count: number;
	label: string;
	className?: string;
}

export function StatChip({ icon: Icon, count, label, className }: StatChipProps) {
	const isGhost = count === 0;

	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
				isGhost ? "border-border/50 border-dashed opacity-40" : "border-border bg-muted/50 hover:bg-muted",
				className
			)}
		>
			<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
			<span className="font-bold text-foreground">{count}</span>
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	);
}
