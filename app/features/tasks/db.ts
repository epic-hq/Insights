// Task Database Operations
// CRUD functions for the unified task/feature system

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type {
	Task,
	TaskActivity,
	TaskActivitySource,
	TaskActivityType,
	TaskFilters,
	TaskInsert,
	TaskListOptions,
	TaskUpdate,
} from "./types"

// ============================================================================
// Create Operations
// ============================================================================

export async function createTask({
	supabase,
	accountId,
	projectId,
	userId,
	data,
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	userId: string
	data: TaskInsert
}): Promise<Task> {
	const task = {
		...data,
		account_id: accountId,
		project_id: projectId,
		created_by: userId,
		status: data.status || "backlog",
		priority: data.priority || 3,
		assigned_to: data.assigned_to || [],
		tags: data.tags || [],
		depends_on_task_ids: data.depends_on_task_ids || [],
		blocks_task_ids: data.blocks_task_ids || [],
	}

	const { data: created, error } = await supabase.from("tasks").insert(task).select().single()

	if (error) {
		consola.error("Error creating task:", error)
		throw error
	}

	// Log creation activity
	await logTaskActivity({
		supabase,
		taskId: created.id,
		activityType: "created",
		userId,
		content: `Created task: ${created.title}`,
	})

	return created as Task
}

// ============================================================================
// Read Operations
// ============================================================================

export async function getTasks({
	supabase,
	projectId,
	options = {},
}: {
	supabase: SupabaseClient
	projectId: string
	options?: TaskListOptions
}): Promise<Task[]> {
	let query = supabase.from("tasks").select("*").eq("project_id", projectId)

	// Apply filters
	if (options.filters) {
		const { status, cluster, priority, assigned_to, tags, parent_task_id, search } = options.filters

		if (status) {
			if (Array.isArray(status)) {
				query = query.in("status", status)
			} else {
				query = query.eq("status", status)
			}
		}

		if (cluster) {
			query = query.eq("cluster", cluster)
		}

		if (priority) {
			query = query.eq("priority", priority)
		}

		if (assigned_to) {
			// Query JSONB array for matching assignee
			query = query.contains("assigned_to", [{ user_id: assigned_to }])
		}

		if (tags && tags.length > 0) {
			query = query.overlaps("tags", tags)
		}

		if (parent_task_id !== undefined) {
			if (parent_task_id === null) {
				query = query.is("parent_task_id", null)
			} else {
				query = query.eq("parent_task_id", parent_task_id)
			}
		}

		if (search) {
			query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
		}
	}

	// Apply sorting
	if (options.sort) {
		query = query.order(options.sort.field, { ascending: options.sort.direction === "asc" })
	} else {
		// Default sort: priority (ascending), then created_at (descending)
		query = query.order("priority", { ascending: true }).order("created_at", { ascending: false })
	}

	// Apply pagination
	if (options.limit) {
		query = query.limit(options.limit)
	}
	if (options.offset) {
		query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
	}

	const { data, error } = await query

	if (error) {
		consola.error("Error fetching tasks:", error)
		throw error
	}

	return (data as Task[]) || []
}

export async function getTaskById({
	supabase,
	taskId,
}: {
	supabase: SupabaseClient
	taskId: string
}): Promise<Task> {
	const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).single()

	if (error) {
		consola.error("Error fetching task:", error)
		throw error
	}

	return data as Task
}

export async function getTasksByIds({
	supabase,
	taskIds,
}: {
	supabase: SupabaseClient
	taskIds: string[]
}): Promise<Task[]> {
	if (taskIds.length === 0) return []

	const { data, error } = await supabase.from("tasks").select("*").in("id", taskIds)

	if (error) {
		consola.error("Error fetching tasks by IDs:", error)
		throw error
	}

	return (data as Task[]) || []
}

// ============================================================================
// Update Operations
// ============================================================================

export async function updateTask({
	supabase,
	taskId,
	userId,
	updates,
}: {
	supabase: SupabaseClient
	taskId: string
	userId: string
	updates: TaskUpdate
}): Promise<Task> {
	// Get current state for activity log
	const current = await getTaskById({ supabase, taskId })

	// Special handling for completed_at timestamp
	const updatesWithTimestamp = { ...updates }
	if (updates.status === "done" && !current.completed_at) {
		updatesWithTimestamp.completed_at = new Date().toISOString()
	} else if (updates.status && updates.status !== "done" && current.completed_at) {
		updatesWithTimestamp.completed_at = null
	}

	const { data, error } = await supabase
		.from("tasks")
		.update({
			...updatesWithTimestamp,
			updated_at: new Date().toISOString(),
		})
		.eq("id", taskId)
		.select()
		.single()

	if (error) {
		consola.error("Error updating task:", error)
		throw error
	}

	// Log each changed field
	for (const [key, newValue] of Object.entries(updates)) {
		const oldValue = current[key as keyof Task]
		if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
			await logTaskActivity({
				supabase,
				taskId,
				activityType: "field_update",
				userId,
				fieldName: key,
				oldValue,
				newValue,
			})
		}
	}

	return data as Task
}

// ============================================================================
// Delete Operations
// ============================================================================

export async function deleteTask({
	supabase,
	taskId,
	userId,
}: {
	supabase: SupabaseClient
	taskId: string
	userId: string
}): Promise<Task> {
	// Soft delete by archiving
	return updateTask({
		supabase,
		taskId,
		userId,
		updates: { status: "archived" },
	})
}

export async function hardDeleteTask({
	supabase,
	taskId,
}: {
	supabase: SupabaseClient
	taskId: string
}): Promise<void> {
	const { error } = await supabase.from("tasks").delete().eq("id", taskId)

	if (error) {
		consola.error("Error deleting task:", error)
		throw error
	}
}

// ============================================================================
// Task Activity Operations
// ============================================================================

export async function logTaskActivity({
	supabase,
	taskId,
	activityType,
	userId,
	fieldName,
	oldValue,
	newValue,
	content,
	source = "web",
}: {
	supabase: SupabaseClient
	taskId: string
	activityType: TaskActivityType
	userId: string
	fieldName?: string
	oldValue?: unknown
	newValue?: unknown
	content?: string
	source?: TaskActivitySource
}): Promise<void> {
	const activity = {
		task_id: taskId,
		activity_type: activityType,
		field_name: fieldName || null,
		old_value: oldValue !== undefined ? JSON.parse(JSON.stringify(oldValue)) : null,
		new_value: newValue !== undefined ? JSON.parse(JSON.stringify(newValue)) : null,
		content: content || null,
		user_id: userId,
		source,
	}

	const { error } = await supabase.from("task_activity").insert(activity)

	if (error) {
		consola.error("Error logging task activity:", error)
		// Don't throw - activity logging shouldn't break the main operation
	}
}

export async function getTaskActivity({
	supabase,
	taskId,
	limit = 50,
}: {
	supabase: SupabaseClient
	taskId: string
	limit?: number
}): Promise<TaskActivity[]> {
	const { data, error } = await supabase
		.from("task_activity")
		.select("*")
		.eq("task_id", taskId)
		.order("created_at", { ascending: false })
		.limit(limit)

	if (error) {
		consola.error("Error fetching task activity:", error)
		throw error
	}

	return (data as TaskActivity[]) || []
}

// ============================================================================
// Bulk Operations
// ============================================================================

export async function bulkUpdateTasks({
	supabase,
	taskIds,
	userId,
	updates,
}: {
	supabase: SupabaseClient
	taskIds: string[]
	userId: string
	updates: TaskUpdate
}): Promise<Task[]> {
	const tasks: Task[] = []

	// Update each task individually to ensure activity logging
	for (const taskId of taskIds) {
		try {
			const updated = await updateTask({ supabase, taskId, userId, updates })
			tasks.push(updated)
		} catch (error) {
			consola.error(`Error updating task ${taskId}:`, error)
		}
	}

	return tasks
}

export async function bulkDeleteTasks({
	supabase,
	taskIds,
	userId,
}: {
	supabase: SupabaseClient
	taskIds: string[]
	userId: string
}): Promise<void> {
	// Soft delete by archiving
	await bulkUpdateTasks({
		supabase,
		taskIds,
		userId,
		updates: { status: "archived" },
	})
}

// ============================================================================
// Query Helpers
// ============================================================================

export async function getTasksByCluster({
	supabase,
	projectId,
	cluster,
}: {
	supabase: SupabaseClient
	projectId: string
	cluster: string
}): Promise<Task[]> {
	return getTasks({
		supabase,
		projectId,
		options: {
			filters: { cluster },
		},
	})
}

export async function getTasksByStatus({
	supabase,
	projectId,
	status,
}: {
	supabase: SupabaseClient
	projectId: string
	status: string | string[]
}) {
	return getTasks({
		supabase,
		projectId,
		options: {
			filters: { status: status as any },
		},
	})
}

export async function getTasksByAssignee({
	supabase,
	projectId,
	userId,
}: {
	supabase: SupabaseClient
	projectId: string
	userId: string
}): Promise<Task[]> {
	return getTasks({
		supabase,
		projectId,
		options: {
			filters: { assigned_to: userId },
		},
	})
}

export async function getSubtasks({
	supabase,
	parentTaskId,
}: {
	supabase: SupabaseClient
	parentTaskId: string
}): Promise<Task[]> {
	const { data, error } = await supabase.from("tasks").select("*").eq("parent_task_id", parentTaskId)

	if (error) {
		consola.error("Error fetching subtasks:", error)
		throw error
	}

	return (data as Task[]) || []
}
