/**
 * ActiveDashboard - Populated dashboard for active projects
 *
 * Displayed when project has conversations and analysis data.
 * Shows tasks, insights, lens feed, and project context.
 */

import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid"
import type { Task } from "~/features/tasks/types"
import { cn } from "~/lib/utils"
import type { Insight } from "~/types"
import { ContextPanel } from "./sections/ContextPanel"
import { InsightsSection } from "./sections/InsightsSection"
import { type LensActivityItem, LensFeed } from "./sections/LensFeed"
import { TasksSection } from "./sections/TasksSection"

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
	/** Recent lens activity for feed */
	recentActivity?: LensActivityItem[]
	/** Project research goal */
	researchGoal?: string
	/** Total conversation count */
	conversationCount: number
	/** Number of active lenses */
	activeLensCount: number
	/** Additional CSS classes */
	className?: string
}

export function ActiveDashboard({
	projectName,
	projectPath,
	tasks,
	insights,
	lenses,
	recentActivity,
	researchGoal,
	conversationCount,
	activeLensCount,
	className,
}: ActiveDashboardProps) {
	return (
		<div className={cn("", className)}>
			{/* Page Header */}
			<header className="mb-8">
				<h1 className="font-semibold text-2xl text-foreground">{projectName}</h1>
				<p className="text-muted-foreground text-sm">
					{conversationCount} conversation{conversationCount !== 1 ? "s" : ""}
					{activeLensCount > 0 && ` | ${activeLensCount} lens${activeLensCount !== 1 ? "es" : ""} active`}
				</p>
			</header>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr,280px]">
				{/* Main Content */}
				<div className="space-y-8">
					<TasksSection tasks={tasks} projectPath={projectPath} />
					<InsightsSection insights={insights} projectPath={projectPath} />
					<LensFeed lenses={lenses} recentActivity={recentActivity} projectPath={projectPath} />
				</div>

				{/* Context Sidebar (desktop) */}
				<div className="hidden lg:block">
					<div className="sticky top-6">
						<ContextPanel
							researchGoal={researchGoal}
							conversationCount={conversationCount}
							activeLensCount={activeLensCount}
							projectPath={projectPath}
						/>
					</div>
				</div>
			</div>

			{/* Mobile Context (bottom) */}
			<div className="mt-8 lg:hidden">
				<ContextPanel
					researchGoal={researchGoal}
					conversationCount={conversationCount}
					activeLensCount={activeLensCount}
					projectPath={projectPath}
				/>
			</div>
		</div>
	)
}

export default ActiveDashboard
