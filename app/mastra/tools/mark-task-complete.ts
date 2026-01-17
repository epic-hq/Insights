import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { updateTask } from "~/features/tasks/db"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const ensureContext = (context?: { requestContext?: Map<string, unknown> }) => {
	const accountId = context?.requestContext?.get("account_id") as string | undefined
	const projectId = context?.requestContext?.get("project_id") as string | undefined
	const userId = context?.requestContext?.get("user_id") as string | undefined

	if (!accountId || !projectId || !userId) {
		throw new Error("Missing required context: account_id, project_id, or user_id")
	}

	return { accountId, projectId, userId }
}

const buildProjectPath = (accountId: string, projectId: string) => {
	return `/accounts/${accountId}/projects/${projectId}`
}

const taskOutputSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	status: z.enum(["backlog", "todo", "in_progress", "blocked", "review", "done", "archived"]),
	priority: z.number().int().min(1).max(3).nullable(),
	cluster: z.string().nullable(),
	benefit: z.string().nullable(),
	segments: z.string().nullable(),
	impact: z.number().int().min(1).max(3).nullable(),
	stage: z.string().nullable(),
	reason: z.string().nullable(),
	tags: z.array(z.string()).nullable(),
	dueDate: z.string().nullable(),
	estimatedEffort: z.enum(["S", "M", "L", "XL"]).nullable(),
	actualHours: z.number().nullable(),
	assignedTo: z.array(z.unknown()).nullable(),
	parentTaskId: z.string().nullable(),
	dependsOnTaskIds: z.array(z.string()).nullable(),
	blocksTaskIds: z.array(z.string()).nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	projectUrl: z.string(),
	taskUrl: z.string(),
})

const mapTask = (task: Database["public"]["Tables"]["tasks"]["Row"], projectPath: string) => {
	return {
		id: task.id,
		title: task.title,
		description: task.description,
		status: task.status,
		priority: task.priority,
		cluster: task.cluster,
		benefit: task.benefit,
		segments: task.segments,
		impact: task.impact,
		stage: task.stage,
		reason: task.reason,
		tags: task.tags,
		dueDate: task.due_date,
		estimatedEffort: task.estimated_effort,
		actualHours: task.actual_hours,
		assignedTo: task.assigned_to,
		parentTaskId: task.parent_task_id,
		dependsOnTaskIds: task.depends_on_task_ids,
		blocksTaskIds: task.blocks_task_ids,
		createdAt: task.created_at,
		updatedAt: task.updated_at,
		projectUrl: `${projectPath}/tasks`,
		taskUrl: `${projectPath}/tasks/${task.id}`,
	}
}

export const markTaskCompleteTool = createTool({
	id: "mark-task-complete",
	description:
		"Mark a task as complete. Only requires the task ID. Use this when user says they completed a task - no need to ask for any other details.",
	inputSchema: z.object({
		taskId: z.string().min(1).describe("ID of the task to mark as complete"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		task: taskOutputSchema.optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)

			const task = await updateTask({
				supabase,
				taskId: input.taskId,
				userId,
				updates: { status: "done" },
			})

			return {
				success: true,
				message: `✓ Marked "${task.title}" as complete`,
				task: mapTask(task, projectPath),
			}
		} catch (error) {
			consola.error("Error marking task complete:", error)
			return {
				success: false,
				message: `Failed to mark task complete: ${error instanceof Error ? error.message : String(error)}`,
			}
		}
	},
})
