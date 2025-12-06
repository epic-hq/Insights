/**
 * Aggregated Sales BANT Lens View
 *
 * Project-wide aggregation of Sales BANT analyses showing:
 * - BANT field values across interviews
 * - Stakeholders, objections, next steps
 * - Hygiene gaps and recommendations
 * - Drill-down to source interviews
 */

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircleDollarSign,
	Clock,
	Target,
	Users,
	X,
	XCircle,
} from "lucide-react"
import { useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { userContext } from "~/server/user-context"
import {
	type AggregatedFieldValue,
	type AggregatedObjection,
	type AggregatedSalesBant,
	type AggregatedStakeholder,
	type InterviewWithLensAnalysis,
	aggregateSalesBant,
} from "../services/aggregateSalesBant.server"

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

	const aggregatedData = await aggregateSalesBant({ supabase, projectId })

	return { aggregatedData, projectPath }
}

// ============================================================================
// Main Component
// ============================================================================

export default function AggregatedSalesBantPage() {
	const { aggregatedData, projectPath } = useLoaderData<typeof loader>()
	const routes = useProjectRoutes(projectPath)

	const [selectedField, setSelectedField] = useState<AggregatedFieldValue | null>(null)
	const [selectedStakeholder, setSelectedStakeholder] = useState<AggregatedStakeholder | null>(null)
	const [selectedObjection, setSelectedObjection] = useState<AggregatedObjection | null>(null)
	const [showAllInterviews, setShowAllInterviews] = useState(false)

	// Empty state
	if (aggregatedData.summary.total_interviews === 0) {
		return (
			<div className="space-y-6 p-6">
				<PageHeader />
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
						<h3 className="mb-2 font-semibold text-lg">No Sales BANT analyses yet</h3>
						<p className="mb-4 max-w-md text-muted-foreground text-sm">
							Run the Sales BANT lens on interviews to see aggregated qualification data, stakeholders, and
							insights across your conversations.
						</p>
						<Button asChild>
							<Link to={routes.lenses.library()}>Configure Lenses</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-6 p-6">
			<PageHeader
				totalInterviews={aggregatedData.summary.total_interviews}
				avgConfidence={aggregatedData.summary.avg_confidence}
				lastUpdated={aggregatedData.summary.last_updated}
			/>

			{/* Summary Stats */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<SummaryCard
					title="Interviews Analyzed"
					value={aggregatedData.summary.total_interviews}
					icon={Target}
					description={`${aggregatedData.summary.fields_captured} fields captured`}
				/>
				<SummaryCard
					title="Stakeholders"
					value={aggregatedData.stakeholders.length}
					icon={Users}
					description="Unique people identified"
				/>
				<SummaryCard
					title="Objections"
					value={aggregatedData.objections.length}
					icon={AlertTriangle}
					description="Concerns raised"
					variant={aggregatedData.objections.length > 0 ? "warning" : "default"}
				/>
				<SummaryCard
					title="Next Steps"
					value={aggregatedData.next_steps.length}
					icon={CheckCircle2}
					description="Action items"
				/>
			</div>

			{/* BANT Fields */}
			{aggregatedData.bant_fields.length > 0 && (
				<BANTFieldsSection
					fields={aggregatedData.bant_fields}
					onSelect={setSelectedField}
					projectPath={projectPath}
				/>
			)}

			{/* Opportunity Fields */}
			{aggregatedData.opportunity_fields.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<CircleDollarSign className="h-4 w-4" />
							Opportunity Assessment
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2">
							{aggregatedData.opportunity_fields.map((field) => (
								<FieldCard key={field.field_key} field={field} onSelect={setSelectedField} />
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Stakeholders & Objections */}
			<div className="grid gap-6 lg:grid-cols-2">
				<StakeholdersSection
					stakeholders={aggregatedData.stakeholders}
					onSelect={setSelectedStakeholder}
				/>
				<ObjectionsSection objections={aggregatedData.objections} onSelect={setSelectedObjection} />
			</div>

			{/* Next Steps */}
			{aggregatedData.next_steps.length > 0 && (
				<NextStepsSection nextSteps={aggregatedData.next_steps} projectPath={projectPath} />
			)}

			{/* Hygiene Gaps */}
			{aggregatedData.hygiene_gaps.length > 0 && (
				<HygieneGapsSection gaps={aggregatedData.hygiene_gaps} />
			)}

			{/* Recommendations */}
			{aggregatedData.recommendations.length > 0 && (
				<RecommendationsSection
					recommendations={aggregatedData.recommendations}
					projectPath={projectPath}
				/>
			)}

			{/* Interview List */}
			<InterviewListSection
				interviews={aggregatedData.interviews}
				expanded={showAllInterviews}
				onToggle={() => setShowAllInterviews(!showAllInterviews)}
				projectPath={projectPath}
			/>

			{/* Drawers */}
			{selectedField && (
				<FieldDetailDrawer
					field={selectedField}
					onClose={() => setSelectedField(null)}
					projectPath={projectPath}
				/>
			)}
			{selectedStakeholder && (
				<StakeholderDrawer
					stakeholder={selectedStakeholder}
					onClose={() => setSelectedStakeholder(null)}
					projectPath={projectPath}
				/>
			)}
			{selectedObjection && (
				<ObjectionDrawer
					objection={selectedObjection}
					onClose={() => setSelectedObjection(null)}
					projectPath={projectPath}
				/>
			)}
		</div>
	)
}

// ============================================================================
// Page Header
// ============================================================================

function PageHeader({
	totalInterviews,
	avgConfidence,
	lastUpdated,
}: {
	totalInterviews?: number
	avgConfidence?: number
	lastUpdated?: string | null
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div>
				<h1 className="font-bold text-3xl">Sales BANT Analysis</h1>
				<p className="text-muted-foreground">
					Aggregated qualification data across {totalInterviews || 0} interview
					{totalInterviews !== 1 ? "s" : ""}
				</p>
			</div>
			{avgConfidence != null && avgConfidence > 0 && (
				<div className="text-right text-sm">
					<div className="text-muted-foreground">Avg Confidence</div>
					<div className="font-semibold">{(avgConfidence * 100).toFixed(0)}%</div>
				</div>
			)}
		</div>
	)
}

// ============================================================================
// Summary Card
// ============================================================================

function SummaryCard({
	title,
	value,
	icon: Icon,
	description,
	variant = "default",
}: {
	title: string
	value: number
	icon: any
	description: string
	variant?: "default" | "warning"
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle
					className={cn(
						"flex items-center gap-2 text-base",
						variant === "warning" && "text-amber-600"
					)}
				>
					<Icon className="h-4 w-4" />
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="font-bold text-3xl">{value}</div>
				<p className="text-muted-foreground text-sm">{description}</p>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// BANT Fields Section
// ============================================================================

function BANTFieldsSection({
	fields,
	onSelect,
	projectPath,
}: {
	fields: AggregatedFieldValue[]
	onSelect: (f: AggregatedFieldValue) => void
	projectPath: string
}) {
	// Order: Budget, Authority, Need, Timeline
	const orderedKeys = ["budget", "authority", "need", "timeline"]
	const sortedFields = [...fields].sort(
		(a, b) => orderedKeys.indexOf(a.field_key) - orderedKeys.indexOf(b.field_key)
	)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Target className="h-4 w-4 text-primary" />
					BANT Qualification
				</CardTitle>
				<CardDescription>Budget, Authority, Need, Timeline across conversations</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{sortedFields.map((field) => (
						<FieldCard key={field.field_key} field={field} onSelect={onSelect} />
					))}
				</div>
			</CardContent>
		</Card>
	)
}

function FieldCard({
	field,
	onSelect,
}: {
	field: AggregatedFieldValue
	onSelect: (f: AggregatedFieldValue) => void
}) {
	const latestValue = field.values[0]
	const hasMultiple = field.values.length > 1

	return (
		<button
			onClick={() => onSelect(field)}
			className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50"
		>
			<div className="mb-1 font-medium text-sm">{field.field_name}</div>
			<div className="line-clamp-2 text-muted-foreground text-sm">{latestValue?.value || "—"}</div>
			{hasMultiple && (
				<div className="mt-2 flex items-center gap-1 text-primary text-xs">
					<span>{field.values.length} interviews</span>
					<ArrowRight className="h-3 w-3" />
				</div>
			)}
		</button>
	)
}

// ============================================================================
// Stakeholders Section
// ============================================================================

function StakeholdersSection({
	stakeholders,
	onSelect,
}: {
	stakeholders: AggregatedStakeholder[]
	onSelect: (s: AggregatedStakeholder) => void
}) {
	if (stakeholders.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Users className="h-4 w-4" />
						Stakeholders
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">No stakeholders identified yet</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Users className="h-4 w-4" />
					Stakeholders
				</CardTitle>
				<CardDescription>{stakeholders.length} people identified</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{stakeholders.slice(0, 8).map((stakeholder, i) => (
						<button
							key={i}
							onClick={() => onSelect(stakeholder)}
							className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
						>
							<div>
								<div className="font-medium text-sm">{stakeholder.name}</div>
								<div className="text-muted-foreground text-xs">
									{stakeholder.role || "Role unknown"}
									{stakeholder.influence && ` • ${stakeholder.influence} influence`}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{stakeholder.labels.slice(0, 2).map((label) => (
									<Badge key={label} variant="outline" className="text-xs">
										{label.replace("_", " ")}
									</Badge>
								))}
								<Badge variant="secondary">{stakeholder.interview_count}</Badge>
							</div>
						</button>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Objections Section
// ============================================================================

function ObjectionsSection({
	objections,
	onSelect,
}: {
	objections: AggregatedObjection[]
	onSelect: (o: AggregatedObjection) => void
}) {
	if (objections.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<XCircle className="h-4 w-4 text-red-500" />
						Objections
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">No objections identified yet</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<XCircle className="h-4 w-4 text-red-500" />
					Objections
				</CardTitle>
				<CardDescription>Concerns raised across interviews</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{objections.slice(0, 8).map((objection, i) => (
						<button
							key={i}
							onClick={() => onSelect(objection)}
							className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
						>
							<div className="flex-1">
								<div className="text-sm">{objection.objection}</div>
								<div className="text-muted-foreground text-xs">
									{objection.type}
									{objection.status && ` • ${objection.status}`}
								</div>
							</div>
							<div className="ml-2 flex items-center gap-2">
								<Badge variant="secondary">{objection.count}</Badge>
								<ArrowRight className="h-4 w-4 text-muted-foreground" />
							</div>
						</button>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Next Steps Section
// ============================================================================

function NextStepsSection({
	nextSteps,
	projectPath,
}: {
	nextSteps: AggregatedSalesBant["next_steps"]
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<CheckCircle2 className="h-4 w-4 text-green-500" />
					Next Steps
				</CardTitle>
				<CardDescription>{nextSteps.length} action items identified</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{nextSteps.slice(0, 10).map((step, i) => (
						<div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
							<div className="flex-1">
								<div className="text-sm">{step.description}</div>
								<div className="mt-1 flex flex-wrap gap-2 text-muted-foreground text-xs">
									{step.owner && <span>Owner: {step.owner}</span>}
									{step.priority && (
										<Badge
											variant="outline"
											className={cn(
												"text-xs",
												step.priority === "high" && "border-red-200 text-red-600",
												step.priority === "medium" && "border-yellow-200 text-yellow-600"
											)}
										>
											{step.priority}
										</Badge>
									)}
									<Link
										to={routes.interviews.detail(step.interview_id)}
										className="text-primary hover:underline"
									>
										{step.interview_title}
									</Link>
								</div>
							</div>
							{step.task_id && (
								<Link to={routes.priorities()}>
									<Badge variant="secondary" className="text-xs">
										Task
									</Badge>
								</Link>
							)}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Hygiene Gaps Section
// ============================================================================

function HygieneGapsSection({ gaps }: { gaps: AggregatedSalesBant["hygiene_gaps"] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<AlertTriangle className="h-4 w-4 text-amber-500" />
					Information Gaps
				</CardTitle>
				<CardDescription>Missing or incomplete data across conversations</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{gaps.map((gap, i) => (
						<div
							key={i}
							className={cn(
								"flex items-center justify-between rounded-lg border p-3",
								gap.severity === "critical" && "border-red-200 bg-red-50",
								gap.severity === "warning" && "border-amber-200 bg-amber-50"
							)}
						>
							<div>
								<div className="font-medium text-sm">{gap.message}</div>
								<div className="text-muted-foreground text-xs">{gap.code}</div>
							</div>
							<Badge
								variant={gap.severity === "critical" ? "destructive" : "outline"}
								className="text-xs"
							>
								{gap.count} interview{gap.count > 1 ? "s" : ""}
							</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Recommendations Section
// ============================================================================

function RecommendationsSection({
	recommendations,
	projectPath,
}: {
	recommendations: AggregatedSalesBant["recommendations"]
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">AI Recommendations</CardTitle>
				<CardDescription>Suggested actions based on analysis</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{recommendations.slice(0, 8).map((rec, i) => (
						<div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
							<ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
							<div className="flex-1">
								<div className="text-sm">{rec.description}</div>
								<div className="mt-1 flex gap-2 text-muted-foreground text-xs">
									<Badge variant="outline" className="text-xs">
										{rec.type}
									</Badge>
									<Badge
										variant="outline"
										className={cn(
											"text-xs",
											rec.priority === "high" && "border-red-200 text-red-600"
										)}
									>
										{rec.priority}
									</Badge>
									<Link
										to={routes.interviews.detail(rec.interview_id)}
										className="text-primary hover:underline"
									>
										{rec.interview_title}
									</Link>
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Interview List Section
// ============================================================================

function InterviewListSection({
	interviews,
	expanded,
	onToggle,
	projectPath,
}: {
	interviews: InterviewWithLensAnalysis[]
	expanded: boolean
	onToggle: () => void
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)
	const displayedInterviews = expanded ? interviews : interviews.slice(0, 5)

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Analyzed Interviews</CardTitle>
				<CardDescription>
					{interviews.length} interview{interviews.length !== 1 ? "s" : ""} with Sales BANT analysis
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{displayedInterviews.map((interview) => (
						<Link
							key={interview.interview_id}
							to={routes.interviews.detail(interview.interview_id)}
							className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium text-sm">{interview.interview_title}</div>
								<div className="text-muted-foreground text-xs">
									{interview.interviewee_name && <span>{interview.interviewee_name} • </span>}
									{interview.interview_date &&
										new Date(interview.interview_date).toLocaleDateString()}
								</div>
							</div>
							<div className="ml-4 flex items-center gap-2">
								{interview.confidence_score != null && (
									<Badge variant="outline">{(interview.confidence_score * 100).toFixed(0)}%</Badge>
								)}
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</div>
						</Link>
					))}
				</div>
				{interviews.length > 5 && (
					<Button variant="ghost" onClick={onToggle} className="mt-3 w-full">
						{expanded ? (
							<>
								Show Less <ChevronDown className="ml-1 h-4 w-4 rotate-180" />
							</>
						) : (
							<>
								Show All {interviews.length} Interviews <ChevronDown className="ml-1 h-4 w-4" />
							</>
						)}
					</Button>
				)}
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Drawers
// ============================================================================

function FieldDetailDrawer({
	field,
	onClose,
	projectPath,
}: {
	field: AggregatedFieldValue
	onClose: () => void
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)

	return (
		<div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
			<div
				className="h-full w-full max-w-md animate-in slide-in-from-right bg-background shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-start justify-between border-b p-4">
						<div>
							<h3 className="font-semibold">{field.field_name}</h3>
							<p className="text-muted-foreground text-sm">{field.values.length} responses</p>
						</div>
						<Button variant="ghost" size="icon" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<ScrollArea className="flex-1 p-4">
						<div className="space-y-3">
							{field.values.map((v, i) => (
								<div key={i} className="rounded-lg border bg-card p-3">
									<p className="text-sm">{v.value}</p>
									<div className="mt-2 flex items-center justify-between text-xs">
										<Link
											to={routes.interviews.detail(v.interview_id)}
											className="text-primary hover:underline"
										>
											{v.interview_title}
										</Link>
										<Badge variant="outline">{(v.confidence * 100).toFixed(0)}%</Badge>
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	)
}

function StakeholderDrawer({
	stakeholder,
	onClose,
	projectPath,
}: {
	stakeholder: AggregatedStakeholder
	onClose: () => void
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)

	return (
		<div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
			<div
				className="h-full w-full max-w-md animate-in slide-in-from-right bg-background shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-start justify-between border-b p-4">
						<div>
							<h3 className="font-semibold">{stakeholder.name}</h3>
							<p className="text-muted-foreground text-sm">
								{stakeholder.role || "Role unknown"}
								{stakeholder.influence && ` • ${stakeholder.influence} influence`}
							</p>
						</div>
						<Button variant="ghost" size="icon" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<ScrollArea className="flex-1 p-4">
						{stakeholder.labels.length > 0 && (
							<div className="mb-4">
								<h4 className="mb-2 font-medium text-sm">Labels</h4>
								<div className="flex flex-wrap gap-1">
									{stakeholder.labels.map((label) => (
										<Badge key={label} variant="secondary">
											{label.replace("_", " ")}
										</Badge>
									))}
								</div>
							</div>
						)}
						<h4 className="mb-2 font-medium text-sm">Mentioned in</h4>
						<div className="space-y-2">
							{stakeholder.interviews.map((int) => (
								<Link
									key={int.id}
									to={routes.interviews.detail(int.id)}
									className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
								>
									<span className="text-sm">{int.title}</span>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</Link>
							))}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	)
}

function ObjectionDrawer({
	objection,
	onClose,
	projectPath,
}: {
	objection: AggregatedObjection
	onClose: () => void
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)

	return (
		<div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
			<div
				className="h-full w-full max-w-md animate-in slide-in-from-right bg-background shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-start justify-between border-b p-4">
						<div>
							<h3 className="font-semibold">{objection.objection}</h3>
							<p className="text-muted-foreground text-sm">
								{objection.type}
								{objection.status && ` • ${objection.status}`}
							</p>
						</div>
						<Button variant="ghost" size="icon" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<ScrollArea className="flex-1 p-4">
						<h4 className="mb-2 font-medium text-sm">Raised in</h4>
						<div className="space-y-2">
							{objection.interviews.map((int) => (
								<Link
									key={int.id}
									to={routes.interviews.detail(int.id)}
									className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
								>
									<span className="text-sm">{int.title}</span>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</Link>
							))}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	)
}
