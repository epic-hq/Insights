/**
 * Analysis By Lens Tab - Aggregate view per lens type
 *
 * Shows each active lens with its synthesis summary and key takeaways.
 * Click to drill into the full aggregated lens view.
 */

import {
	Briefcase,
	CheckCircle2,
	ChevronRight,
	Clock,
	FlaskConical,
	Glasses,
	Lightbulb,
	Package,
	Sparkles,
} from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import type { LensStat, KeyTakeaway } from "../lib/loadAnalysisData.server"

type ByLensTabProps = {
	lensStats: LensStat[]
	routes: any
	projectPath: string
}

function getCategoryIcon(category: string | null) {
	switch (category) {
		case "research":
			return <FlaskConical className="h-5 w-5" />
		case "sales":
			return <Briefcase className="h-5 w-5" />
		case "product":
			return <Package className="h-5 w-5" />
		default:
			return <Sparkles className="h-5 w-5" />
	}
}

function getCategoryColor(category: string | null) {
	switch (category) {
		case "research":
			return "text-purple-600 bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300"
		case "sales":
			return "text-blue-600 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
		case "product":
			return "text-green-600 bg-green-100 dark:bg-green-950/30 dark:text-green-300"
		default:
			return "text-muted-foreground bg-muted"
	}
}

function getCategoryBadgeVariant(category: KeyTakeaway["category"]) {
	switch (category) {
		case "consensus":
			return "default" as const
		case "pattern":
			return "secondary" as const
		case "discrepancy":
			return "destructive" as const
		case "recommendation":
			return "outline" as const
		default:
			return "secondary" as const
	}
}

function LensStatCard({
	stat,
	routes,
}: {
	stat: LensStat
	routes: any
}) {
	const percentage = stat.totalInterviews > 0
		? Math.round((stat.completedCount / stat.totalInterviews) * 100)
		: 0
	const hasSynthesis = stat.synthesis?.status === "completed"
	const summary = stat.synthesis?.executiveSummary
	const takeaways = stat.synthesis?.keyTakeaways || []
	const recommendations = stat.synthesis?.recommendations || []

	return (
		<Link to={routes.lenses.byTemplateKey(stat.templateKey)} className="block group">
			<Card className="transition-all hover:shadow-md hover:border-primary/30">
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-3">
							<div className={`rounded-lg p-2 ${getCategoryColor(stat.category)}`}>
								{getCategoryIcon(stat.category)}
							</div>
							<div>
								<CardTitle className="text-base group-hover:text-primary transition-colors">
									{stat.templateName}
								</CardTitle>
								<CardDescription className="mt-0.5">
									{stat.completedCount} of {stat.totalInterviews} conversations analyzed
								</CardDescription>
							</div>
						</div>
						<ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Coverage bar */}
					<div>
						<div className="flex items-center justify-between mb-1">
							<span className="text-muted-foreground text-xs">Coverage</span>
							<span className="font-medium text-xs">{percentage}%</span>
						</div>
						<Progress value={percentage} className="h-1.5" />
					</div>

					{/* Synthesis summary */}
					{hasSynthesis && summary && (
						<div className="rounded-lg bg-muted/30 p-3 space-y-2">
							<div className="flex items-center gap-1.5">
								<Sparkles className="h-3.5 w-3.5 text-primary" />
								<span className="font-medium text-xs text-muted-foreground">AI Summary</span>
							</div>
							<p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
								{summary}
							</p>
						</div>
					)}

					{/* Key takeaways */}
					{takeaways.length > 0 && (
						<div className="space-y-2">
							{takeaways.slice(0, 2).map((takeaway, i) => (
								<div key={i} className="flex items-start gap-2">
									<Lightbulb className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
									<div className="min-w-0">
										<span className="font-medium text-xs">{takeaway.title}</span>
										<span className="text-muted-foreground text-xs ml-1.5">
											{takeaway.insight.length > 80
												? `${takeaway.insight.slice(0, 80)}...`
												: takeaway.insight}
										</span>
									</div>
								</div>
							))}
							{takeaways.length > 2 && (
								<p className="text-muted-foreground text-xs">
									+{takeaways.length - 2} more takeaway{takeaways.length - 2 !== 1 ? "s" : ""}
								</p>
							)}
						</div>
					)}

					{/* Status indicators */}
					<div className="flex items-center gap-3 text-xs">
						{hasSynthesis ? (
							<span className="flex items-center gap-1 text-green-600 dark:text-green-400">
								<CheckCircle2 className="h-3 w-3" />
								Synthesis ready
							</span>
						) : stat.completedCount > 0 ? (
							<span className="flex items-center gap-1 text-muted-foreground">
								<Clock className="h-3 w-3" />
								Synthesis available
							</span>
						) : (
							<span className="flex items-center gap-1 text-muted-foreground">
								<Clock className="h-3 w-3" />
								No analyses yet
							</span>
						)}
						{recommendations.length > 0 && (
							<span className="text-muted-foreground">
								{recommendations.length} recommendation{recommendations.length !== 1 ? "s" : ""}
							</span>
						)}
					</div>
				</CardContent>
			</Card>
		</Link>
	)
}

export function AnalysisByLensTab({ lensStats, routes, projectPath }: ByLensTabProps) {
	if (lensStats.length === 0) {
		return (
			<div className="py-20 text-center">
				<Glasses className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
				<h2 className="mb-2 font-semibold text-xl">No lenses configured</h2>
				<p className="mx-auto max-w-md text-muted-foreground">
					Enable analysis lenses to automatically extract structured insights from your conversations.
					Use the "Manage Lenses" button above to get started.
				</p>
			</div>
		)
	}

	// Split into lenses with data and without
	const withData = lensStats.filter((s) => s.completedCount > 0)
	const withoutData = lensStats.filter((s) => s.completedCount === 0)

	return (
		<div className="space-y-6">
			{/* Lenses with data */}
			{withData.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2">
					{withData.map((stat) => (
						<LensStatCard key={stat.templateKey} stat={stat} routes={routes} />
					))}
				</div>
			)}

			{/* Lenses without data */}
			{withoutData.length > 0 && (
				<div className="space-y-3">
					{withData.length > 0 && (
						<h3 className="text-muted-foreground text-sm font-medium pt-2">
							Enabled but no data ({withoutData.length})
						</h3>
					)}
					<div className="grid gap-4 md:grid-cols-2">
						{withoutData.map((stat) => (
							<LensStatCard key={stat.templateKey} stat={stat} routes={routes} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}
