/**
 * LensFeed - Dashboard section showing lens analysis results
 *
 * Two sections:
 * 1. Activity Feed - Recent lens analysis completions (Twitter-style)
 * 2. Lens Library - Links to aggregation pages for each lens type
 */

import { Activity, ChevronRight, Clock, Glasses, Sparkles } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { EmptyStateBox } from "../shared/EmptyStateBox"
import { SectionHeader } from "../shared/SectionHeader"

/** Activity feed item representing a recent lens analysis completion */
export interface LensActivityItem {
	id: string
	interviewId: string
	interviewTitle: string
	templateKey: string
	templateName: string
	category: string
	keyTakeaway: string | null
	processedAt: string
}

export interface LensFeedProps {
	/** Array of lens summaries to display */
	lenses: LensSummary[]
	/** Recent lens activity items */
	recentActivity?: LensActivityItem[]
	/** Base path for project routes */
	projectPath: string
	/** Maximum number of lenses to show in library */
	maxVisibleLenses?: number
	/** Maximum number of activity items to show */
	maxVisibleActivity?: number
	/** Additional CSS classes */
	className?: string
}

interface LensLibraryItemProps {
	lens: LensSummary
}

interface ActivityFeedItemProps {
	item: LensActivityItem
	projectPath: string
}

const categoryColors: Record<string, string> = {
	sales: "text-green-600 bg-green-50 dark:bg-green-900/20",
	research: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
	product: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
	general: "text-slate-600 bg-slate-50 dark:bg-slate-800",
}

function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return "just now"
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`
	return date.toLocaleDateString()
}

function ActivityFeedItem({ item, projectPath }: ActivityFeedItemProps) {
	const routes = useProjectRoutes(projectPath)
	const colorClass = categoryColors[item.category] || categoryColors.general

	return (
		<Link to={routes.interviews.detail(item.interviewId)} className="group block">
			<Card className="transition-all hover:border-primary/30 hover:shadow-sm">
				<CardContent className="p-4">
					<div className="flex items-start gap-3">
						<div className={cn("mt-0.5 rounded-lg p-2", colorClass)}>
							<Sparkles className="h-4 w-4" />
						</div>
						<div className="min-w-0 flex-1">
							{item.keyTakeaway && <p className="mt-1 line-clamp-2 text-foreground text-sm">{item.keyTakeaway}</p>}
							<div className="flex items-center gap-2">
								<p className="mt-1.5 font-medium text-muted-foreground text-sm">{item.interviewTitle}</p>
								<Badge variant="secondary" className="bg-background/50 text-muted-foreground text-xs">
									{item.templateName}
								</Badge>
								<span className="flex items-center gap-1 text-muted-foreground text-xs">
									<Clock className="h-3 w-3" />
									{formatRelativeTime(item.processedAt)}
								</span>
							</div>
						</div>
						<ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
					</div>
				</CardContent>
			</Card>
		</Link>
	)
}

function LensLibraryItem({ lens }: LensLibraryItemProps) {
	const colorClass = categoryColors[lens.category] || categoryColors.general

	return (
		<Link
			to={lens.href}
			className={cn(
				"group flex items-center justify-between rounded-lg border bg-card px-4 py-3",
				"transition-all hover:border-primary/30 hover:bg-muted/50",
				!lens.hasData && "opacity-60"
			)}
		>
			<div className="flex items-center gap-3">
				<div className={cn("rounded-lg p-1.5", colorClass)}>
					<Glasses className="h-3.5 w-3.5" />
				</div>
				<div>
					<h4 className="font-medium text-foreground text-sm">{lens.name}</h4>
					<p className="text-muted-foreground text-xs">
						{lens.hasData ? `${lens.conversationCount} analyzed` : "No data yet"}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-2">
				{lens.hasData && (
					<Badge variant="secondary" className="text-xs">
						{lens.conversationCount}
					</Badge>
				)}
				<ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
			</div>
		</Link>
	)
}

export function LensFeed({
	lenses,
	recentActivity = [],
	projectPath,
	maxVisibleLenses = 4,
	maxVisibleActivity = 5,
	className,
}: LensFeedProps) {
	const routes = useProjectRoutes(projectPath)

	// Sort lenses: with data first, then by conversation count
	const sortedLenses = [...lenses].sort((a, b) => {
		if (a.hasData && !b.hasData) return -1
		if (!a.hasData && b.hasData) return 1
		return b.conversationCount - a.conversationCount
	})
	const visibleLenses = sortedLenses.slice(0, maxVisibleLenses)
	const visibleActivity = recentActivity.slice(0, maxVisibleActivity)

	// Show empty state if no lenses configured
	if (lenses.length === 0) {
		return (
			<section className={className}>
				<EmptyStateBox
					icon={Glasses}
					title="Lens Results"
					message="Configure lenses, then upload conversations to see structured analysis here"
					ctaText="Configure Lenses"
					ctaHref={routes.lenses.library()}
					variant="subtle"
				/>
			</section>
		)
	}

	return (
		<section className={cn("", className)}>
			{/* Two column layout: Activity on left, Lenses on right */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* Activity Feed - Recent updates */}
				<div className="space-y-4">
					<SectionHeader
						title="Recent Activity"
						icon={Activity}
						tooltip="A live feed of new conversations, notes, and insights as they happen."
						viewAllHref={routes.interviews.index()}
						viewAllText="All Conversations"
					/>
					{visibleActivity.length > 0 ? (
						<div className="space-y-3">
							{visibleActivity.slice(0, 3).map((item) => (
								<ActivityFeedItem key={item.id} item={item} projectPath={projectPath} />
							))}
						</div>
					) : (
						<p className="py-4 text-center text-muted-foreground text-sm">No recent activity</p>
					)}
				</div>

				{/* Lens Library - Links to aggregation pages */}
				<div className="space-y-4">
					<SectionHeader
						title="Conversation Lens Summaries"
						icon={Glasses}
						tooltip="Below are aggregated lens results across all project conversations. Use these summaries to quickly scan patterns by lens."
						viewAllHref={routes.lenses.library()}
						viewAllText="Available Lenses"
					/>
					<div className="space-y-2">
						{visibleLenses.map((lens) => (
							<LensLibraryItem key={lens.templateKey} lens={lens} />
						))}
					</div>

					{sortedLenses.length > maxVisibleLenses && (
						<div className="text-center">
							<Link to={routes.lenses.library()} className="text-muted-foreground text-sm hover:text-foreground">
								View {sortedLenses.length - maxVisibleLenses} more lenses
							</Link>
						</div>
					)}
				</div>
			</div>
		</section>
	)
}

export default LensFeed
