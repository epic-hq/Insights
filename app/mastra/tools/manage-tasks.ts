import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { createTask, deleteTask, getTasks, updateTask } from "~/features/tasks/db"
import type { Assignee, AssigneeType, Task, TaskStatus } from "~/features/tasks/types"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { HOST } from "~/paths"
import type { Database } from "~/types"
import { createRouteDefinitions } from "~/utils/route-definitions"

const taskOutputSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	cluster: z.string(),
	status: z.string(),
	priority: z.number(),
	benefit: z.string().nullable().optional(),
	segments: z.string().nullable().optional(),
	impact: z.number().nullable().optional(),
	stage: z.string().nullable().optional(),
	reason: z.string().nullable().optional(),
	assignedTo: z
		.array(
			z.object({
				type: z.string(),
				user_id: z.string().optional(),
				name: z.string().optional(),
				avatar_url: z.string().nullable().optional(),
				agent_type: z.string().optional(),
			})
		)
		.optional(),
	tags: z.array(z.string()).optional(),
	dueDate: z.string().nullable().optional(),
	estimatedEffort: z.string().nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
	completedAt: z.string().nullable().optional(),
	detailRoute: z.string().nullable().optional(),
})

function ensureContext(runtimeContext?: Map<string, unknown> | any) {
	const accountId = runtimeContext?.get?.("account_id") as string | undefined
	const projectId = runtimeContext?.get?.("project_id") as string | undefined
	const userId = runtimeContext?.get?.("user_id") as string | undefined
	if (!accountId || !projectId) {
		throw new Error("Missing accountId or projectId in runtime context")
	}
	if (!userId) {
		throw new Error("Missing userId in runtime context")
	}
	return { accountId, projectId, userId }
}

function buildProjectPath(accountId: string, projectId: string) {
	return `/a/${accountId}/${projectId}`
}

type AssigneeInput = {
	userId?: string
	email?: string
	name?: string
	agentType?: AssigneeType
}

type AccountMember = {
	user_id: string
	first_name?: string | null
	last_name?: string | null
	email?: string | null
}

function normalizeName(name?: string | null) {
	return (name || "").trim().toLowerCase()
}

async function fetchAccountMembers(accountId: string, supabase: SupabaseClient<Database>): Promise<AccountMember[]> {
	const { data: members, error } = await supabase
		.schema("accounts")
		.from("account_user")
		.select("user_id")
		.eq("account_id", accountId)

	if (error || !members || members.length === 0) {
		return []
	}

	const userIds = members.map((m) => m.user_id)
	const { data: profiles, error: profileError } = await supabase
		.from("user_settings")
		.select("user_id, first_name, last_name, email")
		.in("user_id", userIds)

	if (profileError || !profiles) {
		return []
	}

	return profiles
}

async function resolveAssignees({
	accountId,
	supabase,
	assignees,
}: {
	accountId: string
	supabase: SupabaseClient<Database>
	assignees?: AssigneeInput[]
}): Promise<{ resolved: Assignee[]; warnings: string[] }> {
	if (!assignees || assignees.length === 0) return { resolved: [], warnings: [] }

	const warnings: string[] = []
	const members = await fetchAccountMembers(accountId, supabase)

	const findMember = (candidate: AssigneeInput): AccountMember | undefined => {
		if (candidate.userId) {
			return members.find((m) => m.user_id === candidate.userId)
		}
		if (candidate.email) {
			const target = candidate.email.trim().toLowerCase()
			return members.find((m) => (m.email || "").toLowerCase() === target)
		}
		if (candidate.name) {
			const target = normalizeName(candidate.name)
			return members.find((m) => {
				const full = normalizeName(`${m.first_name || ""} ${m.last_name || ""}`)
				const first = normalizeName(m.first_name)
				const last = normalizeName(m.last_name)
				return full === target || first === target || last === target
			})
		}
		return undefined
	}

	const resolved: Assignee[] = assignees.flatMap((candidate) => {
		if (candidate.agentType) {
			return [{ type: "agent" as const, agent_type: candidate.agentType }]
		}

		const member = findMember(candidate)
		if (member) {
			const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim() || member.email || ""
			return [
				{
					type: "human" as const,
					user_id: member.user_id,
					name,
				},
			]
		}

		// Fallback placeholder so the LLM can surface that the person wasn't found
		if (candidate.name) {
			warnings.push(`No teammate found matching "${candidate.name}". Created a placeholder assignee.`)
			return [
				{
					type: "human" as const,
					user_id: `placeholder:${normalizeName(candidate.name) || "unknown"}`,
					name: candidate.name,
				},
			]
		}

		warnings.push("Assignee could not be resolved (missing name/email).")
		return []
	})

	return { resolved, warnings }
}

function formatErrorMessage(error: unknown) {
	if (error && typeof error === "object" && "message" in error) {
		return (error as { message: string }).message
	}
	return String(error)
}

function mapTask(task: Task, projectPath: string) {
	const routes = createRouteDefinitions(projectPath)
	return {
		id: task.id,
		title: task.title,
		description: task.description ?? null,
		cluster: task.cluster,
		status: task.status,
		priority: task.priority,
		benefit: task.benefit ?? null,
		segments: task.segments ?? null,
		impact: task.impact ?? null,
		stage: task.stage ?? null,
		reason: task.reason ?? null,
		assignedTo: task.assigned_to ?? [],
		tags: task.tags ?? [],
		dueDate: task.due_date ?? null,
		estimatedEffort: task.estimated_effort ?? null,
		createdAt: task.created_at,
		updatedAt: task.updated_at,
		completedAt: task.completed_at ?? null,
		detailRoute: `${HOST}${routes.priorities}?taskId=${task.id}`,
	}
}

// ============================================================================
// Fetch Tasks Tool
// ============================================================================

export const fetchTasksTool = createTool({
	id: "fetch-tasks",
	description:
		"List tasks in the current project. Use this to find tasks by title, status, cluster, or priority. Shows task details including title, description, status, priority, impact, stage, and who it's assigned to.",
	inputSchema: z.object({
		search: z.string().optional().describe("Case-insensitive search for task title or description"),
		status: z
			.array(z.enum(["backlog", "todo", "in_progress", "blocked", "review", "done", "archived"]))
			.optional()
			.describe("Filter by task status (can specify multiple)"),
		cluster: z.string().optional().describe("Filter by cluster/category"),
		priority: z.number().int().min(1).max(3).optional().describe("Filter by priority (1=Now, 2=Next, 3=Later)"),
		limit: z.number().int().min(1).max(100).optional().describe("Maximum number of tasks to return"),
		taskIds: z.array(z.string()).optional().describe("Specific task IDs to retrieve"),
		assigneeId: z.string().optional().describe("Filter by assignee user id"),
		assigneeName: z.string().optional().describe("Filter by assignee name (partial, case-insensitive)"),
		tags: z.array(z.string()).optional().describe("Filter by tags (matches any)"),
		dueAfter: z.string().optional().describe("Filter tasks due after this ISO timestamp"),
		dueBefore: z.string().optional().describe("Filter tasks due before this ISO timestamp"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		total: z.number().optional(),
		tasks: z.array(taskOutputSchema).optional(),
		warnings: z.array(z.string()).optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(runtimeContext)
			const projectPath = buildProjectPath(accountId, projectId)
			const warnings: string[] = []

			const tasks = await getTasks({
				supabase,
				accountId,
				projectId,
				options: {
					filters: {
						status: context?.status as TaskStatus[] | undefined,
						cluster: context?.cluster,
						priority: context?.priority as 1 | 2 | 3 | undefined,
						search: context?.search?.trim(),
						assigned_to: context?.assigneeId,
					},
					limit: context?.limit ?? 100,
				},
			})

			let filteredTasks = tasks

			if (context?.taskIds && context.taskIds.length > 0) {
				filteredTasks = filteredTasks.filter((t) => context.taskIds?.includes(t.id))
			}

			if (context?.tags && context.tags.length > 0) {
				filteredTasks = filteredTasks.filter((t) => t.tags?.some((tag) => context.tags?.includes(tag)))
			}

			if (context?.dueAfter) {
				const after = new Date(context.dueAfter).getTime()
				if (!Number.isNaN(after)) {
					filteredTasks = filteredTasks.filter((t) => (t.due_date ? new Date(t.due_date).getTime() >= after : false))
				} else {
					warnings.push("Invalid dueAfter value; ignored.")
				}
			}

			if (context?.dueBefore) {
				const before = new Date(context.dueBefore).getTime()
				if (!Number.isNaN(before)) {
					filteredTasks = filteredTasks.filter((t) => (t.due_date ? new Date(t.due_date).getTime() <= before : false))
				} else {
					warnings.push("Invalid dueBefore value; ignored.")
				}
			}

			if (context?.assigneeName) {
				const members = await fetchAccountMembers(accountId, supabase)
				const needle = normalizeName(context.assigneeName)
				const matchingIds = members
					.filter((m) => {
						const full = normalizeName(`${m.first_name || ""} ${m.last_name || ""}`)
						const first = normalizeName(m.first_name)
						const last = normalizeName(m.last_name)
						return full.includes(needle) || first.includes(needle) || last.includes(needle)
					})
					.map((m) => m.user_id)

				if (matchingIds.length === 0) {
					warnings.push(`No teammate matched "${context.assigneeName}".`)
				} else {
					filteredTasks = filteredTasks.filter((t) =>
						(t.assigned_to || []).some(
							(assignee) => assignee.type === "human" && matchingIds.includes((assignee as any).user_id)
						)
					)
				}
			}

			const mappedTasks = filteredTasks.map((task) => mapTask(task, projectPath))

			return {
				success: true,
				message: `Found ${mappedTasks.length} task(s)`,
				total: mappedTasks.length,
				tasks: mappedTasks,
				warnings: warnings.length > 0 ? warnings : undefined,
			}
		} catch (error) {
			consola.error("Error fetching tasks:", error)
			return {
				success: false,
				message: `Failed to fetch tasks: ${error instanceof Error ? error.message : String(error)}`,
			}
		}
	},
})

// ============================================================================
// Create Task Tool
// ============================================================================

export const createTaskTool = createTool({
	id: "create-task",
	description:
		"Create a new task in the current project. Use this when the user asks you to create a task, add a feature, or track work. Requires a title and cluster at minimum. The cluster groups related tasks (e.g., 'Core product - capture & workflow', 'Foundation - reliability & UX').",
	inputSchema: z.object({
		title: z.string().min(1).describe("Task title (required)"),
		description: z.string().optional().describe("Detailed description of the task"),
		cluster: z.string().min(1).describe("Cluster/category for grouping (required)"),
		status: z
			.enum(["backlog", "todo", "in_progress", "blocked", "review", "done", "archived"])
			.optional()
			.describe("Task status (defaults to 'backlog')"),
		priority: z.number().int().min(1).max(3).optional().describe("Priority: 1=Now, 2=Next, 3=Later (defaults to 3)"),
		benefit: z.string().optional().describe("Benefit or value proposition"),
		segments: z.string().optional().describe("Target user segments"),
		impact: z.number().int().min(1).max(3).optional().describe("Impact level: 1=Low, 2=Medium, 3=High"),
		stage: z.string().optional().describe("Product stage (e.g., activation, onboarding, retention)"),
		reason: z.string().optional().describe("Rationale or reasoning for this task"),
		tags: z.array(z.string()).optional().describe("Tags for categorization"),
		dueDate: z.string().optional().describe("Due date in ISO format"),
		estimatedEffort: z.enum(["S", "M", "L", "XL"]).optional().describe("Estimated effort (S/M/L/XL)"),
		parentTaskId: z.string().optional().describe("Optional parent task ID for subtasks"),
		dependsOnTaskIds: z.array(z.string()).optional().describe("Other task IDs this task depends on"),
		blocksTaskIds: z.array(z.string()).optional().describe("Task IDs that this task blocks"),
		assignees: z
			.array(
				z.object({
					userId: z.string().optional(),
					email: z.string().email().optional(),
					name: z.string().optional(),
					agentType: z.enum(["code-generation", "research", "testing", "documentation"]).optional(),
				})
			)
			.optional()
			.describe("People or agents to assign"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		task: taskOutputSchema.optional(),
		warnings: z.array(z.string()).optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(runtimeContext)
			const projectPath = buildProjectPath(accountId, projectId)
			const { resolved: resolvedAssignees, warnings } = await resolveAssignees({
				accountId,
				supabase,
				assignees: context.assignees,
			})

			const task = await createTask({
				supabase,
				accountId,
				projectId,
				userId,
				data: {
					title: context.title,
					description: context.description ?? null,
					cluster: context.cluster,
					parent_task_id: context.parentTaskId ?? null,
					status: context.status ?? "backlog",
					priority: (context.priority ?? 3) as 1 | 2 | 3,
					benefit: context.benefit ?? null,
					segments: context.segments ?? null,
					impact: context.impact ? (context.impact as 1 | 2 | 3) : null,
					stage: context.stage ?? null,
					reason: context.reason ?? null,
					tags: context.tags ?? [],
					due_date: context.dueDate ?? null,
					estimated_effort: context.estimatedEffort ?? null,
					actual_hours: null,
					assigned_to: resolvedAssignees,
					depends_on_task_ids: context.dependsOnTaskIds ?? [],
					blocks_task_ids: context.blocksTaskIds ?? [],
				},
			})

			return {
				success: true,
				message: `Created task "${task.title}" with ID ${task.id}`,
				task: mapTask(task, projectPath),
				warnings: warnings.length > 0 ? warnings : undefined,
			}
		} catch (error) {
			consola.error("Error creating task:", error)
			return {
				success: false,
				message: `Failed to create task: ${formatErrorMessage(error)}`,
			}
		}
	},
})

// ============================================================================
// Update Task Tool
// ============================================================================

export const updateTaskTool = createTool({
	id: "update-task",
	description:
		"Update an existing task. Use this when the user asks to modify, change, or update a task. Can update any field including title, status, priority, description, etc. You must provide the taskId.",
	inputSchema: z.object({
		taskId: z.string().min(1).describe("ID of the task to update (required)"),
		title: z.string().optional().describe("New task title"),
		description: z.string().optional().describe("New description"),
		cluster: z.string().optional().describe("New cluster/category"),
		status: z
			.enum(["backlog", "todo", "in_progress", "blocked", "review", "done", "archived"])
			.optional()
			.describe("New status"),
		priority: z.number().int().min(1).max(3).optional().describe("New priority (1=Now, 2=Next, 3=Later)"),
		benefit: z.string().optional().describe("New benefit description"),
		segments: z.string().optional().describe("New target segments"),
		impact: z.number().int().min(1).max(3).optional().describe("New impact level (1-3)"),
		stage: z.string().optional().describe("New product stage"),
		reason: z.string().optional().describe("New reasoning"),
		tags: z.array(z.string()).optional().describe("New tags array"),
		dueDate: z.string().optional().describe("New due date in ISO format"),
		estimatedEffort: z.enum(["S", "M", "L", "XL"]).optional().describe("New estimated effort"),
		parentTaskId: z.string().nullable().optional().describe("Set or clear parent task"),
		dependsOnTaskIds: z.array(z.string()).optional().describe("Other task IDs this depends on"),
		blocksTaskIds: z.array(z.string()).optional().describe("Tasks this task blocks"),
		actualHours: z.number().optional().describe("Actual hours spent"),
		assignees: z
			.array(
				z.object({
					userId: z.string().optional(),
					email: z.string().email().optional(),
					name: z.string().optional(),
					agentType: z.enum(["code-generation", "research", "testing", "documentation"]).optional(),
				})
			)
			.optional()
			.describe("People or agents to assign (replaces current list)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		task: taskOutputSchema.optional(),
		warnings: z.array(z.string()).optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(runtimeContext)
			const projectPath = buildProjectPath(accountId, projectId)
			const { resolved: resolvedAssignees, warnings } = await resolveAssignees({
				accountId,
				supabase,
				assignees: context.assignees,
			})

			// Build updates object with only provided fields
			const updates: Record<string, unknown> = {}
			if (context.title !== undefined) updates.title = context.title
			if (context.description !== undefined) updates.description = context.description
			if (context.cluster !== undefined) updates.cluster = context.cluster
			if (context.status !== undefined) updates.status = context.status
			if (context.priority !== undefined) updates.priority = context.priority
			if (context.benefit !== undefined) updates.benefit = context.benefit
			if (context.segments !== undefined) updates.segments = context.segments
			if (context.impact !== undefined) updates.impact = context.impact
			if (context.stage !== undefined) updates.stage = context.stage
			if (context.reason !== undefined) updates.reason = context.reason
			if (context.tags !== undefined) updates.tags = context.tags
			if (context.dueDate !== undefined) updates.due_date = context.dueDate
			if (context.estimatedEffort !== undefined) updates.estimated_effort = context.estimatedEffort
			if (context.parentTaskId !== undefined) updates.parent_task_id = context.parentTaskId
			if (context.dependsOnTaskIds !== undefined) updates.depends_on_task_ids = context.dependsOnTaskIds
			if (context.blocksTaskIds !== undefined) updates.blocks_task_ids = context.blocksTaskIds
			if (context.actualHours !== undefined) updates.actual_hours = context.actualHours
			if (context.assignees !== undefined) updates.assigned_to = resolvedAssignees

			const task = await updateTask({
				supabase,
				taskId: context.taskId,
				userId,
				updates: updates as any,
			})

			return {
				success: true,
				message: `Updated task "${task.title}"`,
				task: mapTask(task, projectPath),
				warnings: warnings.length > 0 ? warnings : undefined,
			}
		} catch (error) {
			consola.error("Error updating task:", error)
			return {
				success: false,
				message: `Failed to update task: ${formatErrorMessage(error)}`,
			}
		}
	},
})

// ============================================================================
// Delete Task Tool
// ============================================================================

export const deleteTaskTool = createTool({
	id: "delete-task",
	description:
		"Delete (archive) a task. Use this when the user asks to remove or delete a task. This performs a soft delete by setting status to 'archived'.",
	inputSchema: z.object({
		taskId: z.string().min(1).describe("ID of the task to delete (required)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		warnings: z.array(z.string()).optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { userId } = ensureContext(runtimeContext)

			await deleteTask({
				supabase,
				taskId: context.taskId,
				userId,
			})

			return {
				success: true,
				message: `Deleted task ${context.taskId}`,
			}
		} catch (error) {
			consola.error("Error deleting task:", error)
			return {
				success: false,
				message: `Failed to delete task: ${formatErrorMessage(error)}`,
			}
		}
	},
})
