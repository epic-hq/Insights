/**
 * PriorityBars - Reusable priority bar chart component for tasks
 *
 * Displays a 3-bar chart indicating priority level:
 * - 3 = High (all bars filled, emerald)
 * - 2 = Medium (2 bars filled, amber)
 * - 1 = Low (1 bar filled, slate)
 */

import { cn } from "~/lib/utils"

/** Priority configuration */
export const priorityConfig = {
	3: { label: "High", color: "bg-emerald-600" },
	2: { label: "Medium", color: "bg-amber-600" },
	1: { label: "Low", color: "bg-slate-600" },
}

interface PriorityBarsProps {
	priority: number
	/** Size variant */
	size?: "sm" | "default" | "lg"
	/** Show text label next to bars */
	showLabel?: boolean
	className?: string
}

/** Renders a priority bar chart */
export function PriorityBars({ priority, size = "default", showLabel = false, className }: PriorityBarsProps) {
	const config = priorityConfig[priority as 1 | 2 | 3] || priorityConfig[1]
	const color = config.color
	const mutedColor = "bg-muted-foreground/30"

	// Size variants
	const sizeClasses = {
		sm: { bar1: "h-2 w-0.5", bar2: "h-2.5 w-0.5", bar3: "h-3 w-0.5", gap: "gap-0.5" },
		default: { bar1: "h-2.5 w-1", bar2: "h-3 w-1", bar3: "h-3.5 w-1", gap: "gap-0.5" },
		lg: { bar1: "h-3 w-1.5", bar2: "h-4 w-1.5", bar3: "h-5 w-1.5", gap: "gap-1" },
	}

	const s = sizeClasses[size]

	const bars = (
		<div className={cn("flex items-end", s.gap)} title={`${config.label} priority`}>
			<div className={cn("rounded-sm", s.bar1, color)} />
			<div className={cn("rounded-sm", s.bar2, priority >= 2 ? color : mutedColor)} />
			<div className={cn("rounded-sm", s.bar3, priority >= 3 ? color : mutedColor)} />
		</div>
	)

	if (showLabel) {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				{bars}
				<span className="text-muted-foreground text-xs">{config.label}</span>
			</div>
		)
	}

	return <div className={className}>{bars}</div>
}

interface PrioritySelectProps {
	priority: number
	taskId: string
	onPriorityChange?: (taskId: string, newPriority: number) => void
	className?: string
}

/** Interactive priority selector with bar visualization */
export function PrioritySelect({ priority, taskId, onPriorityChange, className }: PrioritySelectProps) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			{[1, 2, 3].map((p) => (
				<button
					key={p}
					type="button"
					onClick={() => onPriorityChange?.(taskId, p)}
					className={cn(
						"rounded p-1 transition-colors hover:bg-muted",
						priority === p && "bg-muted ring-1 ring-primary/20"
					)}
					title={`${priorityConfig[p as 1 | 2 | 3].label} priority`}
				>
					<PriorityBars priority={p} size="sm" />
				</button>
			))}
		</div>
	)
}
