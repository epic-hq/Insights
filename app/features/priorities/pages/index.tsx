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
import consola from "consola"
import { Bot, ChevronDown, ChevronRight, Filter, Info } from "lucide-react"
import * as React from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Link, redirect, useFetcher, useLoaderData } from "react-router"
import { Button } from "~/components/ui/button"
import InlineEdit from "~/components/ui/inline-edit"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context"
import { getTasks, updateTask } from "~/features/tasks/db"
import { seedTasks } from "~/features/tasks/seed"
import type { Task, TaskStatus } from "~/features/tasks/types"
import { userContext } from "~/server/user-context"

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

// ============================================================================
// Loader - Fetch tasks from database
// ============================================================================

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)

	if (!ctx?.claims) {
		return redirect("/login")
	}

	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Missing account or project ID", { status: 400 })
	}

	if (!ctx.supabase) {
		throw new Response("Supabase client missing", { status: 500 })
	}

	const userId = ctx.claims.sub

	// Get filters from URL
	const url = new URL(request.url)
	const statusFilter = url.searchParams.get("status") || "all"
	const priorityFilter = url.searchParams.get("priority") || "all"

	// Fetch ALL tasks for this project (no filters applied server-side)
	// We'll filter on the client to ensure counts are accurate
	let tasks = await getTasks({
		supabase: ctx.supabase,
		projectId,
		options: {},
	})

	// If no tasks exist, seed with initial data
	if (!tasks || tasks.length === 0) {
		const seedResult = await seedTasks({
			supabase: ctx.supabase,
			accountId,
			projectId,
			userId,
		})

		if (seedResult.success) {
			// Fetch again after seeding
			tasks = await getTasks({
				supabase: ctx.supabase,
				projectId,
				options: {},
			})
		}
	}

	return { tasks, accountId, projectId, statusFilter, priorityFilter }
}

// ============================================================================
// Action - Handle updates
// ============================================================================

export async function action({ context, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)

	if (!ctx?.claims) {
		throw new Response("Unauthorized", { status: 401 })
	}

	if (!ctx.supabase) {
		throw new Response("Supabase client missing", { status: 500 })
	}

	const userId = ctx.claims.sub
	const formData = await request.formData()
	const action = formData.get("_action") as string
	const taskId = formData.get("taskId") as string
	const field = formData.get("field") as string
	const value = formData.get("value") as string

	if (action === "update-field") {
		if (!taskId || !field) {
			throw new Response("Missing required fields", { status: 400 })
		}

		try {
			// Parse value based on field type
			let parsedValue: unknown = value
			if (field === "priority" || field === "impact") {
				parsedValue = Number.parseInt(value)
			} else if (field === "status") {
				parsedValue = value as TaskStatus
			}

			await updateTask({
				supabase: ctx.supabase,
				taskId,
				userId,
				updates: { [field]: parsedValue } as any,
			})

			return { success: true }
		} catch (error) {
			consola.error("Error updating task:", error)
			throw new Response("Failed to update task", { status: 500 })
		}
	}

	throw new Response("Invalid action", { status: 400 })
}

// ============================================================================
// Transform Task to FeatureRow
// ============================================================================

function taskToFeatureRow(task: Task): FeatureRow {
	return {
		id: task.id,
		feature: task.title,
		benefit: task.benefit || "",
		segments: task.segments || "",
		impact: (task.impact || 1) as Impact,
		stage: (task.stage || "activation") as Stage,
		priority: task.priority as Priority,
		reason: task.reason || "",
		cluster: task.cluster as Cluster,
	}
}

// ============================================================================
// Editable Cell Components
// ============================================================================

function EditableTextCell({ taskId, field, value }: { taskId: string; field: string; value: string }) {
	const fetcher = useFetcher()

	const handleSubmit = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", field)
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<InlineEdit
			value={value}
			onSubmit={handleSubmit}
			textClassName="text-sm text-foreground"
			inputClassName="text-sm"
			multiline={field === "benefit" || field === "reason"}
			autoSize={true}
		/>
	)
}

function EditableStatusCell({ taskId, value }: { taskId: string; value: TaskStatus }) {
	const fetcher = useFetcher()

	// Use optimistic value if update is in progress
	const displayValue = React.useMemo(() => {
		if (fetcher.formData && fetcher.formData.get("taskId") === taskId && fetcher.formData.get("field") === "status") {
			const optimisticValue = fetcher.formData.get("value")
			return optimisticValue ? (optimisticValue as TaskStatus) : value
		}
		return value
	}, [fetcher.formData, taskId, value])

	const handleChange = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "status")
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	const statusConfig: Record<TaskStatus, { label: string; className: string; shortLabel: string }> = {
		backlog: {
			label: "Backlog",
			shortLabel: "Backlog",
			className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
		},
		todo: {
			label: "To Do",
			shortLabel: "Todo",
			className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
		},
		in_progress: {
			label: "In Progress",
			shortLabel: "In Progress",
			className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
		},
		blocked: {
			label: "Blocked",
			shortLabel: "Blocked",
			className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
		},
		review: {
			label: "In Review",
			shortLabel: "Review",
			className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
		},
		done: {
			label: "Done",
			shortLabel: "Done",
			className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
		},
		archived: {
			label: "Archived",
			shortLabel: "Archived",
			className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
		},
	}

	const currentStatus = statusConfig[displayValue] || statusConfig.backlog

	return (
		<Select value={displayValue} onValueChange={handleChange}>
			<SelectTrigger className="h-7 w-28 border-0 bg-transparent p-0 text-xs hover:bg-muted">
				<span
					className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${currentStatus.className}`}
				>
					{currentStatus.shortLabel}
				</span>
			</SelectTrigger>
			<SelectContent>
				{Object.entries(statusConfig).map(([val, config]) => (
					<SelectItem key={val} value={val} className="text-xs">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${config.className}`}
						>
							{config.label}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function EditablePriorityCell({ taskId, value }: { taskId: string; value: Priority }) {
	const fetcher = useFetcher()
	const [open, setOpen] = React.useState(false)

	// Use optimistic value if update is in progress
	const displayValue = React.useMemo(() => {
		if (fetcher.formData && fetcher.formData.get("taskId") === taskId && fetcher.formData.get("field") === "priority") {
			const optimisticValue = fetcher.formData.get("value")
			return optimisticValue ? (Number.parseInt(optimisticValue as string) as Priority) : value
		}
		return value
	}, [fetcher.formData, taskId, value])

	const handleSelect = (newValue: number) => {
		if (newValue === value) {
			setOpen(false)
			return
		}

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "priority")
		formData.append("value", newValue.toString())

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
	}

	const getPriorityBars = (priority: number, isButton = false) => {
		const colors = {
			3: "bg-emerald-600",
			2: "bg-amber-600",
			1: "bg-slate-600",
		}
		const color = colors[priority as 3 | 2 | 1]
		const mutedColor = isButton ? "bg-muted" : "bg-muted-foreground/30"

		if (priority === 3) {
			return (
				<div className="flex items-end gap-0.5">
					<div className={`h-2.5 w-1 rounded-sm ${color}`} />
					<div className={`h-3 w-1 rounded-sm ${color}`} />
					<div className={`h-3.5 w-1 rounded-sm ${color}`} />
				</div>
			)
		}
		if (priority === 2) {
			return (
				<div className="flex items-end gap-0.5">
					<div className={`h-2.5 w-1 rounded-sm ${color}`} />
					<div className={`h-3 w-1 rounded-sm ${color}`} />
					<div className={`h-3.5 w-1 rounded-sm ${mutedColor}`} />
				</div>
			)
		}
		return (
			<div className="flex items-end gap-0.5">
				<div className={`h-2.5 w-1 rounded-sm ${color}`} />
				<div className={`h-3 w-1 rounded-sm ${mutedColor}`} />
				<div className={`h-3.5 w-1 rounded-sm ${mutedColor}`} />
			</div>
		)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted">
					{getPriorityBars(displayValue)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-48" align="center">
				<div className="space-y-2">
					<h4 className="font-semibold text-sm">Set Priority</h4>
					<div className="space-y-1">
						<Button
							variant={displayValue === 3 ? "default" : "ghost"}
							size="sm"
							className="w-full justify-start"
							onClick={() => handleSelect(3)}
						>
							{getPriorityBars(3, true)}
							<span className="ml-2">High (3)</span>
						</Button>
						<Button
							variant={displayValue === 2 ? "default" : "ghost"}
							size="sm"
							className="w-full justify-start"
							onClick={() => handleSelect(2)}
						>
							{getPriorityBars(2, true)}
							<span className="ml-2">Medium (2)</span>
						</Button>
						<Button
							variant={displayValue === 1 ? "default" : "ghost"}
							size="sm"
							className="w-full justify-start"
							onClick={() => handleSelect(1)}
						>
							{getPriorityBars(1, true)}
							<span className="ml-2">Low (1)</span>
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

function EditableImpactCell({ taskId, value }: { taskId: string; value: Impact }) {
	const fetcher = useFetcher()
	const [open, setOpen] = React.useState(false)

	// Use optimistic value if update is in progress
	const displayValue = React.useMemo(() => {
		if (fetcher.formData && fetcher.formData.get("taskId") === taskId && fetcher.formData.get("field") === "impact") {
			const optimisticValue = fetcher.formData.get("value")
			return optimisticValue ? (Number.parseInt(optimisticValue as string) as Impact) : value
		}
		return value
	}, [fetcher.formData, taskId, value])

	const handleSelect = (newValue: number) => {
		if (newValue === value) {
			setOpen(false)
			return
		}

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "impact")
		formData.append("value", newValue.toString())

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
	}

	const getImpactBars = (impact: number, isButton = false) => {
		const colors = {
			3: "bg-emerald-600",
			2: "bg-amber-600",
			1: "bg-slate-600",
		}
		const color = colors[impact as 3 | 2 | 1]
		const mutedColor = isButton ? "bg-muted" : "bg-muted-foreground/30"

		if (impact === 3) {
			return (
				<div className="flex items-end gap-0.5">
					<div className={`h-2.5 w-1 rounded-sm ${color}`} />
					<div className={`h-3 w-1 rounded-sm ${color}`} />
					<div className={`h-3.5 w-1 rounded-sm ${color}`} />
				</div>
			)
		}
		if (impact === 2) {
			return (
				<div className="flex items-end gap-0.5">
					<div className={`h-2.5 w-1 rounded-sm ${color}`} />
					<div className={`h-3 w-1 rounded-sm ${color}`} />
					<div className={`h-3.5 w-1 rounded-sm ${mutedColor}`} />
				</div>
			)
		}
		return (
			<div className="flex items-end gap-0.5">
				<div className={`h-2.5 w-1 rounded-sm ${color}`} />
				<div className={`h-3 w-1 rounded-sm ${mutedColor}`} />
				<div className={`h-3.5 w-1 rounded-sm ${mutedColor}`} />
			</div>
		)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted">
					{getImpactBars(displayValue)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-48" align="center">
				<div className="space-y-2">
					<h4 className="font-semibold text-sm">Set Impact</h4>
					<div className="space-y-1">
						<Button
							variant={displayValue === 3 ? "default" : "ghost"}
							size="sm"
							className="w-full justify-start"
							onClick={() => handleSelect(3)}
						>
							{getImpactBars(3, true)}
							<span className="ml-2">High (3)</span>
						</Button>
						<Button
							variant={displayValue === 2 ? "default" : "ghost"}
							size="sm"
							className="w-full justify-start"
							onClick={() => handleSelect(2)}
						>
							{getImpactBars(2, true)}
							<span className="ml-2">Medium (2)</span>
						</Button>
						<Button
							variant={displayValue === 1 ? "default" : "ghost"}
							size="sm"
							className="w-full justify-start"
							onClick={() => handleSelect(1)}
						>
							{getImpactBars(1, true)}
							<span className="ml-2">Low (1)</span>
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

// ============================================================================
// Column Header Components
// ============================================================================

function ColumnHeader({ title, tooltip }: { title: string; tooltip: string }) {
	return (
		<TooltipProvider>
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<span className="cursor-help font-semibold">{title}</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-xs">
					<p className="text-xs">{tooltip}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

function SortableColumnHeader({ title, tooltip, column }: { title: string; tooltip: string; column: any }) {
	return (
		<TooltipProvider>
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="flex items-center gap-1 hover:text-primary"
					>
						<span className="font-semibold">{title}</span>
						{column.getIsSorted() === "asc" && <span>↑</span>}
						{column.getIsSorted() === "desc" && <span>↓</span>}
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-xs">
					<p className="text-xs">{tooltip}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

// ============================================================================
// Status Display Components
// ============================================================================

function StatusBadge({ status }: { status: TaskStatus }) {
	const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
		backlog: { label: "Backlog", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
		todo: { label: "To Do", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
		in_progress: {
			label: "In Progress",
			className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
		},
		blocked: { label: "Blocked", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
		review: { label: "In Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
		done: { label: "Done", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
		archived: { label: "Archived", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
	}

	const config = statusConfig[status] || statusConfig.backlog

	return (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${config.className}`}>
			{config.label}
		</span>
	)
}

function StatusFilterHeader({ currentFilter, tasks }: { currentFilter: string; tasks: Task[] }) {
	const [open, setOpen] = React.useState(false)

	// Count tasks by status
	const statusCounts = React.useMemo(() => {
		const counts: Record<string, number> = {
			all: tasks.length,
			backlog: 0,
			todo: 0,
			in_progress: 0,
			blocked: 0,
			review: 0,
			done: 0,
			archived: 0,
		}
		tasks.forEach((task) => {
			if (task.status && counts[task.status] !== undefined) {
				counts[task.status]++
			}
		})
		return counts
	}, [tasks])

	const filterOptions = [
		{ value: "all", label: "All", className: "text-foreground" },
		{ value: "backlog", label: "Backlog", className: "text-slate-700 dark:text-slate-300" },
		{ value: "todo", label: "To Do", className: "text-blue-700 dark:text-blue-300" },
		{ value: "in_progress", label: "In Progress", className: "text-purple-700 dark:text-purple-300" },
		{ value: "blocked", label: "Blocked", className: "text-red-700 dark:text-red-300" },
		{ value: "review", label: "In Review", className: "text-amber-700 dark:text-amber-300" },
		{ value: "done", label: "Done", className: "text-green-700 dark:text-green-300" },
		{ value: "archived", label: "Archived", className: "text-gray-700 dark:text-gray-300" },
	]

	return (
		<TooltipProvider>
			<Tooltip delayDuration={300}>
				<Popover open={open} onOpenChange={setOpen}>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="sm" className="flex h-auto items-center gap-1 p-0 hover:bg-transparent">
								<span className="font-semibold">Status</span>
								<Filter className="h-3.5 w-3.5 text-muted-foreground" />
							</Button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent className="max-w-xs">
						<p className="text-xs">The current status of the task in the workflow</p>
					</TooltipContent>
					<PopoverContent className="w-48" align="start">
						<div className="space-y-1">
							<h4 className="mb-2 font-semibold text-muted-foreground text-xs">Show:</h4>
							{filterOptions.map((option) => (
								<Link
									key={option.value}
									to={`?status=${option.value}`}
									preventScrollReset
									onClick={() => setOpen(false)}
									className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
										currentFilter === option.value ? "bg-muted font-medium" : ""
									}`}
								>
									<span className={option.className}>{option.label}</span>
									<span className="text-muted-foreground text-xs">({statusCounts[option.value] || 0})</span>
								</Link>
							))}
						</div>
					</PopoverContent>
				</Popover>
			</Tooltip>
		</TooltipProvider>
	)
}

function PriorityFilterHeader({ currentFilter, tasks }: { currentFilter: string; tasks: Task[] }) {
	const [open, setOpen] = React.useState(false)

	// Count tasks by priority
	const priorityCounts = React.useMemo(() => {
		const counts: Record<string, number> = {
			all: tasks.length,
			high: 0,
			medium: 0,
			low: 0,
		}
		tasks.forEach((task) => {
			if (task.priority === 3) counts.high++
			else if (task.priority === 2) counts.medium++
			else if (task.priority === 1) counts.low++
		})
		return counts
	}, [tasks])

	const filterOptions = [
		{ value: "all", label: "All", className: "text-foreground" },
		{ value: "high", label: "High", color: "emerald", className: "text-emerald-700 dark:text-emerald-300" },
		{ value: "medium", label: "Medium", color: "amber", className: "text-amber-700 dark:text-amber-300" },
		{ value: "low", label: "Low", color: "slate", className: "text-slate-700 dark:text-slate-300" },
	]

	return (
		<TooltipProvider>
			<Tooltip delayDuration={300}>
				<Popover open={open} onOpenChange={setOpen}>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="sm" className="flex h-auto items-center gap-1 p-0 hover:bg-transparent">
								<span className="font-semibold">Priority</span>
								<Filter className="h-3.5 w-3.5 text-muted-foreground" />
							</Button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent className="max-w-xs">
						<p className="text-xs">The priority level of the task (High/Medium/Low)</p>
					</TooltipContent>
					<PopoverContent className="w-48" align="start">
						<div className="space-y-1">
							<h4 className="mb-2 font-semibold text-muted-foreground text-xs">Show:</h4>
							{filterOptions.map((option) => (
								<Link
									key={option.value}
									to={`?priority=${option.value}`}
									preventScrollReset
									onClick={() => setOpen(false)}
									className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
										currentFilter === option.value ? "bg-muted font-medium" : ""
									}`}
								>
									<div className="flex items-center">
										{option.color && <span className={`mr-2 h-2 w-2 rounded-full bg-${option.color}-600`} />}
										<span className={option.className}>{option.label}</span>
									</div>
									<span className="text-muted-foreground text-xs">({priorityCounts[option.value] || 0})</span>
								</Link>
							))}
						</div>
					</PopoverContent>
				</Popover>
			</Tooltip>
		</TooltipProvider>
	)
}

// ============================================================================
// Table Columns
// ============================================================================

const createColumns = (tasks: Task[], statusFilter: string, priorityFilter: string): ColumnDef<FeatureRow>[] => [
	{
		accessorKey: "cluster",
		header: "Cluster",
		// Hidden column - used for grouping and filtering only
		cell: ({ row }) => <span>{row.original.cluster}</span>,
	},
	{
		accessorKey: "feature",
		header: ({ column }) => {
			return (
				<SortableColumnHeader
					title="Tasks"
					tooltip="The task, feature, or initiative to be implemented"
					column={column}
				/>
			)
		},
		cell: ({ row }) => <EditableTextCell taskId={row.original.id} field="title" value={row.original.feature} />,
	},
	{
		accessorKey: "benefit",
		header: () => {
			return <ColumnHeader title="Benefits" tooltip="Who benefits from this task and what value it provides to them" />
		},
		cell: ({ row }) => <EditableTextCell taskId={row.original.id} field="benefit" value={row.original.benefit} />,
	},
	{
		accessorKey: "segments",
		header: () => {
			return <ColumnHeader title="Segments" tooltip="The customer or user segments this task targets" />
		},
		cell: ({ row }) => <EditableTextCell taskId={row.original.id} field="segments" value={row.original.segments} />,
	},
	{
		accessorKey: "impact",
		header: ({ column }) => {
			return (
				<SortableColumnHeader
					title="Impact"
					tooltip="How big of an impact the task will make for the market segment (1=Low, 2=Medium, 3=High)"
					column={column}
				/>
			)
		},
		cell: ({ row }) => <EditableImpactCell taskId={row.original.id} value={row.original.impact} />,
	},
	{
		accessorKey: "stage",
		header: () => {
			return (
				<ColumnHeader
					title="Stage"
					tooltip="The customer journey stage this task addresses (activation, onboarding, retention)"
				/>
			)
		},
		cell: ({ row }) => <EditableTextCell taskId={row.original.id} field="stage" value={row.original.stage} />,
	},
	{
		accessorKey: "priority",
		header: () => {
			return <PriorityFilterHeader currentFilter={priorityFilter} tasks={tasks} />
		},
		cell: ({ row }) => <EditablePriorityCell taskId={row.original.id} value={row.original.priority} />,
	},
	{
		accessorKey: "status",
		header: () => {
			return <StatusFilterHeader currentFilter={statusFilter} tasks={tasks} />
		},
		cell: ({ row }) => {
			// Get status from the original task data
			const task = tasks.find((t) => t.id === row.original.id)
			const status = task?.status || "backlog"
			return <EditableStatusCell taskId={row.original.id} value={status as TaskStatus} />
		},
	},
	{
		accessorKey: "reason",
		header: () => {
			return (
				<ColumnHeader title="Reason" tooltip="Why this task is important and the rationale behind its prioritization" />
			)
		},
		cell: ({ row }) => <EditableTextCell taskId={row.original.id} field="reason" value={row.original.reason} />,
	},
	{
		id: "actions",
		header: () => {
			return (
				<ColumnHeader title="Action" tooltip="Ask the AI assistant for insights and recommendations about this task" />
			)
		},
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

// ============================================================================
// Main Component
// ============================================================================

export default function FeaturePrioritizationPage() {
	const { tasks, statusFilter, priorityFilter } = useLoaderData<typeof loader>()

	// Apply client-side filtering
	const filteredTasks = React.useMemo(() => {
		let filtered = tasks

		// Apply status filter
		if (statusFilter !== "all") {
			filtered = filtered.filter((task) => task.status === statusFilter)
		} else {
			// Default: exclude archived tasks when showing "all"
			filtered = filtered.filter((task) => task.status !== "archived")
		}

		// Apply priority filter
		if (priorityFilter === "high") {
			filtered = filtered.filter((task) => task.priority === 3)
		} else if (priorityFilter === "medium") {
			filtered = filtered.filter((task) => task.priority === 2)
		} else if (priorityFilter === "low") {
			filtered = filtered.filter((task) => task.priority === 1)
		}

		return filtered
	}, [tasks, statusFilter, priorityFilter])

	// Transform filtered tasks to feature rows
	const data = React.useMemo(() => filteredTasks.map(taskToFeatureRow), [filteredTasks])

	// Create columns with ALL tasks (for accurate counts) and filters
	const columns = React.useMemo(
		() => createColumns(tasks, statusFilter, priorityFilter),
		[tasks, statusFilter, priorityFilter]
	)

	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "priority", desc: false },
		{ id: "impact", desc: true },
	])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [grouping, setGrouping] = React.useState<GroupingState>(["cluster"])
	// User controls expansion state - preserve across updates
	// Start with all groups expanded
	const [expanded, setExpanded] = React.useState<ExpandedState>(true)

	// Keep groups expanded on fresh load and after filtering
	React.useEffect(() => {
		setExpanded(true)
	}, [data, columnFilters])

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters,
			grouping,
			expanded,
			columnVisibility: {
				cluster: false, // Hide cluster column from display
			},
		},
		initialState: {
			pagination: {
				pageSize: 1000, // Show all tasks by default
			},
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
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Priorities</h1>
				<span className="text-muted-foreground text-sm">
					{filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
				</span>
			</div>

			<div className="space-y-3">
				{/* Filters */}
				<div className="flex flex-wrap items-center gap-3">
					<input
						type="text"
						placeholder="Search feature..."
						onChange={(e) => table.getColumn("feature")?.setFilterValue(e.target.value)}
						className="w-64 rounded-md border px-3 py-2 text-sm"
					/>

					<select
						onChange={(e) => {
							const col = table.getColumn("cluster")
							col?.setFilterValue(e.target.value === "all" ? "" : e.target.value)
						}}
						className="rounded-md border px-3 py-2 text-sm"
					>
						<option value="all">All clusters</option>
						{clusterOptions.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>

					<select
						onChange={(e) => {
							const col = table.getColumn("stage")
							col?.setFilterValue(e.target.value === "all" ? "" : e.target.value)
						}}
						className="rounded-md border px-3 py-2 text-sm"
					>
						<option value="all">All stages</option>
						{stageOptions.map((s) => (
							<option key={s} value={s} className="capitalize">
								{s}
							</option>
						))}
					</select>

					<Button variant="outline" size="sm" onClick={() => table.toggleAllRowsExpanded()} className="text-xs">
						{table.getIsAllRowsExpanded() ? "Collapse All" : "Expand All"}
					</Button>
				</div>

				{/* Table */}
				<div className="overflow-x-auto rounded-md border">
					<table className="w-full border-collapse text-sm">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id} className="border-b bg-muted/50">
									{headerGroup.headers.map((header) => (
										<th key={header.id} className="px-4 py-3 text-left font-semibold">
											{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row) => {
								if (row.getIsGrouped()) {
									// Group row (cluster header)
									return (
										<tr key={row.id} className="border-b bg-muted/70 font-semibold">
											<td colSpan={columns.length} className="px-4 py-2">
												<button
													type="button"
													onClick={row.getToggleExpandedHandler()}
													className="flex items-center gap-2 hover:text-primary"
												>
													{row.getIsExpanded() ? (
														<ChevronDown className="h-4 w-4" />
													) : (
														<ChevronRight className="h-4 w-4" />
													)}
													<span className="text-xs uppercase tracking-wide">
														{String(row.groupingValue)} ({row.subRows.length})
													</span>
												</button>
											</td>
										</tr>
									)
								}

								// Regular data row
								return (
									<tr key={row.id} className="border-b hover:bg-muted/30">
										{row.getVisibleCells().map((cell) => {
											// Skip cluster column in detail rows
											if (cell.column.id === "cluster") return null
											return (
												<td key={cell.id} className="px-4 py-3">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											)
										})}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>

				{/* Pagination - Disabled by default for tasks */}
				{/*
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
							Previous
						</Button>
						<Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
							Next
						</Button>
					</div>
					<div className="text-muted-foreground text-sm">
						Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
					</div>
				</div>
				*/}
			</div>
		</div>
	)
}
