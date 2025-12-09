/**
 * TasksSection - Dashboard section showing top priority tasks
 *
 * Displays up to 3 high-priority tasks with status indicators.
 * Links to full tasks page for management.
 */

import { CheckSquare } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import type { Task, TaskStatus } from "~/features/tasks/types"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { EmptyStateBox } from "../shared/EmptyStateBox"
import { SectionHeader } from "../shared/SectionHeader"

export interface TasksSectionProps {
	/** Array of tasks to display */
	tasks: Task[]
	/** Base path for project routes */
	projectPath: string
	/** Maximum number of tasks to show */
	maxVisible?: number
	/** Additional CSS classes */
	className?: string
}

interface TaskPreviewCardProps {
	task: Task
	prioritiesHref: string
}

const priorityConfig = {
	3: { label: "High", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
	2: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
	1: { label: "Low", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
}

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
	backlog: { label: "Backlog", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
	todo: { label: "To Do", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
	in_progress: {
		label: "In Progress",
		color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
	},
	blocked: { label: "Blocked", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
	review: { label: "Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
	done: { label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
	archived: { label: "Archived", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
}

function TaskPreviewCard({ task, prioritiesHref }: TaskPreviewCardProps) {
	const priority = priorityConfig[task.priority as 1 | 2 | 3] || priorityConfig[1]
	const status = statusConfig[task.status as TaskStatus] || statusConfig.backlog

	return (
		<Link to={prioritiesHref}>
			<Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm">
				<CardContent className="p-4">
					{/* Priority & Status badges */}
					<div className="mb-3 flex items-center gap-2">
						<Badge className={cn("text-xs", priority.color)}>{priority.label}</Badge>
						<Badge variant="outline" className="text-xs">
							{status.label}
						</Badge>
					</div>

					{/* Task title */}
					<h3 className="mb-2 line-clamp-2 font-medium text-foreground text-sm">{task.title}</h3>

					{/* Benefit preview */}
					{task.benefit && <p className="line-clamp-2 text-muted-foreground text-xs">{task.benefit}</p>}
				</CardContent>
			</Card>
		</Link>
	)
}

export function TasksSection({ tasks, projectPath, maxVisible = 3, className }: TasksSectionProps) {
	const routes = useProjectRoutes(projectPath)

	// Filter out completed/archived tasks and sort by priority
	const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "archived")
	const topTasks = [...activeTasks].sort((a, b) => (b.priority || 1) - (a.priority || 1)).slice(0, maxVisible)

	// Show empty state if no tasks
	if (tasks.length === 0) {
		return (
			<section className={className}>
				<EmptyStateBox
					icon={CheckSquare}
					title="Tasks"
					message="Upload a conversation to see AI-generated action items here"
					ctaText="Add Conversation"
					ctaHref={routes.interviews.upload()}
				/>
			</section>
		)
	}

	return (
		<section className={cn("space-y-4", className)}>
			<SectionHeader title="Tasks" icon={CheckSquare} count={activeTasks.length} viewAllHref={routes.priorities()} />

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{topTasks.map((task) => (
					<TaskPreviewCard key={task.id} task={task} prioritiesHref={routes.priorities()} />
				))}
			</div>
		</section>
	)
}

export default TasksSection
