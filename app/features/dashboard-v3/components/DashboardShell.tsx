/**
 * DashboardShell - State-aware layout wrapper for dashboard
 *
 * Determines dashboard state (empty/processing/active) and renders
 * the appropriate dashboard variant. Controls sidebar visibility.
 */

import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid"
import type { ProcessingItem } from "~/features/dashboard/components/ProcessingState"
import { ProcessingState } from "~/features/dashboard/components/ProcessingState"
import type { Task } from "~/features/tasks/types"
import { cn } from "~/lib/utils"
import type { Insight } from "~/types"
import { ActiveDashboard } from "./ActiveDashboard"
import { OnboardingDashboard } from "./OnboardingDashboard"
import type { LensActivityItem } from "./sections/LensFeed"

export type DashboardState = "empty" | "processing" | "active"

export interface DashboardShellProps {
	/** Project name */
	projectName: string
	/** Base path for project routes */
	projectPath: string
	/** Total conversation count */
	conversationCount: number
	/** Number of items currently processing */
	processingCount: number
	/** Processing items for display */
	processingItems?: ProcessingItem[]
	/** Number of active lenses */
	activeLensCount: number
	/** Whether goals have been set up */
	hasGoals: boolean
	/** Whether lenses have been configured */
	hasLenses: boolean
	/** Project research goal text */
	researchGoal?: string
	/** Array of tasks */
	tasks: Task[]
	/** Array of insights */
	insights: Insight[]
	/** Array of lens summaries */
	lenses: LensSummary[]
	/** Recent lens activity for feed */
	recentActivity?: LensActivityItem[]
	/** Additional CSS classes */
	className?: string
}

/**
 * Determines the dashboard state based on data availability
 */
function getDashboardState(conversationCount: number, processingCount: number, _hasGoals: boolean): DashboardState {
	// Empty: No conversations and no processing
	if (conversationCount === 0 && processingCount === 0) {
		return "empty"
	}

	// Processing: Has items being processed
	if (processingCount > 0) {
		return "processing"
	}

	// Active: Has data
	return "active"
}

/**
 * Determines if sidebar should be shown based on state
 */
export function shouldShowSidebar(state: DashboardState, hasGoals: boolean): boolean {
	// Empty state without goals: Hide sidebar for cleaner onboarding
	if (state === "empty" && !hasGoals) {
		return false
	}

	// All other states: Show sidebar
	return true
}

export function DashboardShell({
	projectName,
	projectPath,
	conversationCount,
	processingCount,
	processingItems,
	activeLensCount,
	hasGoals,
	hasLenses,
	researchGoal,
	tasks,
	insights,
	lenses,
	recentActivity,
	className,
}: DashboardShellProps) {
	const state = getDashboardState(conversationCount, processingCount, hasGoals)

	return (
		<div className={cn("py-6", className)}>
			{/* Empty State: Onboarding Dashboard */}
			{state === "empty" && (
				<OnboardingDashboard
					projectName={projectName}
					projectPath={projectPath}
					hasGoals={hasGoals}
					hasLenses={hasLenses}
				/>
			)}

			{/* Processing State: Show progress + partial dashboard */}
			{state === "processing" && (
				<div className="space-y-8">
					<header>
						<h1 className="font-semibold text-2xl text-foreground">{projectName}</h1>
						<p className="text-muted-foreground text-sm">Processing your conversations...</p>
					</header>

					<ProcessingState
						processingCount={processingCount}
						totalCount={conversationCount + processingCount}
						items={processingItems}
					/>

					{/* Show partial dashboard if we have some data */}
					{conversationCount > 0 && (
						<ActiveDashboard
							projectName={projectName}
							projectPath={projectPath}
							tasks={tasks}
							insights={insights}
							lenses={lenses}
							recentActivity={recentActivity}
							researchGoal={researchGoal}
							conversationCount={conversationCount}
							activeLensCount={activeLensCount}
						/>
					)}
				</div>
			)}

			{/* Active State: Full Dashboard */}
			{state === "active" && (
				<ActiveDashboard
					projectName={projectName}
					projectPath={projectPath}
					tasks={tasks}
					insights={insights}
					lenses={lenses}
					recentActivity={recentActivity}
					researchGoal={researchGoal}
					conversationCount={conversationCount}
					activeLensCount={activeLensCount}
				/>
			)}
		</div>
	)
}

export default DashboardShell
