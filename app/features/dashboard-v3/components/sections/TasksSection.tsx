/**
 * TasksSection - Dashboard section showing top priority tasks
 *
 * Displays up to 3 high-priority tasks (non-completed) with status indicators.
 * Tasks are sorted by priority (highest first).
 * Clicking a card navigates to the task detail page.
 * Status can be changed inline via dropdown.
 */

import { CheckSquare } from "lucide-react"
import { useMemo } from "react"
import { Link, useFetcher } from "react-router"
import { Streamdown } from "streamdown"
import { Card, CardContent } from "~/components/ui/card"
import { PriorityBars } from "~/features/tasks/components/PriorityBars"
import { StatusDropdown } from "~/features/tasks/components/TaskStatus"
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
	detailHref: string
}

function TaskPreviewCard({ task, detailHref }: TaskPreviewCardProps) {
	const fetcher = useFetcher()

	// Get optimistic status while update is in flight
	const displayStatus = useMemo(() => {
		if (fetcher.formData) {
			const status = fetcher.formData.get("status")
			if (status) return status as TaskStatus
		}
		return task.status as TaskStatus
	}, [fetcher.formData, task.status])

	const handleStatusChange = (_taskId: string, newStatus: TaskStatus) => {
		if (newStatus === task.status) return

		const formData = new FormData()
		formData.append("_action", "update-task-status")
		formData.append("taskId", task.id)
		formData.append("status", newStatus)

		// Post to current page's action (no explicit action URL)
		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<Link to={detailHref}>
			<Card surface="elevated" className="h-full transition-all hover:border-primary/40 hover:shadow-md">
				<CardContent className="p-4">
					{/* Title & Status on same row */}
					<div className="mb-2 flex items-start justify-between gap-2">
						<h3 className="line-clamp-2 flex-1 font-medium text-foreground text-sm">{task.title}</h3>
						<StatusDropdown
							currentStatus={displayStatus}
							onStatusChange={handleStatusChange}
							taskId={task.id}
							iconOnly
						/>
					</div>

					{/* Benefit with priority bar at start */}
					{task.benefit && (
						<div className="flex items-start gap-2">
							<div className="mt-1 flex-shrink-0">
								<PriorityBars priority={task.priority || 1} size="sm" />
							</div>
							<p className="line-clamp-2 text-muted-foreground text-xs">{task.benefit}</p>
						</div>
					)}

					{task.description && (
						<div className="mt-2">
							<Streamdown className="line-clamp-3 text-muted-foreground text-xs">{task.description}</Streamdown>
						</div>
					)}

					{/* Show priority bars alone if no benefit */}
					{!task.benefit && task.priority && (
						<div className="flex items-center gap-2">
							<PriorityBars priority={task.priority} size="sm" />
						</div>
					)}
				</CardContent>
			</Card>
		</Link>
	)
}

export function TasksSection({ tasks, projectPath, maxVisible = 3, className }: TasksSectionProps) {
	const routes = useProjectRoutes(projectPath)

	// Filter out non-focus tasks (done/archived/backlog). Ordering is handled server-side.
	const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "backlog")
	const topTasks = activeTasks.slice(0, maxVisible)

	// Show empty state if no tasks
	if (tasks.length === 0) {
		return (
			<section className={className}>
				<EmptyStateBox
					icon={CheckSquare}
					title="Tasks"
					message="AI will automatically detect and add tasks from conversations. Or add your own."
					ctaText="Add Task"
					ctaHref={routes.tasks.new()}
				/>
			</section>
		)
	}

	return (
		<section className={cn("space-y-4", className)}>
			<SectionHeader
				title="Tasks"
				icon={CheckSquare}
				tooltip="Action items and next steps extracted from your conversations. Prioritize and track progress here."
				count={activeTasks.length}
				viewAllHref={routes.priorities()}
			/>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{topTasks.map((task) => (
					<TaskPreviewCard key={task.id} task={task} detailHref={routes.tasks.detail(task.id)} />
				))}
			</div>
		</section>
	)
}

export default TasksSection
