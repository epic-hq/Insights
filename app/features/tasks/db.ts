// Task Database Operations
// CRUD functions for the unified task/feature system

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type {
	Task,
	TaskActivity,
	TaskActivitySource,
	TaskActivityType,
	TaskInsert,
	TaskListOptions,
	TaskStatus,
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
	userId: string | null
	data: TaskInsert
}): Promise<Task> {
	const task = {
		...data,
		status: data.status || "backlog",
		priority: data.priority || 3,
		assigned_to: data.assigned_to || [],
		tags: data.tags || [],
		depends_on_task_ids: data.depends_on_task_ids || [],
		blocks_task_ids: data.blocks_task_ids || [],
		// These must come last to ensure they're not overwritten by spread
		account_id: accountId,
		project_id: projectId,
		created_by: userId,
	}

	consola.info("Task object before insert:", { task, userId, accountId, projectId })

	const { data: created, error } = await supabase.from("tasks").insert(task).select().single()

	if (error) {
		consola.error("Error creating task:", error)
		throw error
	}

	// Log creation activity (only if we have a userId)
	if (userId) {
		await logTaskActivity({
			supabase,
			taskId: created.id,
			activityType: "created",
			userId,
			content: `Created task: ${created.title}`,
		})
	}

	return created as Task
}

// ============================================================================
// Read Operations
// ============================================================================

export async function getTasks({
	supabase,
	accountId,
	projectId,
	options = {},
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	options?: TaskListOptions
}): Promise<Task[]> {
	let query = supabase.from("tasks").select("*").eq("account_id", accountId).eq("project_id", projectId)

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

export async function getTopFocusTasks({
	supabase,
	accountId,
	projectId,
	limit = 10,
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	limit?: number
}): Promise<Task[]> {
	let query = supabase
		.from("tasks")
		.select("*")
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.in("status", ["todo", "in_progress", "blocked", "review"])
		.order("priority", { ascending: false })
		.order("due_date", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false })

	if (limit) {
		query = query.limit(limit)
	}

	const { data, error } = await query

	if (error) {
		consola.error("Error fetching top focus tasks:", error)
		throw error
	}

	return (data as Task[]) || []
}

export async function getTaskById({ supabase, taskId }: { supabase: SupabaseClient; taskId: string }): Promise<Task> {
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
	accountId,
	projectId,
	cluster,
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	cluster: string
}): Promise<Task[]> {
	return getTasks({
		supabase,
		accountId,
		projectId,
		options: {
			filters: { cluster },
		},
	})
}

export async function getTasksByStatus({
	supabase,
	accountId,
	projectId,
	status,
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	status: TaskStatus | TaskStatus[]
}) {
	return getTasks({
		supabase,
		accountId,
		projectId,
		options: {
			filters: { status },
		},
	})
}

export async function getTasksByAssignee({
	supabase,
	accountId,
	projectId,
	userId,
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	userId: string
}): Promise<Task[]> {
	return getTasks({
		supabase,
		accountId,
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

// ============================================================================
// Task Link Operations
// ============================================================================

export type TaskLinkEntityType =
	| "evidence"
	| "person"
	| "organization"
	| "opportunity"
	| "interview"
	| "insight"
	| "persona"
export type TaskLinkType = "supports" | "blocks" | "related" | "source"

export interface TaskLink {
	id: string
	task_id: string
	entity_type: TaskLinkEntityType
	entity_id: string
	link_type: TaskLinkType
	description: string | null
	created_by: string | null
	created_at: string
	updated_at: string
}

export interface TaskLinkInsert {
	task_id: string
	entity_type: TaskLinkEntityType
	entity_id: string
	link_type?: TaskLinkType
	description?: string
}

export async function createTaskLink({
	supabase,
	userId,
	data,
}: {
	supabase: SupabaseClient
	userId: string
	data: TaskLinkInsert
}): Promise<TaskLink> {
	const linkData = {
		...data,
		link_type: data.link_type || "supports",
		created_by: userId,
	}

	const { data: created, error } = await supabase.from("task_links").insert(linkData).select().single()

	if (error) {
		consola.error("Error creating task link:", error)
		throw error
	}

	// Log activity
	await logTaskActivity({
		supabase,
		taskId: data.task_id,
		activityType: "field_update",
		userId,
		fieldName: "links",
		newValue: { entity_type: data.entity_type, entity_id: data.entity_id, link_type: data.link_type },
		content: `Added ${data.entity_type} link`,
	})

	return created as TaskLink
}

export async function getTaskLinks({
	supabase,
	taskId,
	entityType,
	linkType,
}: {
	supabase: SupabaseClient
	taskId: string
	entityType?: TaskLinkEntityType
	linkType?: TaskLinkType
}): Promise<TaskLink[]> {
	let query = supabase.from("task_links").select("*").eq("task_id", taskId)

	if (entityType) {
		query = query.eq("entity_type", entityType)
	}

	if (linkType) {
		query = query.eq("link_type", linkType)
	}

	const { data, error } = await query.order("created_at", { ascending: false })

	if (error) {
		consola.error("Error fetching task links:", error)
		throw error
	}

	return (data as TaskLink[]) || []
}

export async function getTaskLinkById({
	supabase,
	linkId,
}: {
	supabase: SupabaseClient
	linkId: string
}): Promise<TaskLink | null> {
	const { data, error } = await supabase.from("task_links").select("*").eq("id", linkId).single()

	if (error) {
		if (error.code === "PGRST116") {
			return null
		}
		consola.error("Error fetching task link:", error)
		throw error
	}

	return data as TaskLink
}

export async function updateTaskLink({
	supabase,
	linkId,
	updates,
}: {
	supabase: SupabaseClient
	linkId: string
	updates: Partial<Pick<TaskLink, "link_type" | "description">>
}): Promise<TaskLink> {
	const { data, error } = await supabase
		.from("task_links")
		.update({
			...updates,
			updated_at: new Date().toISOString(),
		})
		.eq("id", linkId)
		.select()
		.single()

	if (error) {
		consola.error("Error updating task link:", error)
		throw error
	}

	return data as TaskLink
}

export async function deleteTaskLink({
	supabase,
	linkId,
	userId,
}: {
	supabase: SupabaseClient
	linkId: string
	userId: string
}): Promise<void> {
	// Get the link first for activity logging
	const link = await getTaskLinkById({ supabase, linkId })

	const { error } = await supabase.from("task_links").delete().eq("id", linkId)

	if (error) {
		consola.error("Error deleting task link:", error)
		throw error
	}

	// Log activity if we had the link
	if (link) {
		await logTaskActivity({
			supabase,
			taskId: link.task_id,
			activityType: "field_update",
			userId,
			fieldName: "links",
			oldValue: { entity_type: link.entity_type, entity_id: link.entity_id },
			content: `Removed ${link.entity_type} link`,
		})
	}
}

export async function getTasksLinkedToEntity({
	supabase,
	entityType,
	entityId,
}: {
	supabase: SupabaseClient
	entityType: TaskLinkEntityType
	entityId: string
}): Promise<Task[]> {
	const { data: links, error: linksError } = await supabase
		.from("task_links")
		.select("task_id")
		.eq("entity_type", entityType)
		.eq("entity_id", entityId)

	if (linksError) {
		consola.error("Error fetching task links for entity:", linksError)
		throw linksError
	}

	if (!links || links.length === 0) {
		return []
	}

	const taskIds = links.map((l) => l.task_id)
	return getTasksByIds({ supabase, taskIds })
}
