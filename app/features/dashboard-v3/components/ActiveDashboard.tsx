/**
 * ActiveDashboard - Simplified dashboard for active projects
 *
 * Layout:
 * 1. Lenses with data at top
 * 2. Prompts link
 * 3. Context settings (Account & Project)
 * 4. Top 3 insights (simplified - just main line)
 * 5. Tasks [priority: text status]
 */

import { ChevronRight, FileText, Glasses, Lightbulb, ListChecks, Settings } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid"
import { PriorityBars } from "~/features/tasks/components/PriorityBars"
import type { Task, TaskStatus } from "~/features/tasks/types"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Insight } from "~/types"
import type { ProjectContext } from "./sections/ContextPanel"

export interface ActiveDashboardProps {
	/** Project name */
	projectName: string
	/** Base path for project routes */
	projectPath: string
	/** Array of tasks */
	tasks: Task[]
	/** Array of insights */
	insights: Insight[]
	/** Array of lens summaries */
	lenses: LensSummary[]
	/** Project research goal */
	researchGoal?: string
	/** Full project context for setup progress */
	projectContext?: ProjectContext
	/** Total conversation count */
	conversationCount: number
	/** Number of active lenses */
	activeLensCount: number
	/** Hide the header (when parent provides it) */
	hideHeader?: boolean
	/** Additional CSS classes */
	className?: string
}

const statusLabels: Record<TaskStatus, string> = {
	backlog: "Backlog",
	todo: "To Do",
	in_progress: "In Progress",
	blocked: "Blocked",
	done: "Done",
	archived: "Archived",
}

export function ActiveDashboard({
	projectName,
	projectPath,
	tasks,
	insights,
	lenses,
	researchGoal,
	conversationCount,
	hideHeader,
	className,
}: ActiveDashboardProps) {
	const routes = useProjectRoutes(projectPath)

	// Extract accountId from projectPath (format: /a/{accountId}/{projectId})
	const pathParts = projectPath.split("/")
	const accountId = pathParts[2] // /a/{accountId}/...

	// Filter lenses with data
	const lensesWithData = lenses.filter((l) => l.hasData)

	// Filter active tasks
	const activeTasks = tasks
		.filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "backlog")
		.slice(0, 5)

	// Top insights
	const topInsights = [...insights]
		.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
		.slice(0, 3)

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			{!hideHeader && (
				<header>
					<h1 className="font-semibold text-2xl text-foreground">{projectName}</h1>
					<p className="text-muted-foreground text-sm">
						{conversationCount} conversation
						{conversationCount !== 1 ? "s" : ""}
					</p>
				</header>
			)}

			{/* 1. Lenses with Data */}
			{lensesWithData.length > 0 && (
				<section>
					<div className="mb-3 flex items-center gap-2">
						<Glasses className="h-4 w-4 text-muted-foreground" />
						<h2 className="font-medium text-sm">Lens Summaries</h2>
					</div>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{lensesWithData.map((lens) => (
							<Link key={lens.templateKey} to={lens.href}>
								<Card surface="glass" className="transition-all hover:border-primary/30">
									<CardContent className="flex items-center justify-between p-3">
										<div className="flex items-center gap-2">
											<span className="font-medium text-sm">{lens.name}</span>
											<Badge variant="secondary" className="text-xs">
												{lens.conversationCount}
											</Badge>
										</div>
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* 2. Prompts Link */}
			<section>
				<Link to={routes.questions.index()}>
					<Card surface="soft" className="transition-all hover:border-primary/30">
						<CardContent className="flex items-center justify-between p-4">
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
									<ListChecks className="h-5 w-5 text-primary" />
								</div>
								<div>
									<h3 className="font-medium text-sm">Interview Prompts</h3>
									<p className="text-muted-foreground text-xs">Questions and prompts for conversations</p>
								</div>
							</div>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						</CardContent>
					</Card>
				</Link>
			</section>

			{/* 3. Context Settings Links */}
			<section>
				<div className="mb-3 flex items-center gap-2">
					<Settings className="h-4 w-4 text-muted-foreground" />
					<h2 className="font-medium text-sm">Context Settings</h2>
				</div>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<Link to={`${projectPath}/setup`}>
						<Card surface="muted" className="transition-all hover:border-primary/30">
							<CardContent className="flex items-center justify-between p-3">
								<div className="flex items-center gap-2">
									<FileText className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Project Context</span>
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</CardContent>
						</Card>
					</Link>
					<Link to={`/a/${accountId}/settings`}>
						<Card surface="muted" className="transition-all hover:border-primary/30">
							<CardContent className="flex items-center justify-between p-3">
								<div className="flex items-center gap-2">
									<Settings className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Account Settings</span>
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</CardContent>
						</Card>
					</Link>
				</div>
			</section>

			{/* 4 & 5. Insights + Tasks - 2 columns, top 3 each */}
			{(topInsights.length > 0 || activeTasks.length > 0) && (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					{/* Top 3 Insights */}
					<section>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Lightbulb className="h-4 w-4 text-muted-foreground" />
								<h2 className="font-medium text-sm">Insights</h2>
								{insights.length > 0 && (
									<Badge variant="outline" className="text-xs">
										{insights.length}
									</Badge>
								)}
							</div>
							{insights.length > 3 && (
								<Link to={routes.themes.index()} className="text-muted-foreground text-xs hover:text-foreground">
									View all
								</Link>
							)}
						</div>
						{topInsights.length > 0 ? (
							<div className="space-y-1">
								{topInsights.map((insight) => (
									<Link key={insight.id} to={routes.insights.detail(insight.id)}>
										<div className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
											<PriorityBars priority={((insight as any).priority ?? 3) as 1 | 2 | 3} size="sm" />
											<span className="flex-1 truncate text-sm">{insight.name || "Untitled Insight"}</span>
										</div>
									</Link>
								))}
							</div>
						) : (
							<p className="px-3 py-2 text-muted-foreground text-sm">No insights yet</p>
						)}
					</section>

					{/* Top 3 Tasks */}
					<section>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<ListChecks className="h-4 w-4 text-muted-foreground" />
								<h2 className="font-medium text-sm">Tasks</h2>
								{activeTasks.length > 0 && (
									<Badge variant="outline" className="text-xs">
										{activeTasks.length}
									</Badge>
								)}
							</div>
							{tasks.length > 3 && (
								<Link to={routes.priorities()} className="text-muted-foreground text-xs hover:text-foreground">
									View all
								</Link>
							)}
						</div>
						{activeTasks.length > 0 ? (
							<div className="space-y-1">
								{activeTasks.slice(0, 3).map((task) => (
									<Link key={task.id} to={routes.tasks.detail(task.id)}>
										<div className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
											<PriorityBars priority={task.priority || 1} size="sm" />
											<span className="flex-1 truncate text-sm">{task.title}</span>
											<Badge
												variant="outline"
												className={cn(
													"text-xs",
													task.status === "in_progress" && "border-blue-300 bg-blue-50 text-blue-700",
													task.status === "blocked" && "border-red-300 bg-red-50 text-red-700",
													task.status === "todo" && "border-slate-300 bg-slate-50 text-slate-700"
												)}
											>
												{statusLabels[task.status as TaskStatus] || task.status}
											</Badge>
										</div>
									</Link>
								))}
							</div>
						) : (
							<p className="px-3 py-2 text-muted-foreground text-sm">No active tasks</p>
						)}
					</section>
				</div>
			)}
		</div>
	)
}

export default ActiveDashboard
