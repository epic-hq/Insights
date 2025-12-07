/**
 * Aggregated Customer Discovery View
 *
 * Research-focused insights dashboard for customer discovery findings.
 * Shows validated learnings, evidence, and areas needing more research.
 */

import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	CircleDashed,
	Filter,
	HelpCircle,
	Lightbulb,
	MessageSquare,
	Quote,
	Search,
	Sparkles,
	Target,
	TrendingUp,
	X,
	XCircle,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { userContext } from "~/server/user-context"
import {
	type AggregatedCustomerDiscovery,
	type AggregatedFieldValue,
	type AggregatedPattern,
	aggregateCustomerDiscovery,
} from "../services/aggregateCustomerDiscovery.server"

// ============================================================================
// Loader
// ============================================================================

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const projectId = params.projectId as string
	const projectPath = `/a/${params.accountId}/${params.projectId}`

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	const aggregatedData = await aggregateCustomerDiscovery({ supabase, projectId })

	return { aggregatedData, projectPath }
}

// ============================================================================
// Signal Status Types
// ============================================================================

type SignalStrength = "validated" | "emerging" | "needs_research" | "no_data"

function getSignalStrength(evidenceCount: number): SignalStrength {
	if (evidenceCount >= 3) return "validated"
	if (evidenceCount >= 1) return "emerging"
	return "no_data"
}

function SignalBadge({ strength }: { strength: SignalStrength }) {
	const config = {
		validated: {
			icon: CheckCircle2,
			label: "Validated",
			className: "bg-emerald-50 text-emerald-700 border-emerald-200",
		},
		emerging: {
			icon: TrendingUp,
			label: "Emerging",
			className: "bg-amber-50 text-amber-700 border-amber-200",
		},
		needs_research: {
			icon: HelpCircle,
			label: "Needs Research",
			className: "bg-blue-50 text-blue-700 border-blue-200",
		},
		no_data: {
			icon: CircleDashed,
			label: "No Data",
			className: "bg-gray-50 text-gray-500 border-gray-200",
		},
	}[strength]

	const Icon = config.icon

	return (
		<Badge variant="outline" className={cn("gap-1 font-medium", config.className)}>
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	)
}

// ============================================================================
// Main Component
// ============================================================================

export default function AggregatedCustomerDiscoveryPage() {
	const { aggregatedData, projectPath } = useLoaderData<typeof loader>()
	const routes = useProjectRoutes(projectPath)

	// Filter state
	const [segmentFilter, setSegmentFilter] = useState<string>("all")
	const [dateRangeFilter, setDateRangeFilter] = useState<string>("all")

	const DATE_RANGES = [
		{ value: "7", label: "Last 7 days" },
		{ value: "30", label: "Last 30 days" },
		{ value: "90", label: "Last 90 days" },
		{ value: "all", label: "All time" },
	]

	const uniqueSegments = useMemo(() => {
		return aggregatedData.summary.unique_segments.filter(Boolean).sort()
	}, [aggregatedData.summary.unique_segments])

	// Apply filters
	const filteredData = useMemo(() => {
		const now = new Date()
		const cutoffDate =
			dateRangeFilter === "all"
				? null
				: new Date(now.getTime() - parseInt(dateRangeFilter) * 24 * 60 * 60 * 1000)

		const filteredInterviews = aggregatedData.interviews.filter((interview) => {
			if (segmentFilter !== "all" && interview.segment !== segmentFilter) return false
			if (cutoffDate && interview.processed_at) {
				const processedDate = new Date(interview.processed_at)
				if (processedDate < cutoffDate) return false
			}
			return true
		})

		const filteredInterviewIds = new Set(filteredInterviews.map((i) => i.interview_id))

		const filterFieldValues = (fields: AggregatedFieldValue[]): AggregatedFieldValue[] => {
			return fields
				.map((f) => ({
					...f,
					values: f.values.filter((v) => filteredInterviewIds.has(v.interview_id)),
				}))
				.filter((f) => f.values.length > 0)
		}

		const filterPatterns = (patterns: AggregatedPattern[]): AggregatedPattern[] => {
			return patterns
				.map((p) => ({
					...p,
					interviews: p.interviews.filter((i) => filteredInterviewIds.has(i.id)),
					count: p.interviews.filter((i) => filteredInterviewIds.has(i.id)).length,
				}))
				.filter((p) => p.count > 0)
				.sort((a, b) => b.count - a.count)
		}

		return {
			...aggregatedData,
			interviews: filteredInterviews,
			problem_validation_fields: filterFieldValues(aggregatedData.problem_validation_fields),
			solution_validation_fields: filterFieldValues(aggregatedData.solution_validation_fields),
			market_insights_fields: filterFieldValues(aggregatedData.market_insights_fields),
			common_problems: filterPatterns(aggregatedData.common_problems),
			current_solutions: filterPatterns(aggregatedData.current_solutions),
			competitive_alternatives: filterPatterns(aggregatedData.competitive_alternatives),
			objections: aggregatedData.objections
				.map((o) => ({
					...o,
					interviews: o.interviews.filter((i) => filteredInterviewIds.has(i.id)),
					count: o.interviews.filter((i) => filteredInterviewIds.has(i.id)).length,
				}))
				.filter((o) => o.count > 0),
			recommendations: aggregatedData.recommendations.filter((r) =>
				filteredInterviewIds.has(r.interview_id)
			),
			hygiene_gaps: aggregatedData.hygiene_gaps
				.map((g) => ({
					...g,
					interviews: g.interviews.filter((i) => filteredInterviewIds.has(i.id)),
					count: g.interviews.filter((i) => filteredInterviewIds.has(i.id)).length,
				}))
				.filter((g) => g.count > 0),
			summary: {
				...aggregatedData.summary,
				total_interviews: filteredInterviews.length,
			},
		}
	}, [aggregatedData, segmentFilter, dateRangeFilter])

	const hasFilters = segmentFilter !== "all" || dateRangeFilter !== "all"

	const clearFilters = () => {
		setSegmentFilter("all")
		setDateRangeFilter("all")
	}

	const { total_interviews: totalConversations } = filteredData.summary

	// Calculate validation signals
	const problemSignal = getSignalStrength(filteredData.common_problems.length)
	const solutionSignal = getSignalStrength(
		filteredData.solution_validation_fields.reduce((sum, f) => sum + f.values.length, 0)
	)
	const marketSignal = getSignalStrength(
		filteredData.current_solutions.length + filteredData.competitive_alternatives.length
	)
	const wtpSignal = getSignalStrength(
		filteredData.market_insights_fields.find((f) => f.field_key.includes("willingness"))?.values
			.length || 0
	)

	if (totalConversations === 0 && !hasFilters) {
		return (
			<div className="container py-8">
				<div className="text-center py-16">
					<div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
						<Search className="h-8 w-8 text-muted-foreground" />
					</div>
					<h2 className="text-xl font-semibold mb-2">Start Your Discovery</h2>
					<p className="text-muted-foreground mb-6 max-w-md mx-auto">
						Apply the Customer Discovery lens to your conversations to uncover insights about
						problems, solutions, and market dynamics.
					</p>
					<Link to={routes.interviews.index()}>
						<Button>
							<MessageSquare className="h-4 w-4 mr-2" />
							Go to Conversations
						</Button>
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="container py-6 space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Customer Discovery</h1>
				<p className="text-muted-foreground mt-1">
					Learnings from {totalConversations} conversation{totalConversations !== 1 ? "s" : ""}
				</p>
			</div>

			{/* Filters */}
			{(uniqueSegments.length > 0 || true) && (
				<div className="flex flex-wrap items-center gap-3">
					<Filter className="h-4 w-4 text-muted-foreground" />
					{uniqueSegments.length > 0 && (
						<Select value={segmentFilter} onValueChange={setSegmentFilter}>
							<SelectTrigger className="w-[160px] h-8">
								<SelectValue placeholder="All Segments" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Segments</SelectItem>
								{uniqueSegments.map((segment) => (
									<SelectItem key={segment} value={segment}>
										{segment}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					<Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
						<SelectTrigger className="w-[140px] h-8">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DATE_RANGES.map((range) => (
								<SelectItem key={range.value} value={range.value}>
									{range.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{hasFilters && (
						<Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
							<X className="h-4 w-4 mr-1" />
							Clear
						</Button>
					)}
				</div>
			)}

			{/* Validation Status Cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<ValidationCard
					title="Problem"
					question="Is this problem worth solving?"
					signal={problemSignal}
					evidenceCount={filteredData.common_problems.length}
					highlight={filteredData.common_problems[0]?.pattern}
				/>
				<ValidationCard
					title="Solution"
					question="Does our solution resonate?"
					signal={solutionSignal}
					evidenceCount={filteredData.solution_validation_fields.reduce(
						(sum, f) => sum + f.values.length,
						0
					)}
					highlight={filteredData.solution_validation_fields[0]?.values[0]?.value}
				/>
				<ValidationCard
					title="Market"
					question="What exists today?"
					signal={marketSignal}
					evidenceCount={
						filteredData.current_solutions.length + filteredData.competitive_alternatives.length
					}
					highlight={filteredData.current_solutions[0]?.pattern}
				/>
				<ValidationCard
					title="Willingness to Pay"
					question="Will they pay for it?"
					signal={wtpSignal}
					evidenceCount={
						filteredData.market_insights_fields.find((f) => f.field_key.includes("willingness"))
							?.values.length || 0
					}
					highlight={
						filteredData.market_insights_fields.find((f) => f.field_key.includes("willingness"))
							?.values[0]?.value
					}
				/>
			</div>

			{/* What We Learned: Problems */}
			{filteredData.common_problems.length > 0 && (
				<LearningSection
					title="Problems We're Hearing"
					subtitle="Pain points mentioned across conversations"
					icon={Target}
					iconColor="text-red-500"
				>
					<div className="space-y-3">
						{filteredData.common_problems.slice(0, 6).map((problem, i) => (
							<QuoteCard
								key={i}
								quote={problem.pattern}
								count={problem.count}
								sources={problem.interviews}
								projectPath={projectPath}
							/>
						))}
					</div>
				</LearningSection>
			)}

			{/* What We Learned: Solution Reactions */}
			{filteredData.solution_validation_fields.length > 0 && (
				<LearningSection
					title="Solution Reactions"
					subtitle="How people responded to our ideas"
					icon={Sparkles}
					iconColor="text-purple-500"
				>
					<div className="space-y-3">
						{filteredData.solution_validation_fields.slice(0, 3).map((field) =>
							field.values.slice(0, 2).map((value, i) => (
								<QuoteCard
									key={`${field.field_key}-${i}`}
									label={field.field_name}
									quote={value.value}
									source={{
										id: value.interview_id,
										title: value.interview_title,
										interviewee_name: value.interviewee_name,
									}}
									projectPath={projectPath}
								/>
							))
						)}
					</div>
				</LearningSection>
			)}

			{/* Market Reality */}
			{(filteredData.current_solutions.length > 0 ||
				filteredData.competitive_alternatives.length > 0) && (
				<LearningSection
					title="Market Reality"
					subtitle="How customers solve this problem today"
					icon={TrendingUp}
					iconColor="text-blue-500"
				>
					<div className="grid gap-4 md:grid-cols-2">
						{filteredData.current_solutions.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium text-muted-foreground">Current Solutions</h4>
								{filteredData.current_solutions.slice(0, 4).map((solution, i) => (
									<div
										key={i}
										className="flex items-center justify-between rounded-lg border bg-card p-3"
									>
										<span className="text-sm">{solution.pattern}</span>
										<Badge variant="secondary" className="ml-2">
											{solution.count}
										</Badge>
									</div>
								))}
							</div>
						)}
						{filteredData.competitive_alternatives.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium text-muted-foreground">
									Alternatives Considered
								</h4>
								{filteredData.competitive_alternatives.slice(0, 4).map((alt, i) => (
									<div
										key={i}
										className="flex items-center justify-between rounded-lg border bg-card p-3"
									>
										<span className="text-sm">{alt.pattern}</span>
										<Badge variant="secondary" className="ml-2">
											{alt.count}
										</Badge>
									</div>
								))}
							</div>
						)}
					</div>
				</LearningSection>
			)}

			{/* Concerns & Objections */}
			{filteredData.objections.length > 0 && (
				<LearningSection
					title="Concerns to Address"
					subtitle="Objections and hesitations we've heard"
					icon={AlertCircle}
					iconColor="text-amber-500"
				>
					<div className="space-y-3">
						{filteredData.objections.slice(0, 5).map((obj, i) => (
							<div key={i} className="rounded-lg border bg-card p-4">
								<div className="flex items-start justify-between gap-3">
									<div className="flex-1">
										<p className="font-medium">{obj.objection}</p>
										{obj.response && (
											<p className="mt-2 text-sm text-muted-foreground">
												<span className="font-medium text-foreground">Our response:</span>{" "}
												{obj.response}
											</p>
										)}
									</div>
									<div className="flex items-center gap-2">
										{obj.status === "addressed" ? (
											<Badge className="bg-emerald-100 text-emerald-700">Addressed</Badge>
										) : (
											<Badge variant="outline" className="text-amber-600 border-amber-200">
												Open
											</Badge>
										)}
										<Badge variant="secondary">{obj.count}</Badge>
									</div>
								</div>
							</div>
						))}
					</div>
				</LearningSection>
			)}

			{/* Areas Needing More Research */}
			{filteredData.hygiene_gaps.length > 0 && (
				<LearningSection
					title="Areas Needing More Research"
					subtitle="Information we still need to gather"
					icon={HelpCircle}
					iconColor="text-blue-500"
				>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{filteredData.hygiene_gaps.map((gap, i) => (
							<div
								key={i}
								className="flex items-start gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-4"
							>
								<CircleDashed className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
								<div>
									<p className="font-medium text-sm">{formatGapCode(gap.code)}</p>
									<p className="text-xs text-muted-foreground mt-1">
										Missing from {gap.count} conversation{gap.count !== 1 ? "s" : ""}
									</p>
								</div>
							</div>
						))}
					</div>
				</LearningSection>
			)}

			{/* Next Steps */}
			{filteredData.recommendations.length > 0 && (
				<LearningSection
					title="Suggested Next Steps"
					subtitle="Actions to continue your discovery"
					icon={Lightbulb}
					iconColor="text-yellow-500"
				>
					<div className="space-y-2">
						{filteredData.recommendations.slice(0, 6).map((rec, i) => (
							<div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-4">
								<ChevronRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
								<div className="flex-1">
									<p className="text-sm">{rec.description}</p>
									<div className="mt-2 flex items-center gap-2">
										<Badge
											variant="outline"
											className={cn(
												"text-xs",
												rec.priority === "high" && "border-red-200 text-red-600",
												rec.priority === "medium" && "border-amber-200 text-amber-600"
											)}
										>
											{rec.priority} priority
										</Badge>
										<Link
											to={routes.interviews.detail(rec.interview_id)}
											className="text-xs text-muted-foreground hover:text-primary hover:underline"
										>
											from {rec.interviewee_name || rec.interview_title}
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				</LearningSection>
			)}
		</div>
	)
}

// ============================================================================
// Validation Card
// ============================================================================

function ValidationCard({
	title,
	question,
	signal,
	evidenceCount,
	highlight,
}: {
	title: string
	question: string
	signal: SignalStrength
	evidenceCount: number
	highlight?: string
}) {
	return (
		<Card className="relative overflow-hidden">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<CardTitle className="text-sm font-medium">{title}</CardTitle>
					<SignalBadge strength={signal} />
				</div>
				<CardDescription className="text-xs">{question}</CardDescription>
			</CardHeader>
			<CardContent>
				{highlight ? (
					<p className="text-sm line-clamp-2">{highlight}</p>
				) : (
					<p className="text-sm text-muted-foreground italic">No data yet</p>
				)}
				{evidenceCount > 0 && (
					<p className="mt-2 text-xs text-muted-foreground">
						{evidenceCount} data point{evidenceCount !== 1 ? "s" : ""}
					</p>
				)}
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Learning Section
// ============================================================================

function LearningSection({
	title,
	subtitle,
	icon: Icon,
	iconColor,
	children,
}: {
	title: string
	subtitle: string
	icon: typeof Target
	iconColor: string
	children: React.ReactNode
}) {
	return (
		<section className="space-y-4">
			<div className="flex items-center gap-3">
				<div className={cn("p-2 rounded-lg bg-muted", iconColor)}>
					<Icon className="h-5 w-5" />
				</div>
				<div>
					<h2 className="text-lg font-semibold">{title}</h2>
					<p className="text-sm text-muted-foreground">{subtitle}</p>
				</div>
			</div>
			{children}
		</section>
	)
}

// ============================================================================
// Quote Card
// ============================================================================

function QuoteCard({
	label,
	quote,
	count,
	source,
	sources,
	projectPath,
}: {
	label?: string
	quote: string
	count?: number
	source?: { id: string; title: string; interviewee_name: string | null }
	sources?: Array<{ id: string; title: string; interviewee_name: string | null }>
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)
	const displaySources = sources || (source ? [source] : [])

	return (
		<div className="rounded-lg border bg-card p-4">
			<div className="flex gap-3">
				<Quote className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
				<div className="flex-1 min-w-0">
					{label && (
						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							{label}
						</span>
					)}
					<p className="text-sm mt-1">{quote}</p>
					<div className="mt-3 flex items-center justify-between">
						<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
							{displaySources.slice(0, 3).map((s) => (
								<Link
									key={s.id}
									to={routes.interviews.detail(s.id)}
									className="hover:text-primary hover:underline"
								>
									{s.interviewee_name || s.title}
								</Link>
							))}
							{displaySources.length > 3 && (
								<span>+{displaySources.length - 3} more</span>
							)}
						</div>
						{count && count > 1 && (
							<Badge variant="secondary" className="text-xs">
								{count} mentions
							</Badge>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// Helpers
// ============================================================================

function formatGapCode(code: string): string {
	const labels: Record<string, string> = {
		missing_problem: "Primary problem not identified",
		missing_need: "Core need not articulated",
		missing_solution_reaction: "No solution feedback captured",
		missing_willingness_to_pay: "Willingness to pay not discussed",
		no_champion: "No internal advocate identified",
		unaddressed_objection: "Objection not resolved",
	}
	return labels[code] || code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
