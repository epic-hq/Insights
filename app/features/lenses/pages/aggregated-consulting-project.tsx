/**
 * Aggregated Consulting Project View
 *
 * Project alignment dashboard showing goals, conflicts, risks, and commitments
 * aggregated across all stakeholder conversations.
 */

import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	FileText,
	Flag,
	HelpCircle,
	Lightbulb,
	Target,
	Users,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { userContext } from "~/server/user-context"
import {
	type AggregatedConsultingProject,
	type AggregatedFieldValue,
	type AggregatedItem,
	aggregateConsultingProject,
} from "../services/aggregateConsultingProject.server"

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

	const aggregatedData = await aggregateConsultingProject({ supabase, projectId })

	return { aggregatedData, projectPath }
}

// ============================================================================
// Components
// ============================================================================

function EmptyState() {
	return (
		<div className="py-16 text-center">
			<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
			<h2 className="mb-2 font-semibold text-lg">No Consulting Project Analyses Yet</h2>
			<p className="mb-4 text-muted-foreground">
				Apply the "Consulting Project" lens to your stakeholder interviews to see aggregated insights here.
			</p>
		</div>
	)
}

function SummaryStats({ summary }: { summary: AggregatedConsultingProject["summary"] }) {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
			<Card>
				<CardContent className="pt-6">
					<div className="font-bold text-2xl">{summary.total_interviews}</div>
					<p className="text-muted-foreground text-sm">Conversations Analyzed</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="pt-6">
					<div className="font-bold text-2xl">{summary.total_stakeholders}</div>
					<p className="text-muted-foreground text-sm">Stakeholders Identified</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="pt-6">
					<div className="font-bold text-2xl">{summary.unresolved_conflicts}</div>
					<p className="text-muted-foreground text-sm">Conflicts to Resolve</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="pt-6">
					<div className="font-bold text-2xl">{summary.total_next_steps}</div>
					<p className="text-muted-foreground text-sm">Action Items</p>
				</CardContent>
			</Card>
		</div>
	)
}

function ItemList({
	items,
	maxItems = 10,
	emptyMessage = "No items found",
	routes,
}: {
	items: AggregatedItem[]
	maxItems?: number
	emptyMessage?: string
	routes: ReturnType<typeof useProjectRoutes>
}) {
	const [showAll, setShowAll] = useState(false)
	const displayItems = showAll ? items : items.slice(0, maxItems)

	if (items.length === 0) {
		return <p className="text-muted-foreground text-sm italic">{emptyMessage}</p>
	}

	return (
		<div className="space-y-2">
			{displayItems.map((item, idx) => (
				<div key={idx} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm">{item.item}</p>
						<div className="mt-1 flex flex-wrap gap-1">
							{item.interviews.slice(0, 3).map((int) => (
								<Link
									key={int.id}
									to={routes.interviews.detail(int.id)}
									className="text-muted-foreground text-xs hover:text-primary hover:underline"
								>
									{int.interviewee_name || int.title}
								</Link>
							))}
							{item.interviews.length > 3 && (
								<span className="text-muted-foreground text-xs">+{item.interviews.length - 3} more</span>
							)}
						</div>
					</div>
					<Badge variant="secondary" className="shrink-0">
						{item.count}x
					</Badge>
				</div>
			))}
			{items.length > maxItems && (
				<Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="w-full">
					{showAll ? "Show Less" : `Show All (${items.length})`}
				</Button>
			)}
		</div>
	)
}

function FieldValuesList({
	fields,
	routes,
}: {
	fields: AggregatedFieldValue[]
	routes: ReturnType<typeof useProjectRoutes>
}) {
	if (fields.length === 0) {
		return <p className="text-muted-foreground text-sm italic">No data captured</p>
	}

	return (
		<div className="space-y-4">
			{fields.map((field) => (
				<div key={field.field_key}>
					<h4 className="mb-2 font-medium text-sm">{field.field_name}</h4>
					<div className="space-y-2">
						{field.values.map((v, idx) => (
							<div key={idx} className="rounded border bg-muted/30 p-2 dark:bg-muted/10">
								<p className="text-sm">{v.value}</p>
								<Link
									to={routes.interviews.detail(v.interview_id)}
									className="mt-1 text-muted-foreground text-xs hover:text-primary hover:underline"
								>
									{v.interviewee_name || v.interview_title}
								</Link>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	)
}

function StakeholdersList({
	stakeholders,
	routes,
}: {
	stakeholders: AggregatedConsultingProject["stakeholders"]
	routes: ReturnType<typeof useProjectRoutes>
}) {
	if (stakeholders.length === 0) {
		return <p className="text-muted-foreground text-sm italic">No stakeholders identified</p>
	}

	const influenceColors: Record<string, string> = {
		high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
		low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
	}

	return (
		<div className="space-y-2">
			{stakeholders.map((s, idx) => (
				<div key={idx} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<Users className="h-4 w-4 text-muted-foreground" />
							{s.person_id ? (
								<Link to={routes.people.detail(s.person_id)} className="font-medium text-primary hover:underline">
									{s.name}
								</Link>
							) : (
								<span className="font-medium">{s.name}</span>
							)}
						</div>
						{s.role && <p className="mt-0.5 text-muted-foreground text-sm">{s.role}</p>}
						{s.labels.length > 0 && (
							<div className="mt-1 flex flex-wrap gap-1">
								{s.labels.map((label) => (
									<Badge key={label} variant="outline" className="text-xs">
										{label}
									</Badge>
								))}
							</div>
						)}
						<p className="mt-1 text-muted-foreground text-xs">
							Mentioned in {s.interview_count} conversation{s.interview_count !== 1 ? "s" : ""}
						</p>
					</div>
					<div className="flex flex-col items-end gap-1">
						{s.influence && (
							<Badge variant="outline" className={cn("text-xs", influenceColors[s.influence])}>
								{s.influence} influence
							</Badge>
						)}
					</div>
				</div>
			))}
		</div>
	)
}

function NextStepsList({
	nextSteps,
	routes,
}: {
	nextSteps: AggregatedConsultingProject["next_steps"]
	routes: ReturnType<typeof useProjectRoutes>
}) {
	if (nextSteps.length === 0) {
		return <p className="text-muted-foreground text-sm italic">No action items captured</p>
	}

	const priorityColors: Record<string, string> = {
		high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
		low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
	}

	return (
		<div className="space-y-2">
			{nextSteps.map((step, idx) => (
				<div key={idx} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm">{step.description}</p>
						<div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
							{step.owner && <span>Owner: {step.owner}</span>}
							{step.due_date && <span>Due: {step.due_date}</span>}
							<Link to={routes.interviews.detail(step.interview_id)} className="hover:text-primary hover:underline">
								{step.interviewee_name || step.interview_title}
							</Link>
						</div>
					</div>
					<div className="flex items-center gap-1">
						{step.priority && (
							<Badge variant="outline" className={cn("text-xs", priorityColors[step.priority])}>
								{step.priority}
							</Badge>
						)}
						{step.task_id && (
							<Link to={`${routes.priorities()}?taskId=${step.task_id}`}>
								<Badge variant="outline" className="text-xs">
									<CheckCircle2 className="mr-1 h-3 w-3" />
									Task
								</Badge>
							</Link>
						)}
					</div>
				</div>
			))}
		</div>
	)
}

// ============================================================================
// Main Component
// ============================================================================

export default function AggregatedConsultingProjectPage() {
	const { aggregatedData, projectPath } = useLoaderData<typeof loader>()
	const routes = useProjectRoutes(projectPath)

	if (aggregatedData.interviews.length === 0) {
		return (
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<h1 className="mb-6 font-bold text-2xl">Consulting Project Overview</h1>
				<EmptyState />
			</div>
		)
	}

	return (
		<div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
			{/* Header */}
			<div>
				<h1 className="mb-2 font-bold text-2xl">Consulting Project Overview</h1>
				<p className="text-muted-foreground">
					Aggregated insights from {aggregatedData.summary.total_interviews} stakeholder conversation
					{aggregatedData.summary.total_interviews !== 1 ? "s" : ""}
				</p>
			</div>

			{/* Summary Stats */}
			<SummaryStats summary={aggregatedData.summary} />

			{/* Main Content Grid */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Conflicts & Alignment Issues - Priority Section */}
				{aggregatedData.all_conflicts.length > 0 && (
					<Card className="border-amber-200 dark:border-amber-800 lg:col-span-2">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
								<AlertTriangle className="h-5 w-5" />
								Conflicts to Resolve
							</CardTitle>
							<CardDescription>
								Disagreements or misalignments identified across stakeholder conversations
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ItemList
								items={aggregatedData.all_conflicts}
								routes={routes}
								emptyMessage="No conflicts identified"
							/>
						</CardContent>
					</Card>
				)}

				{/* Goals Alignment */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Goals Alignment
						</CardTitle>
						<CardDescription>Goals and objectives mentioned across conversations</CardDescription>
					</CardHeader>
					<CardContent>
						<ItemList items={aggregatedData.all_goals} routes={routes} emptyMessage="No goals captured" />
					</CardContent>
				</Card>

				{/* Concerns */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5" />
							Stakeholder Concerns
						</CardTitle>
						<CardDescription>Concerns raised by stakeholders</CardDescription>
					</CardHeader>
					<CardContent>
						<ItemList items={aggregatedData.all_concerns} routes={routes} emptyMessage="No concerns captured" />
					</CardContent>
				</Card>

				{/* Risks */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Flag className="h-5 w-5" />
							Identified Risks
						</CardTitle>
						<CardDescription>Risks identified across all conversations</CardDescription>
					</CardHeader>
					<CardContent>
						<ItemList items={aggregatedData.all_risks} routes={routes} emptyMessage="No risks captured" />
					</CardContent>
				</Card>

				{/* Open Questions */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<HelpCircle className="h-5 w-5" />
							Open Questions
						</CardTitle>
						<CardDescription>Questions that still need answers</CardDescription>
					</CardHeader>
					<CardContent>
						<ItemList
							items={aggregatedData.all_open_questions}
							routes={routes}
							emptyMessage="No open questions"
						/>
					</CardContent>
				</Card>

				{/* Stakeholders */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Key Stakeholders
						</CardTitle>
						<CardDescription>People identified across conversations</CardDescription>
					</CardHeader>
					<CardContent>
						<StakeholdersList stakeholders={aggregatedData.stakeholders} routes={routes} />
					</CardContent>
				</Card>

				{/* Next Steps */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5" />
							Action Items
						</CardTitle>
						<CardDescription>Commitments and next steps from all conversations</CardDescription>
					</CardHeader>
					<CardContent>
						<NextStepsList nextSteps={aggregatedData.next_steps} routes={routes} />
					</CardContent>
				</Card>
			</div>

			{/* Detailed Sections - Collapsible */}
			<div className="space-y-4">
				<h2 className="font-semibold text-lg">Detailed Breakdown</h2>

				{/* Context & Brief */}
				{aggregatedData.context_brief_fields.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Context & Brief</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldValuesList fields={aggregatedData.context_brief_fields} routes={routes} />
						</CardContent>
					</Card>
				)}

				{/* Plan & Milestones */}
				{aggregatedData.plan_milestones_fields.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Plan & Milestones</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldValuesList fields={aggregatedData.plan_milestones_fields} routes={routes} />
						</CardContent>
					</Card>
				)}

				{/* Risks & Mitigations */}
				{aggregatedData.risks_mitigations_fields.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Risks & Mitigations</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldValuesList fields={aggregatedData.risks_mitigations_fields} routes={routes} />
						</CardContent>
					</Card>
				)}
			</div>

			{/* Source Interviews */}
			<Card>
				<CardHeader>
					<CardTitle>Source Conversations</CardTitle>
					<CardDescription>Interviews contributing to this analysis</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-2 md:grid-cols-2">
						{aggregatedData.interviews.map((interview) => (
							<Link
								key={interview.interview_id}
								to={routes.interviews.detail(interview.interview_id)}
								className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
							>
								<div>
									<p className="font-medium text-sm">{interview.interview_title}</p>
									{interview.interviewee_name && (
										<p className="text-muted-foreground text-xs">{interview.interviewee_name}</p>
									)}
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</Link>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
