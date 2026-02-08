import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import type { Database } from "~/types";

export const createTaskTool = createTool({
	id: "create-task",
	description:
		"Create a task for follow-up actions, project work, or reminders. Tasks can be assigned to people and organized into clusters. Use this to create follow-up tasks after meeting contacts or for any project work that needs to be tracked.",
	inputSchema: z.object({
		title: z.string().describe("Task title (required)"),
		description: z.string().nullish().describe("Detailed description of the task"),
		cluster: z
			.string()
			.nullish()
			.describe("Cluster/category for organizing tasks (e.g., 'Sales', 'Product', 'Research'). Defaults to 'General'"),
		status: z
			.enum(["backlog", "todo", "in_progress", "blocked", "review", "done", "archived"])
			.nullish()
			.describe("Task status. Defaults to 'todo'"),
		priority: z
			.number()
			.int()
			.min(1)
			.max(3)
			.nullish()
			.describe("Priority: 1 = Now (urgent), 2 = Next (important), 3 = Later (backlog). Defaults to 2"),
		dueDate: z.string().nullish().describe("Due date (ISO date string or natural language date)"),
		estimatedEffort: z
			.enum(["S", "M", "L", "XL"])
			.nullish()
			.describe("Estimated effort: S (small), M (medium), L (large), XL (extra large)"),
		tags: z.array(z.string()).nullish().describe("Array of tags for categorization"),
		relatedPersonIds: z
			.array(z.string())
			.nullish()
			.describe("Array of person IDs this task is related to (e.g., people to follow up with)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		task: z
			.object({
				id: z.string(),
				title: z.string(),
				status: z.string(),
				priority: z.number(),
			})
			.nullable(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");
		const runtimeUserId = context?.requestContext?.get?.("user_id");

		const { title, description, cluster, status, priority, dueDate, estimatedEffort, tags, relatedPersonIds } =
			input || {};

		const projectId = (runtimeProjectId as string) || null;
		const accountId = (runtimeAccountId as string) || null;
		const userId = (runtimeUserId as string) || null;

		consola.debug("create-task: execute start", {
			title,
			projectId,
			accountId,
			userId,
		});

		if (!accountId || !projectId || !userId) {
			return {
				success: false,
				message: "Missing accountId, projectId, or userId in runtime context",
				task: null,
			};
		}

		if (!title) {
			return {
				success: false,
				message: "Task title is required",
				task: null,
			};
		}

		try {
			// Parse due date if provided
			let parsedDueDate: string | null = null;
			if (dueDate) {
				try {
					const date = new Date(dueDate);
					if (!Number.isNaN(date.getTime())) {
						parsedDueDate = date.toISOString();
					}
				} catch {
					consola.warn("create-task: failed to parse dueDate", dueDate);
				}
			}

			// Build task insert data
			const taskData: Database["public"]["Tables"]["tasks"]["Insert"] = {
				account_id: accountId,
				project_id: projectId,
				created_by: userId,
				title,
				description: description || null,
				cluster: cluster || "General",
				status: status || "todo",
				priority: priority || 2,
				due_date: parsedDueDate,
				estimated_effort: estimatedEffort || null,
				tags: tags || [],
			};

			// Insert the task
			const { data: task, error: taskError } = await supabase
				.from("tasks")
				.insert(taskData)
				.select("id, title, status, priority")
				.single();

			if (taskError || !task) {
				consola.error("create-task: error creating task", taskError);
				throw taskError || new Error("Failed to create task");
			}

			// If relatedPersonIds provided, create task activity entries to link people
			if (relatedPersonIds && relatedPersonIds.length > 0) {
				const activities = relatedPersonIds.map((personId) => ({
					task_id: task.id,
					activity_type: "comment",
					content: `Related to person: ${personId}`,
					user_id: userId,
					source: "assistant",
				}));

				const { error: activityError } = await supabase.from("task_activity").insert(activities);

				if (activityError) {
					consola.warn("create-task: failed to link people to task", activityError);
					// Don't fail the whole operation
				}
			}

			return {
				success: true,
				message: `Successfully created task "${task.title}" with priority ${task.priority} and status ${task.status}`,
				task: {
					id: task.id,
					title: task.title,
					status: task.status,
					priority: task.priority,
				},
			};
		} catch (error) {
			consola.error("create-task: unexpected error", error);
			return {
				success: false,
				message: `Failed to create task: ${error instanceof Error ? error.message : "unknown error"}`,
				task: null,
			};
		}
	},
});
