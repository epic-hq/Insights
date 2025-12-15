/**
 * TaskStatus - Reusable status display components for tasks
 *
 * Provides consistent status icons and colors across all task views.
 */

import { Archive, Check, ChevronDown, Circle, CircleDashed, Clock, Pause, Play } from "lucide-react"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { cn } from "~/lib/utils"
import type { TaskStatus } from "../types"

/** Status configuration with icons and colors */
export const statusConfig: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
	backlog: { label: "Backlog", icon: CircleDashed, color: "text-slate-500" },
	todo: { label: "To Do", icon: Circle, color: "text-blue-500" },
	in_progress: { label: "In Progress", icon: Play, color: "text-purple-500" },
	blocked: { label: "Blocked", icon: Pause, color: "text-red-500" },
	review: { label: "In Review", icon: Clock, color: "text-amber-500" },
	done: { label: "Done", icon: Check, color: "text-green-500" },
	archived: { label: "Archived", icon: Archive, color: "text-gray-400" },
}

interface StatusIconProps {
	status: TaskStatus
	className?: string
	showLabel?: boolean
}

/** Renders a status icon with optional label */
export function StatusIcon({ status, className, showLabel = false }: StatusIconProps) {
	const config = statusConfig[status] || statusConfig.backlog
	const Icon = config.icon

	if (showLabel) {
		return (
			<span className={cn("inline-flex items-center gap-1.5", className)}>
				<Icon className={cn("h-3.5 w-3.5", config.color)} />
				<span className={cn("text-xs", config.color)}>{config.label}</span>
			</span>
		)
	}

	return <Icon className={cn("h-3.5 w-3.5", config.color, className)} />
}

interface StatusBadgeProps {
	status: TaskStatus
	className?: string
}

/** Renders a status badge with icon and label */
export function StatusBadge({ status, className }: StatusBadgeProps) {
	const config = statusConfig[status] || statusConfig.backlog
	const Icon = config.icon

	return (
		<span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs", className)}>
			<Icon className={cn("h-3.5 w-3.5", config.color)} />
			<span className={config.color}>{config.label}</span>
		</span>
	)
}

interface StatusDropdownProps {
	currentStatus: TaskStatus
	taskId: string
	onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
	/** Size variant */
	size?: "sm" | "default"
	/** Show only icon on trigger (dropdown still shows icon + text) */
	iconOnly?: boolean
	className?: string
}

/** Dropdown to change task status */
export function StatusDropdown({
	currentStatus,
	taskId,
	onStatusChange,
	size = "sm",
	iconOnly = false,
	className,
}: StatusDropdownProps) {
	const config = statusConfig[currentStatus] || statusConfig.backlog
	const StatusIconComponent = config.icon

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
				<Button
					variant="ghost"
					size={iconOnly ? "icon" : size}
					className={cn(
						iconOnly ? "h-7 w-7 p-0" : "gap-1.5",
						!iconOnly && (size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"),
						className
					)}
					title={config.label}
				>
					<StatusIconComponent className={cn(iconOnly ? "h-4 w-4" : "h-3.5 w-3.5", config.color)} />
					{!iconOnly && (
						<>
							{config.label}
							<ChevronDown className="h-3 w-3 opacity-50" />
						</>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
				{Object.entries(statusConfig).map(([status, cfg]) => {
					const Icon = cfg.icon
					return (
						<DropdownMenuItem
							key={status}
							onClick={() => onStatusChange?.(taskId, status as TaskStatus)}
							className={currentStatus === status ? "bg-muted" : ""}
						>
							<Icon className={cn("mr-2 h-3.5 w-3.5", cfg.color)} />
							{cfg.label}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
