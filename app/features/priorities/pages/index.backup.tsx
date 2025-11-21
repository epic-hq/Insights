import {
	type ColumnDef,
	type ColumnFiltersState,
	type ExpandedState,
	flexRender,
	type GroupingState,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getGroupedRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { Bot, ChevronDown, ChevronRight } from "lucide-react"
import * as React from "react"
import { Button } from "~/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context"

type Stage = "activation" | "onboarding" | "retention"
type Impact = 1 | 2 | 3
type Priority = 1 | 2 | 3
type Cluster =
	| "Core product – capture & workflow"
	| "Core product – intelligence"
	| "Foundation – reliability & UX"
	| "Monetization & pricing"
	| "Engagement & analytics"
	| "Acquisition & marketing"

export type FeatureRow = {
	id: string
	feature: string
	benefit: string
	segments: string
	impact: Impact
	stage: Stage
	priority: Priority
	reason: string
	cluster: Cluster
}

const DATA: FeatureRow[] = [
	{
		id: "stt",
		feature: "STT input until release or VAD",
		benefit: "Capture calls reliably without friction",
		segments: "Founders, sales reps, research leads",
		impact: 3,
		stage: "activation",
		priority: 1,
		reason: "Core to product promise; blocker to aha moment.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "call-workflow",
		feature: "Call workflow (contact options, survey link, meeting applet)",
		benefit: "Structure before/after call steps and follow-through",
		segments: "Sales reps, CS, founders",
		impact: 3,
		stage: "activation",
		priority: 2,
		reason: "Ties captured calls to outcomes; shows 'close the loop'.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "import-contacts",
		feature: "Import accounts & contacts list",
		benefit: "Fast setup using existing CRM data",
		segments: "New teams, admins, ops",
		impact: 3,
		stage: "onboarding",
		priority: 1,
		reason: "Lowers setup pain; key to first project populated.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "task-list",
		feature: "Task list",
		benefit: "Turn insights into clear next steps",
		segments: "Founders, sales reps, CS",
		impact: 2,
		stage: "retention",
		priority: 2,
		reason: "Connects insights to action; can be simple v1.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "email-to-annotation",
		feature: "Email responses to meetings → annotation",
		benefit: "Automatic debrief + saved notes after calls",
		segments: "Sales reps, founders",
		impact: 2,
		stage: "activation",
		priority: 2,
		reason: "Strong wow moment right after calls; reinforces core value.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "voice-assistant",
		feature: "Voice chat assistant",
		benefit: "In-app conversational help and hands-free control",
		segments: "Power users, busy founders, sales reps",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Nice-to-have; improves depth, not initial value.",
		cluster: "Core product – intelligence",
	},
	{
		id: "docs-generator",
		feature: "Sales/marketing doc generator + folder system",
		benefit: "Reusable decks/emails and clearer library of outputs",
		segments: "Marketing, sales, founders",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Deeper value layer; build after core workflow is stable.",
		cluster: "Core product – intelligence",
	},
	{
		id: "persona-creation",
		feature: "Persona creation",
		benefit: "Clarify who you're learning from and targeting",
		segments: "Product, marketing, founders",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Strategic but not required for first wins.",
		cluster: "Core product – intelligence",
	},
	{
		id: "objection-handling",
		feature: "Sales objection handling",
		benefit: "Guided responses and playbook for common objections",
		segments: "Sales reps, founders doing sales",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Sales enablement layer; good once core adoption exists.",
		cluster: "Core product – intelligence",
	},
	{
		id: "icp-finder",
		feature: "ICP finder feature (bullseye customer)",
		benefit: "Help users focus on best-fit customers/accounts",
		segments: "Founders, Rev leaders, PMs",
		impact: 3,
		stage: "retention",
		priority: 2,
		reason: "Big differentiator; builds on existing data.",
		cluster: "Core product – intelligence",
	},
	{
		id: "oauth",
		feature: "OAuth login reliability",
		benefit: "Trustworthy, glitch-free sign-in",
		segments: "Everyone",
		impact: 3,
		stage: "onboarding",
		priority: 1,
		reason: "Table-stakes; breaks everything if flaky.",
		cluster: "Foundation – reliability & UX",
	},
	{
		id: "app-flow",
		feature: "App flow UX redesign / UI",
		benefit: "Make main journeys obvious and low-friction",
		segments: "All users, especially new signups",
		impact: 3,
		stage: "activation",
		priority: 1,
		reason: "Directly impacts aha moment and day-1 success.",
		cluster: "Foundation – reliability & UX",
	},
	{
		id: "branding",
		feature: "Branding",
		benefit: "Credibility, memorability, and trust",
		segments: "Prospects, new users, investors",
		impact: 2,
		stage: "onboarding",
		priority: 2,
		reason: "Matters for trust; can iterate while fixing flows.",
		cluster: "Foundation – reliability & UX",
	},
	{
		id: "pricing",
		feature: "Pricing on credit system + take credit card",
		benefit: "Turn value into revenue and gate usage sanely",
		segments: "Paying customers, founder/finance",
		impact: 3,
		stage: "activation",
		priority: 1,
		reason: "Needed to charge, test WTP, and control usage.",
		cluster: "Monetization & pricing",
	},
	{
		id: "email-nudges",
		feature: "Email nudges + PostHog instrumentation",
		benefit: "Drive usage and learn what works",
		segments: "Admins, product team, active users",
		impact: 2,
		stage: "retention",
		priority: 2,
		reason: "Needed to keep users coming back and inform roadmap.",
		cluster: "Engagement & analytics",
	},
	{
		id: "webpage-messaging",
		feature: "Webpage messaging and CTA to try app",
		benefit: "Clear promise and path to start a trial",
		segments: "Prospects evaluating tools",
		impact: 3,
		stage: "onboarding",
		priority: 1,
		reason: "You can't test demand or learn without this.",
		cluster: "Acquisition & marketing",
	},
	{
		id: "leadgen-content",
		feature: "Lead generation content and newsletter",
		benefit: "Attract and educate right-fit prospects",
		segments: "Founders, PMs, sales leaders",
		impact: 2,
		stage: "onboarding",
		priority: 2,
		reason: "Fuels top/mid funnel once core app experience is solid.",
		cluster: "Acquisition & marketing",
	},
	{
		id: "paid-ads",
		feature: "Paid ads",
		benefit: "Scalable acquisition once funnel works",
		segments: "Growth/marketing, founders",
		impact: 2,
		stage: "onboarding",
		priority: 3,
		reason: "Dangerous before positioning + activation are dialed in.",
		cluster: "Acquisition & marketing",
	},
	{
		id: "email-intro",
		feature: "Email intro asking for meeting",
		benefit: "Faster outreach to recruit conversations",
		segments: "Founders, sales reps",
		impact: 1,
		stage: "activation",
		priority: 3,
		reason: "Useful, but can be done manually early.",
		cluster: "Acquisition & marketing",
	},
]

const columns: ColumnDef<FeatureRow>[] = [
	{
		accessorKey: "cluster",
		header: "Cluster",
		cell: ({ row }) => <span className="font-semibold text-xs uppercase tracking-wide">{row.original.cluster}</span>,
	},
	{
		accessorKey: "feature",
		header: "Feature",
		cell: ({ row }) => <span className="font-medium">{row.original.feature}</span>,
	},
	{
		accessorKey: "benefit",
		header: "Benefit (who)",
	},
	{
		accessorKey: "segments",
		header: "Segments",
	},
	{
		accessorKey: "impact",
		header: "Impact",
		cell: ({ row }) => {
			const impact = row.original.impact
			// High impact (3): 3 bars
			if (impact === 3) {
				return (
					<div className="flex items-end gap-0.5" title="High impact">
						<div className="h-2.5 w-1 rounded-sm bg-emerald-600" />
						<div className="h-3 w-1 rounded-sm bg-emerald-600" />
						<div className="h-3.5 w-1 rounded-sm bg-emerald-600" />
					</div>
				)
			}
			// Medium impact (2): 2 bars
			if (impact === 2) {
				return (
					<div className="flex items-end gap-0.5" title="Medium impact">
						<div className="h-2.5 w-1 rounded-sm bg-amber-600" />
						<div className="h-3 w-1 rounded-sm bg-amber-600" />
						<div className="h-3.5 w-1 rounded-sm bg-muted-foreground/30" />
					</div>
				)
			}
			// Low impact (1): 1 bar
			return (
				<div className="flex items-end gap-0.5" title="Low impact">
					<div className="h-2.5 w-1 rounded-sm bg-slate-600" />
					<div className="h-3 w-1 rounded-sm bg-muted-foreground/30" />
					<div className="h-3.5 w-1 rounded-sm bg-muted-foreground/30" />
				</div>
			)
		},
	},
	{
		accessorKey: "stage",
		header: "Stage",
		cell: ({ row }) => <span className="capitalize">{row.original.stage}</span>,
	},
	{
		accessorKey: "priority",
		header: "Priority",
		cell: ({ row }) => {
			const priority = row.original.priority
			const badges = {
				1: { label: "Now", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
				2: { label: "Next", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
				3: { label: "Later", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
			}
			const badge = badges[priority as 1 | 2 | 3]
			return (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${badge.className}`}>
					{badge.label}
				</span>
			)
		},
	},
	{
		accessorKey: "reason",
		header: "Reason",
	},
	{
		id: "actions",
		header: "",
		cell: ({ row }) => <AskUppyCell row={row.original} />,
	},
]

function AskUppyCell({ row }: { row: FeatureRow }) {
	const { insertText } = useProjectStatusAgent()
	const [open, setOpen] = React.useState(false)

	const handleAskUppy = () => {
		const question = `Given this initiative: "${row.feature}".

Context:
- Benefit: ${row.benefit}
- Segments: ${row.segments}
- Impact: ${row.impact}/3
- Stage: ${row.stage}
- Priority: ${row.priority}/3 (${row.priority === 1 ? "Now" : row.priority === 2 ? "Next" : "Later"})
- Reason: ${row.reason}
- Cluster: ${row.cluster}

`

		// Insert text into ProjectStatusAgent without navigating
		insertText(question)
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="h-8 w-8">
					<Bot className="h-4 w-4 text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80" align="end">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<Bot className="h-4 w-4" />
						<h4 className="font-semibold text-sm">Ask Uppy</h4>
					</div>
					<p className="text-muted-foreground text-xs">
						Get AI insights about "{row.feature}" including implementation considerations, user impact, and
						prioritization rationale.
					</p>
					<Button onClick={handleAskUppy} size="sm" className="w-full">
						Ask about this feature
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default function FeaturePrioritizationPage() {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "priority", desc: false },
		{ id: "impact", desc: true },
	])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [grouping, setGrouping] = React.useState<GroupingState>(["cluster"])
	const [expanded, setExpanded] = React.useState<ExpandedState>(true)

	const table = useReactTable({
		data: DATA,
		columns,
		state: {
			sorting,
			columnFilters,
			grouping,
			expanded,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGroupingChange: setGrouping,
		onExpandedChange: setExpanded,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getGroupedRowModel: getGroupedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	})

	const stageOptions: Stage[] = ["activation", "onboarding", "retention"]
	const clusterOptions: Cluster[] = [
		"Core product – capture & workflow",
		"Core product – intelligence",
		"Foundation – reliability & UX",
		"Monetization & pricing",
		"Engagement & analytics",
		"Acquisition & marketing",
	]

	return (
		<div className="container mx-auto p-6">
			<h1 className="mb-6 font-bold text-2xl">Feature Prioritization</h1>

			<div className="space-y-3">
				{/* Filters */}
				<div className="flex flex-wrap items-center gap-3">
					<input
						type="text"
						placeholder="Search feature..."
						className="w-60 rounded border border-input bg-background px-2 py-1 text-sm"
						value={(table.getColumn("feature")?.getFilterValue() as string) ?? ""}
						onChange={(e) => table.getColumn("feature")?.setFilterValue(e.target.value)}
					/>

					<select
						className="rounded border border-input bg-background px-2 py-1 text-sm"
						value={(table.getColumn("cluster")?.getFilterValue() as string) ?? ""}
						onChange={(e) => table.getColumn("cluster")?.setFilterValue(e.target.value || undefined)}
					>
						<option value="">All clusters</option>
						{clusterOptions.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>

					<select
						className="rounded border border-input bg-background px-2 py-1 text-sm"
						value={(table.getColumn("stage")?.getFilterValue() as string) ?? ""}
						onChange={(e) => table.getColumn("stage")?.setFilterValue(e.target.value || undefined)}
					>
						<option value="">All stages</option>
						{stageOptions.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>

					<select
						className="rounded border border-input bg-background px-2 py-1 text-sm"
						value={(table.getColumn("impact")?.getFilterValue() as string | number) ?? ""}
						onChange={(e) => table.getColumn("impact")?.setFilterValue(e.target.value || undefined)}
					>
						<option value="">All impacts</option>
						<option value="3">3 (large)</option>
						<option value="2">2 (medium)</option>
						<option value="1">1 (small)</option>
					</select>

					<select
						className="rounded border border-input bg-background px-2 py-1 text-sm"
						value={(table.getColumn("priority")?.getFilterValue() as string | number) ?? ""}
						onChange={(e) => table.getColumn("priority")?.setFilterValue(e.target.value || undefined)}
					>
						<option value="">All priorities</option>
						<option value="1">1 (now)</option>
						<option value="2">2 (next)</option>
						<option value="3">3 (later)</option>
					</select>

					<button
						className="rounded border border-input bg-background px-3 py-1 text-xs hover:bg-accent"
						onClick={() => table.resetColumnFilters()}
					>
						Clear filters
					</button>
				</div>

				{/* Table */}
				<div className="overflow-x-auto rounded border border-border">
					<table className="min-w-full border-collapse text-sm">
						<thead className="bg-muted/50">
							{table.getHeaderGroups().map((hg) => (
								<tr key={hg.id}>
									{hg.headers.map((header) => {
										const canSort = header.column.getCanSort()
										const sortDir = header.column.getIsSorted()
										return (
											<th
												key={header.id}
												className="border-border border-b px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide"
											>
												{canSort ? (
													<button
														className="inline-flex items-center gap-1"
														onClick={header.column.getToggleSortingHandler()}
													>
														{flexRender(header.column.columnDef.header, header.getContext())}
														{sortDir === "asc" && "↑"}
														{sortDir === "desc" && "↓"}
													</button>
												) : (
													flexRender(header.column.columnDef.header, header.getContext())
												)}
											</th>
										)
									})}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.length === 0 ? (
								<tr>
									<td colSpan={columns.length} className="px-3 py-4 text-center text-muted-foreground text-sm">
										No results.
									</td>
								</tr>
							) : (
								table.getRowModel().rows.map((row) => {
									if (row.getIsGrouped()) {
										// Group header row
										return (
											<tr key={row.id} className="bg-muted/70 font-semibold">
												<td colSpan={columns.length} className="px-3 py-3">
													<button onClick={row.getToggleExpandedHandler()} className="flex items-center gap-2 text-sm">
														{row.getIsExpanded() ? (
															<ChevronDown className="h-4 w-4" />
														) : (
															<ChevronRight className="h-4 w-4" />
														)}
														<span className="uppercase tracking-wide">
															{flexRender(row.groupingValue as string, {} as any)} ({row.subRows.length})
														</span>
													</button>
												</td>
											</tr>
										)
									}

									// Regular data row
									return (
										<tr key={row.id} className="border-border border-b even:bg-muted/30 hover:bg-muted/50">
											{row.getVisibleCells().map((cell) => {
												if (cell.getIsGrouped()) {
													return null
												}
												if (cell.getIsAggregated()) {
													return null
												}
												if (cell.getIsPlaceholder()) {
													return <td key={cell.id} />
												}
												return (
													<td key={cell.id} className="px-3 py-2 align-top">
														{flexRender(cell.column.columnDef.cell, cell.getContext())}
													</td>
												)
											})}
										</tr>
									)
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div className="flex items-center justify-between gap-2 text-xs">
					<div>
						Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
					</div>
					<div className="flex items-center gap-1">
						<button
							className="rounded border border-input bg-background px-2 py-1 hover:bg-accent disabled:opacity-40"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							Prev
						</button>
						<button
							className="rounded border border-input bg-background px-2 py-1 hover:bg-accent disabled:opacity-40"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
