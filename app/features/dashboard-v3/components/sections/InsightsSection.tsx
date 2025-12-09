/**
 * InsightsSection - Dashboard section showing recent insights
 *
 * Displays up to 3 most recent AI-discovered insights.
 * Links directly to individual insight detail pages.
 */

import { Lightbulb, Quote } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Insight } from "~/types"
import { EmptyStateBox } from "../shared/EmptyStateBox"
import { SectionHeader } from "../shared/SectionHeader"

export interface InsightsSectionProps {
	/** Array of insights to display */
	insights: Insight[]
	/** Base path for project routes */
	projectPath: string
	/** Maximum number of insights to show */
	maxVisible?: number
	/** Additional CSS classes */
	className?: string
}

interface InsightPreviewCardProps {
	insight: Insight
	detailHref: string
}

function InsightPreviewCard({ insight, detailHref }: InsightPreviewCardProps) {
	const evidenceCount = (insight as any).evidence_count || 0

	return (
		<Link to={detailHref}>
			<Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm">
				<CardContent className="p-4">
					{/* Category & Evidence count */}
					<div className="mb-3 flex items-center justify-between">
						{(insight as any).category && (
							<Badge variant="secondary" className="text-xs">
								{(insight as any).category}
							</Badge>
						)}
						{evidenceCount > 0 && (
							<Badge variant="outline" className="gap-1 text-xs">
								<Quote className="h-3 w-3" />
								{evidenceCount}
							</Badge>
						)}
					</div>

					{/* Insight name */}
					<h3 className="mb-2 line-clamp-2 font-medium text-foreground text-sm">
						{insight.name || "Untitled Insight"}
					</h3>

					{/* Pain or statement preview */}
					{((insight as any).pain || (insight as any).statement) && (
						<p className="line-clamp-2 text-muted-foreground text-xs">
							{(insight as any).pain || (insight as any).statement}
						</p>
					)}
				</CardContent>
			</Card>
		</Link>
	)
}

export function InsightsSection({ insights, projectPath, maxVisible = 3, className }: InsightsSectionProps) {
	const routes = useProjectRoutes(projectPath)

	// Sort by creation date (newest first)
	const sortedInsights = [...insights].sort(
		(a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
	)
	const topInsights = sortedInsights.slice(0, maxVisible)

	// Show empty state if no insights
	if (insights.length === 0) {
		return (
			<section className={className}>
				<EmptyStateBox
					icon={Lightbulb}
					title="Insights"
					message="Upload a conversation to see AI-discovered patterns and themes here"
					ctaText="Add Conversation"
					ctaHref={routes.interviews.upload()}
				/>
			</section>
		)
	}

	return (
		<section className={cn("space-y-4", className)}>
			<SectionHeader title="Insights" icon={Lightbulb} count={insights.length} viewAllHref={routes.themes.index()} />

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{topInsights.map((insight) => (
					<InsightPreviewCard key={insight.id} insight={insight} detailHref={routes.themes.detail(insight.id)} />
				))}
			</div>
		</section>
	)
}

export default InsightsSection
