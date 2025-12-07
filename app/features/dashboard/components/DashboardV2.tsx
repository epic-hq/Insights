/**
 * DashboardV2 - Main dashboard component with state-aware UI
 *
 * Adapts display based on project state:
 * - Empty: Shows onboarding cards
 * - Processing: Shows progress indicator
 * - Has Data: Shows lens results and AI insights
 */

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { AiInsightCard } from "./AiInsightCard"
import { EmptyState } from "./EmptyState"
import { LensResultsGrid, type LensSummary } from "./LensResultsGrid"
import { ProcessingState, type ProcessingItem } from "./ProcessingState"
import { QuickActionsBar } from "./QuickActionsBar"

export interface DashboardV2Props {
	/** Project name */
	projectName: string
	/** Project ID */
	projectId: string
	/** Account ID */
	accountId: string
	/** Total number of conversations */
	conversationCount: number
	/** Number of active/enabled lenses */
	activeLensCount: number
	/** Lens summaries for display */
	lenses: LensSummary[]
	/** Processing items (if any) */
	processingItems?: ProcessingItem[]
	/** Number of items currently processing */
	processingCount?: number
	/** Whether project has goals set up */
	hasGoals?: boolean
	/** AI insight to display (if any) */
	aiInsight?: string
	/** Route helpers */
	routes: {
		setup: string
		interviews: string
		lensLibrary: string
		upload: string
	}
	/** Callback when AI chat is opened */
	onOpenChat?: () => void
	/** Additional CSS classes */
	className?: string
}

type ProjectState = "empty" | "processing" | "hasData"

function getProjectState(
	conversationCount: number,
	processingCount: number
): ProjectState {
	if (conversationCount === 0 && processingCount === 0) {
		return "empty"
	}
	if (processingCount > 0) {
		return "processing"
	}
	return "hasData"
}

export function DashboardV2({
	projectName,
	projectId,
	accountId,
	conversationCount,
	activeLensCount,
	lenses,
	processingItems,
	processingCount = 0,
	hasGoals = false,
	aiInsight,
	routes,
	onOpenChat,
	className,
}: DashboardV2Props) {
	const projectState = getProjectState(conversationCount, processingCount)

	return (
		<div className={cn("space-y-6", className)}>
			{/* Project Header */}
			<header className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<h1 className="text-xl font-semibold text-foreground truncate">
							{projectName}
						</h1>
						<Button
							asChild
							variant="ghost"
							size="icon"
							className="h-7 w-7 flex-shrink-0"
						>
							<Link to={routes.setup}>
								<Pencil className="h-3.5 w-3.5" />
								<span className="sr-only">Edit project</span>
							</Link>
						</Button>
					</div>
					{projectState !== "empty" && (
						<p className="text-sm text-muted-foreground mt-0.5">
							{conversationCount} conversation{conversationCount !== 1 ? "s" : ""}
							{activeLensCount > 0 && ` · ${activeLensCount} lens${activeLensCount !== 1 ? "es" : ""} active`}
						</p>
					)}
				</div>
			</header>

			{/* State-aware content */}
			{projectState === "empty" ? (
				<EmptyState
					projectName={projectName}
					goalsHref={routes.setup}
					uploadHref={routes.upload}
					hasGoals={hasGoals}
				/>
			) : (
				<>
					{/* Processing indicator */}
					{projectState === "processing" && (
						<ProcessingState
							processingCount={processingCount}
							totalCount={conversationCount + processingCount}
							items={processingItems}
						/>
					)}

					{/* Lens Results */}
					{lenses.length > 0 && (
						<LensResultsGrid
							lenses={lenses}
							lensLibraryHref={routes.lensLibrary}
						/>
					)}

					{/* AI Insight */}
					{aiInsight && (
						<AiInsightCard
							insight={aiInsight}
							source={`${conversationCount} conversations`}
							onAskFollowUp={onOpenChat}
						/>
					)}

					{/* Quick Actions */}
					<QuickActionsBar
						goalsHref={routes.setup}
						lensLibraryHref={routes.lensLibrary}
						uploadHref={routes.upload}
						projectState={projectState}
					/>
				</>
			)}
		</div>
	)
}

export default DashboardV2
