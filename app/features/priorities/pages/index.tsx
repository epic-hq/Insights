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
import { Bot, Calendar as CalendarIcon, ChevronDown, ChevronRight, Filter, LayoutGrid, List, X } from "lucide-react"
import * as React from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Link, redirect, useFetcher, useLoaderData, useSearchParams } from "react-router"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import InlineEdit from "~/components/ui/inline-edit"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context"
import { PriorityBars, priorityConfig } from "~/features/tasks/components/PriorityBars"
import { TaskCreateModal } from "~/features/tasks/components/TaskCreateModal"
import { StatusDropdown } from "~/features/tasks/components/TaskStatus"
import { createTask, getTasks, updateTask } from "~/features/tasks/db"
import { seedTasks } from "~/features/tasks/seed"
import type { Task, TaskStatus } from "~/features/tasks/types"
import { userContext } from "~/server/user-context"

type Stage = "activation" | "onboarding" | "retention"
type Impact = 1 | 2 | 3
type Priority = 1 | 2 | 3
type Category =
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
	category: Category
	due_date: string | null
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

	// DEBUG: Detailed logging to track down task access issues
	consola.info("🔍 [PRIORITIES DEBUG] Loader started")
	consola.info("🔍 [PRIORITIES DEBUG] URL params:", { accountId, projectId })
	consola.info("🔍 [PRIORITIES DEBUG] User:", { email: ctx.claims?.email, userId: ctx.claims?.sub })
	consola.info(
		"🔍 [PRIORITIES DEBUG] User's accounts:",
		ctx.accounts?.map((a) => ({
			accountId: a.account_id,
			name: a.name,
			personal: a.personal_account,
			role: a.account_role,
		}))
	)
	consola.info("🔍 [PRIORITIES DEBUG] Requesting accountId from URL:", accountId)

	if (!accountId || !projectId) {
		throw new Response("Missing account or project ID", { status: 400 })
	}

	// Verify user has access to this account
	const userAccounts = ctx.accounts || []
	const hasAccess = userAccounts.some((acc) => acc.account_id === accountId)
	consola.info("🔍 [PRIORITIES DEBUG] Access check:", {
		hasAccess,
		urlAccountId: accountId,
		userAccountIds: userAccounts.map((a) => a.account_id),
	})
	if (!hasAccess) {
		consola.warn("🚫 [PRIORITIES DEBUG] User denied access to account:", accountId)
		throw new Response("Unauthorized: You don't have access to this account", { status: 403 })
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
	const tasks = await getTasks({
		supabase: ctx.supabase,
		accountId,
		projectId,
		options: {},
	})

	// consola.info("🔍 [PRIORITIES DEBUG] Fetched tasks:", {
	// 	count: tasks.length,
	// 	requestedAccountId: accountId,
	// 	requestedProjectId: projectId,
	// 	uniqueAccountIdsInResults: [...new Set(tasks.map((t) => t.account_id))],
	// 	uniqueProjectIdsInResults: [...new Set(tasks.map((t) => t.project_id))],
	// 	// Show first 3 task titles for debugging
	// 	sampleTasks: tasks.slice(0, 3).map((t) => ({ id: t.id, title: t.title, account_id: t.account_id })),
	// })

	// If no tasks exist, seed with initial data
	// if (!tasks || tasks.length === 0) {
	// 	const seedResult = await seedTasks({
	// 		supabase: ctx.supabase,
	// 		accountId,
	// 		projectId,
	// 		userId,
	// 	})

	// 	if (seedResult.success) {
	// 		// Fetch again after seeding
	// 		tasks = await getTasks({
	// 			supabase: ctx.supabase,
	// 			accountId,
	// 			projectId,
	// 			options: {},
	// 		})
	// 	}
	// }

	const projectPath = `/a/${accountId}/${projectId}`
	return { tasks, accountId, projectId, statusFilter, priorityFilter, projectPath }
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
				parsedValue = Number.parseInt(value, 10)
			} else if (field === "status") {
				parsedValue = value as TaskStatus
			} else if (field === "due_date") {
				parsedValue = value === "" ? null : value
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

	// Handle task creation from modal
	const intent = formData.get("intent") as string
	if (intent === "create") {
		const title = formData.get("title") as string
		const description = formData.get("description") as string
		const cluster = formData.get("cluster") as string
		const priority = Number.parseInt(formData.get("priority") as string, 10) || 3

		if (!title) {
			return { success: false, error: "Title is required" }
		}

		// Get accountId and projectId from the URL
		const url = new URL(request.url)
		const pathParts = url.pathname.split("/")
		const accountId = pathParts[2] // /a/:accountId/:projectId/priorities
		const projectId = pathParts[3]

		if (!accountId || !projectId) {
			throw new Response("Missing account or project ID", { status: 400 })
		}

		try {
			await createTask({
				supabase: ctx.supabase,
				accountId,
				projectId,
				userId,
				data: {
					title,
					description: description || null,
					cluster: cluster || "Core product – capture & workflow",
					priority: priority as 1 | 2 | 3,
				},
			})

			return { success: true }
		} catch (error) {
			consola.error("Error creating task:", error)
			return { success: false, error: "Failed to create task" }
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
		category: task.cluster as Category, // DB field is 'cluster', UI shows 'category'
		due_date: task.due_date,
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

function TaskTitleCell({ taskId, value, detailHref }: { taskId: string; value: string; detailHref: string }) {
	const fetcher = useFetcher()

	const handleSubmit = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "title")
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<div className="flex items-center gap-2">
			<Link to={detailHref} className="flex-1 font-medium text-foreground text-sm hover:text-primary hover:underline">
				{value}
			</Link>
		</div>
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

	const handleStatusChange = (_taskId: string, newStatus: TaskStatus) => {
		if (newStatus === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "status")
		formData.append("value", newStatus)

		fetcher.submit(formData, { method: "POST" })
	}

	return <StatusDropdown currentStatus={displayValue} taskId={taskId} onStatusChange={handleStatusChange} size="sm" />
}

function EditablePriorityCell({ taskId, value }: { taskId: string; value: Priority }) {
	const fetcher = useFetcher()
	const [open, setOpen] = React.useState(false)

	// Use optimistic value if update is in progress
	const displayValue = React.useMemo(() => {
		if (fetcher.formData && fetcher.formData.get("taskId") === taskId && fetcher.formData.get("field") === "priority") {
			const optimisticValue = fetcher.formData.get("value")
			return optimisticValue ? (Number.parseInt(optimisticValue as string, 10) as Priority) : value
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

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted">
					<PriorityBars priority={displayValue} size="default" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-48" align="center">
				<div className="space-y-2">
					<h4 className="font-semibold text-sm">Set Priority</h4>
					<div className="space-y-1">
						{[3, 2, 1].map((p) => (
							<Button
								key={p}
								variant={displayValue === p ? "default" : "ghost"}
								size="sm"
								className="w-full justify-start"
								onClick={() => handleSelect(p)}
							>
								<PriorityBars priority={p} size="default" />
								<span className="ml-2">{priorityConfig[p as 1 | 2 | 3].label}</span>
							</Button>
						))}
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
			return optimisticValue ? (Number.parseInt(optimisticValue as string, 10) as Impact) : value
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

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted">
					<PriorityBars priority={displayValue} size="default" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-48" align="center">
				<div className="space-y-2">
					<h4 className="font-semibold text-sm">Set Impact</h4>
					<div className="space-y-1">
						{[3, 2, 1].map((i) => (
							<Button
								key={i}
								variant={displayValue === i ? "default" : "ghost"}
								size="sm"
								className="w-full justify-start"
								onClick={() => handleSelect(i)}
							>
								<PriorityBars priority={i} size="default" />
								<span className="ml-2">{priorityConfig[i as 1 | 2 | 3].label}</span>
							</Button>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

function EditableDueDateCell({ taskId, value }: { taskId: string; value: string | null }) {
	const fetcher = useFetcher()
	const [open, setOpen] = React.useState(false)
	const [optimisticValue, setOptimisticValue] = React.useState<string | null>(value)

	// Sync optimistic value when prop changes (after server response)
	React.useEffect(() => {
		setOptimisticValue(value)
	}, [value])

	const handleSelect = (date: Date | undefined) => {
		const newValue = date ? date.toISOString().split("T")[0] : null
		setOptimisticValue(newValue)

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "due_date")
		formData.append("value", newValue || "")

		fetcher.submit(formData, { method: "POST" })
		if (date) setOpen(false)
	}

	const handleClear = () => {
		setOptimisticValue(null)

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("taskId", taskId)
		formData.append("field", "due_date")
		formData.append("value", "")

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
	}

	const selectedDate = optimisticValue ? new Date(optimisticValue) : undefined
	const now = new Date()
	const isOverdue = selectedDate && selectedDate < now && selectedDate.toDateString() !== now.toDateString()
	const isToday = selectedDate && selectedDate.toDateString() === now.toDateString()

	const formatted = selectedDate ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-muted ${isOverdue
						? "text-red-600 dark:text-red-400"
						: isToday
							? "text-amber-600 dark:text-amber-400"
							: "text-muted-foreground"
						}`}
				>
					{formatted ? (
						<>
							<CalendarIcon className="h-3 w-3" />
							{formatted}
						</>
					) : (
						<span className="text-muted-foreground/50">—</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="single" selected={selectedDate} onSelect={handleSelect} initialFocus />
				{optimisticValue && (
					<div className="border-t p-2">
						<Button variant="ghost" size="sm" onClick={handleClear} className="w-full">
							<X className="mr-2 h-4 w-4" />
							Clear date
						</Button>
					</div>
				)}
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
									className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${currentFilter === option.value ? "bg-muted font-medium" : ""
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
									className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${currentFilter === option.value ? "bg-muted font-medium" : ""
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

const createColumns = (
	tasks: Task[],
	statusFilter: string,
	priorityFilter: string,
	projectPath: string
): ColumnDef<FeatureRow>[] => [
		{
			accessorKey: "category",
			header: "Category",
			// Hidden column - used for grouping and filtering only
			cell: ({ row }) => <span>{row.original.category}</span>,
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
			cell: ({ row }) => (
				<TaskTitleCell
					taskId={row.original.id}
					value={row.original.feature}
					detailHref={`${projectPath}/priorities/${row.original.id}`}
				/>
			),
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
			accessorKey: "due_date",
			header: () => {
				return <ColumnHeader title="Due" tooltip="The target date for completing this task" />
			},
			cell: ({ row }) => <EditableDueDateCell taskId={row.original.id} value={row.original.due_date} />,
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
- Category: ${row.category}

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
	const { tasks, statusFilter, priorityFilter, projectPath } = useLoaderData<typeof loader>()
	const [searchParams, setSearchParams] = useSearchParams()
	const [compactView, setCompactView] = React.useState(true)

	// Handle ?new=true query param to open create modal
	const showCreateModal = searchParams.get("new") === "true"
	const handleCreateModalChange = (open: boolean) => {
		if (!open) {
			// Remove ?new param when closing
			const newParams = new URLSearchParams(searchParams)
			newParams.delete("new")
			setSearchParams(newParams, { replace: true })
		}
	}

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
		() => createColumns(tasks, statusFilter, priorityFilter, projectPath),
		[tasks, statusFilter, priorityFilter, projectPath]
	)

	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "priority", desc: false },
		{ id: "impact", desc: true },
	])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [grouping, setGrouping] = React.useState<GroupingState>(["category"])
	// User controls expansion state - preserve across updates
	// Start with all groups expanded
	const [expanded, setExpanded] = React.useState<ExpandedState>(true)

	// Keep groups expanded on fresh load and after filtering
	React.useEffect(() => {
		setExpanded(true)
	}, [])

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters,
			grouping,
			expanded,
			columnVisibility: {
				category: false, // Hide category column from display
				benefit: !compactView,
				segments: !compactView,
				impact: !compactView, // Hide impact in compact view
				stage: !compactView,
				reason: !compactView,
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
		autoResetExpanded: false, // Preserve expanded state when data changes
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getGroupedRowModel: getGroupedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	})

	const stageOptions: Stage[] = ["activation", "onboarding", "retention"]
	const categoryOptions: Category[] = [
		"Core product – capture & workflow",
		"Core product – intelligence",
		"Foundation – reliability & UX",
		"Monetization & pricing",
		"Engagement & analytics",
		"Acquisition & marketing",
	]

	return (
		<div className="container mx-auto p-6">
			{/* Task Create Modal - controlled by ?new=true query param */}
			<TaskCreateModal open={showCreateModal} onOpenChange={handleCreateModalChange} />

			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-3xl tracking-tight">Tasks</h1>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
					</span>
					<Button size="sm" onClick={() => setSearchParams({ new: "true" })}>
						Add Task
					</Button>
				</div>
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
							const col = table.getColumn("category")
							col?.setFilterValue(e.target.value === "all" ? "" : e.target.value)
						}}
						className="rounded-md border px-3 py-2 text-sm"
					>
						<option value="all">All categories</option>
						{categoryOptions.map((c) => (
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

					<TooltipProvider>
						<Tooltip delayDuration={300}>
							<TooltipTrigger asChild>
								<Button
									variant={compactView ? "default" : "outline"}
									size="sm"
									onClick={() => setCompactView(!compactView)}
									className="text-xs"
								>
									{compactView ? (
										<List className="mr-1.5 h-3.5 w-3.5" />
									) : (
										<LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
									)}
									{compactView ? "Compact" : "Full"}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p className="text-xs">
									{compactView
										? "Showing compact view (Tasks, Priority, Due, Status, Action)"
										: "Switch to compact view (hide Benefits, Segments, Impact, Stage, Reason)"}
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
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
									// Group row (category header)
									return (
										<tr key={row.id} className="border-b bg-slate-200 font-semibold dark:bg-slate-800">
											<td colSpan={columns.length} className="px-4 py-2.5">
												<button
													type="button"
													onClick={row.getToggleExpandedHandler()}
													className="flex items-center gap-2 text-slate-700 hover:text-primary dark:text-slate-200"
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
											// Skip category column in detail rows
											if (cell.column.id === "category") return null
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
