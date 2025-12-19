import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { createTask, createTaskLink, deleteTask, getTasks, getTopFocusTasks, updateTask } from "~/features/tasks/db"
import type {
	AgentType,
	Assignee,
	HumanAssignee,
	PersonAssignee,
	Task,
	TaskStatus,
	TaskUpdate,
} from "~/features/tasks/types"
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
				person_id: z.string().optional(),
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

type ToolExecutionContext = {
	requestContext?: {
		get?: (key: string) => unknown
	}
}

function ensureContext(context?: ToolExecutionContext) {
	const accountId = context?.requestContext?.get?.("account_id") as string | undefined
	const projectId = context?.requestContext?.get?.("project_id") as string | undefined
	const userId = context?.requestContext?.get?.("user_id") as string | undefined
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
	personId?: string
	personName?: string
	personCompany?: string
	agentType?: AgentType
}

type AccountMember = {
	user_id: string
	first_name?: string | null
	last_name?: string | null
	email?: string | null
}

type ProjectPerson = {
	id: string
	name: string | null
	company: string
	user_id: string | null
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

async function fetchProjectPeople({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
}): Promise<ProjectPerson[]> {
	const { data, error } = await supabase
		.from("people")
		.select("id, name, company, user_id")
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	if (error || !data) {
		return []
	}

	return data
}

async function resolveAssignees({
	accountId,
	projectId,
	supabase,
	assignees,
}: {
	accountId: string
	projectId: string
	supabase: SupabaseClient<Database>
	assignees?: AssigneeInput[]
}): Promise<{ resolved: Assignee[]; warnings: string[] }> {
	if (!assignees || assignees.length === 0) return { resolved: [], warnings: [] }

	const warnings: string[] = []
	const members = await fetchAccountMembers(accountId, supabase)
	const people = await fetchProjectPeople({ supabase, accountId, projectId })

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

	const findPerson = (candidate: AssigneeInput): ProjectPerson | undefined => {
		if (candidate.personId) {
			return people.find((p) => p.id === candidate.personId)
		}
		const person_name = normalizeName(candidate.personName)
		if (!person_name) return undefined

		const company = normalizeName(candidate.personCompany)
		const matches = people.filter((p) => {
			const name_matches = normalizeName(p.name) === person_name
			if (!name_matches) return false
			if (!company) return true
			return normalizeName(p.company) === company
		})

		if (matches.length === 0) return undefined
		if (matches.length > 1 && !company) {
			warnings.push(
				`Multiple people matched "${candidate.personName}". Provide personCompany to disambiguate. Using the first match (${matches[0].id}).`
			)
		}
		return matches[0]
	}

	const resolved: Assignee[] = assignees.flatMap((candidate) => {
		if (candidate.agentType) {
			return [{ type: "agent" as const, agent_type: candidate.agentType }]
		}

		const person = findPerson(candidate)
		if (person) {
			const name = person.name || ""
			const assignee: PersonAssignee = {
				type: "person" as const,
				person_id: person.id,
				name,
			}
			return [assignee]
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

const taskLinkEntityTypeSchema = z.enum(["evidence", "person", "organization", "opportunity", "interview", "insight", "persona"])
const taskLinkTypeSchema = z.enum(["supports", "blocks", "related", "source"])

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
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)
			const warnings: string[] = []

			const tasks = await getTasks({
				supabase,
				accountId,
				projectId,
				options: {
					filters: {
						status: input?.status as TaskStatus[] | undefined,
						cluster: input?.cluster,
						priority: input?.priority as 1 | 2 | 3 | undefined,
						search: input?.search?.trim(),
						assigned_to: input?.assigneeId,
					},
					limit: input?.limit ?? 100,
				},
			})

			let filteredTasks = tasks

			if (input?.taskIds && input.taskIds.length > 0) {
				filteredTasks = filteredTasks.filter((t) => input.taskIds?.includes(t.id))
			}

			if (input?.tags && input.tags.length > 0) {
				filteredTasks = filteredTasks.filter((t) => t.tags?.some((tag) => input.tags?.includes(tag)))
			}

			if (input?.dueAfter) {
				const after = new Date(input.dueAfter).getTime()
				if (!Number.isNaN(after)) {
					filteredTasks = filteredTasks.filter((t) => (t.due_date ? new Date(t.due_date).getTime() >= after : false))
				} else {
					warnings.push("Invalid dueAfter value; ignored.")
				}
			}

			if (input?.dueBefore) {
				const before = new Date(input.dueBefore).getTime()
				if (!Number.isNaN(before)) {
					filteredTasks = filteredTasks.filter((t) => (t.due_date ? new Date(t.due_date).getTime() <= before : false))
				} else {
					warnings.push("Invalid dueBefore value; ignored.")
				}
			}

			if (input?.assigneeName) {
				const members = await fetchAccountMembers(accountId, supabase)
				const needle = normalizeName(input.assigneeName)
				const matchingIds = members
					.filter((m) => {
						const full = normalizeName(`${m.first_name || ""} ${m.last_name || ""}`)
						const first = normalizeName(m.first_name)
						const last = normalizeName(m.last_name)
						return full.includes(needle) || first.includes(needle) || last.includes(needle)
					})
					.map((m) => m.user_id)

				if (matchingIds.length === 0) {
					warnings.push(`No teammate matched "${input.assigneeName}".`)
				} else {
					filteredTasks = filteredTasks.filter((t) =>
						(t.assigned_to || []).some(
							(assignee) => assignee.type === "human" && matchingIds.includes((assignee as HumanAssignee).user_id)
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
// Fetch Focus Tasks Tool
// ============================================================================

export const fetchFocusTasksTool = createTool({
	id: "fetch-focus-tasks",
	description:
		"Return the top N tasks the user should focus on. Excludes status done/archived/backlog and sorts by priority then due date.",
	inputSchema: z.object({
		limit: z.number().int().min(1).max(50).optional().describe("Maximum number of focus tasks to return (default 10)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		total: z.number().optional(),
		tasks: z.array(taskOutputSchema).optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)

			const tasks = await getTopFocusTasks({
				supabase,
				accountId,
				projectId,
				limit: input?.limit ?? 10,
			})

			const mappedTasks = tasks.map((task) => mapTask(task, projectPath))

			return {
				success: true,
				message: `Found ${mappedTasks.length} focus task(s)`,
				total: mappedTasks.length,
				tasks: mappedTasks,
			}
		} catch (error) {
			consola.error("Error fetching focus tasks:", error)
			return {
				success: false,
				message: `Failed to fetch focus tasks: ${formatErrorMessage(error)}`,
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
		"Create a new task in the current project. Requires a title and either a priority or a due date. Defaults: assign to current user, status backlog, priority 2 (medium), cluster 'General'.",
	inputSchema: z
		.object({
			title: z.string().min(1).describe("Task title (required)"),
			description: z.string().optional().describe("Detailed description of the task"),
			cluster: z.string().optional().describe("Cluster/category for grouping (defaults to 'General')"),
			status: z
				.enum(["backlog", "todo", "in_progress", "blocked", "review", "done", "archived"])
				.optional()
				.describe("Task status (defaults to 'backlog')"),
			priority: z.number().int().min(1).max(3).optional().describe("Priority: 1=Now, 2=Next, 3=Later (defaults to 2)"),
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
			source: z
				.object({
					entityType: taskLinkEntityTypeSchema.describe("Entity type to link as the origin/source of the task"),
					entityId: z.string().min(1).describe("Entity ID (uuid)"),
					linkType: taskLinkTypeSchema.optional().describe("Link type (defaults to 'source')"),
					description: z.string().optional().describe("Optional description of why this entity is linked"),
				})
				.optional()
				.describe("Optional source/origin entity for this task (creates task_links row)"),
			links: z
				.array(
					z.object({
						entityType: taskLinkEntityTypeSchema.describe("Linked entity type"),
						entityId: z.string().min(1).describe("Linked entity ID (uuid)"),
						linkType: taskLinkTypeSchema.optional().describe("Link type (defaults to 'supports')"),
						description: z.string().optional().describe("Optional description of the relationship"),
					})
				)
				.optional()
				.describe("Additional entity links to create for this task"),
			assignee: z
				.object({
					userId: z.string().optional(),
					email: z.string().email().optional(),
					name: z.string().optional(),
					personId: z.string().optional().describe("Project person id"),
					personName: z.string().optional().describe("Project person name"),
					personCompany: z.string().optional().describe("Project person company (disambiguation)"),
					agentType: z.enum(["code-generation", "research", "testing", "documentation"]).optional(),
				})
				.optional()
				.describe("Single assignee (alias for assignees[0])"),
			assignees: z
				.array(
					z.object({
						userId: z.string().optional(),
						email: z.string().email().optional(),
						name: z.string().optional(),
						personId: z.string().optional().describe("Project person id"),
						personName: z.string().optional().describe("Project person name"),
						personCompany: z.string().optional().describe("Project person company (disambiguation)"),
						agentType: z.enum(["code-generation", "research", "testing", "documentation"]).optional(),
					})
				)
				.optional()
				.describe("People or agents to assign (defaults to current user)"),
		})
		.refine((v) => v.priority !== undefined || v.dueDate !== undefined, {
			message: "Provide either priority or dueDate",
			path: ["priority"],
		}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		task: taskOutputSchema.optional(),
		warnings: z.array(z.string()).optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)
			const assigneesInput =
				input.assignees && input.assignees.length > 0
					? input.assignees
					: input.assignee
						? [input.assignee]
						: [{ userId }]
			const { resolved: resolvedAssignees, warnings } = await resolveAssignees({
				accountId,
				projectId,
				supabase,
				assignees: assigneesInput,
			})

			const tags = Array.from(new Set([...(input.tags ?? []), "ai-generated"]))
			const source_theme_id = input.source?.entityType === "insight" ? input.source.entityId : null

			const task = await createTask({
				supabase,
				accountId,
				projectId,
				userId,
				data: {
					title: input.title,
					description: input.description ?? null,
					cluster: input.cluster ?? "General",
					parent_task_id: input.parentTaskId ?? null,
					status: input.status ?? "backlog",
					priority: (input.priority ?? 2) as 1 | 2 | 3,
					benefit: input.benefit ?? null,
					segments: input.segments ?? null,
					impact: input.impact ? (input.impact as 1 | 2 | 3) : null,
					stage: input.stage ?? null,
					reason: input.reason ?? null,
					tags,
					due_date: input.dueDate ?? null,
					estimated_effort: input.estimatedEffort ?? null,
					actual_hours: null,
					assigned_to: resolvedAssignees,
					depends_on_task_ids: input.dependsOnTaskIds ?? [],
					blocks_task_ids: input.blocksTaskIds ?? [],
					source_theme_id,
				},
			})

			const link_specs = [
				...(input.source
					? [
						{
							entityType: input.source.entityType,
							entityId: input.source.entityId,
							linkType: input.source.linkType ?? "source",
							description: input.source.description,
						},
					]
					: []),
				...(input.links ?? []),
			]

			for (const spec of link_specs) {
				try {
					await createTaskLink({
						supabase,
						userId,
						data: {
							task_id: task.id,
							entity_type: spec.entityType,
							entity_id: spec.entityId,
							link_type: spec.linkType,
							description: spec.description,
						},
					})
				} catch (error) {
					warnings.push(
						`Failed to create task link (${spec.entityType}:${spec.entityId}): ${formatErrorMessage(error)}`
					)
				}
			}

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
					personId: z.string().optional().describe("Project person id"),
					personName: z.string().optional().describe("Project person name"),
					personCompany: z.string().optional().describe("Project person company (disambiguation)"),
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
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)
			const warnings: string[] = []
			let resolvedAssignees: Assignee[] | undefined
			if (input.assignees !== undefined) {
				const resolved = await resolveAssignees({
					accountId,
					projectId,
					supabase,
					assignees: input.assignees,
				})
				resolvedAssignees = resolved.resolved
				warnings.push(...resolved.warnings)
			}

			// Build updates object with only provided fields
			const updates: TaskUpdate = {}
			if (input.title !== undefined) updates.title = input.title
			if (input.description !== undefined) updates.description = input.description
			if (input.cluster !== undefined) updates.cluster = input.cluster
			if (input.status !== undefined) updates.status = input.status
			if (input.priority !== undefined) updates.priority = input.priority
			if (input.benefit !== undefined) updates.benefit = input.benefit
			if (input.segments !== undefined) updates.segments = input.segments
			if (input.impact !== undefined) updates.impact = input.impact
			if (input.stage !== undefined) updates.stage = input.stage
			if (input.reason !== undefined) updates.reason = input.reason
			if (input.tags !== undefined) updates.tags = input.tags
			if (input.dueDate !== undefined) updates.due_date = input.dueDate
			if (input.estimatedEffort !== undefined) updates.estimated_effort = input.estimatedEffort
			if (input.parentTaskId !== undefined) updates.parent_task_id = input.parentTaskId
			if (input.dependsOnTaskIds !== undefined) updates.depends_on_task_ids = input.dependsOnTaskIds
			if (input.blocksTaskIds !== undefined) updates.blocks_task_ids = input.blocksTaskIds
			if (input.actualHours !== undefined) updates.actual_hours = input.actualHours
			if (resolvedAssignees !== undefined) updates.assigned_to = resolvedAssignees

			const task = await updateTask({
				supabase,
				taskId: input.taskId,
				userId,
				updates,
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
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { userId } = ensureContext(context)

			await deleteTask({
				supabase,
				taskId: input.taskId,
				userId,
			})

			return {
				success: true,
				message: `Deleted task ${input.taskId}`,
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
