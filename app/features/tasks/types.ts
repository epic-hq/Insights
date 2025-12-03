// Task System Types
// These types match the database schema defined in supabase/schemas/43_tasks.sql

export type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "review" | "done" | "archived"

export type TaskPriority = 1 | 2 | 3 // 1 = Now, 2 = Next, 3 = Later

export type TaskStage = string // Free-form stage field (no longer restricted to specific values)

export type TaskEffort = "S" | "M" | "L" | "XL"

export type AgentType = "code-generation" | "research" | "testing" | "documentation"

export type AssigneeType = "human" | "agent"

export interface HumanAssignee {
	type: "human"
	user_id: string
	name: string
	avatar_url?: string
}

export interface AgentAssignee {
	type: "agent"
	agent_type: AgentType
}

export type Assignee = HumanAssignee | AgentAssignee

export interface Task {
	id: string
	title: string
	description: string | null

	// Hierarchy & Organization
	cluster: string
	parent_task_id: string | null

	// Status & Priority
	status: TaskStatus
	priority: TaskPriority

	// Context Fields
	benefit: string | null
	segments: string | null
	impact: number | null // 1-3
	stage: TaskStage | null
	reason: string | null

	// Assignment
	assigned_to: Assignee[]

	// Dates & Effort
	due_date: string | null // ISO timestamp
	estimated_effort: TaskEffort | null
	actual_hours: number | null

	// Tags & Dependencies
	tags: string[]
	depends_on_task_ids: string[]
	blocks_task_ids: string[]

	// Audit Trail
	account_id: string
	project_id: string
	created_by: string
	created_at: string // ISO timestamp
	updated_at: string // ISO timestamp
	completed_at: string | null // ISO timestamp
}

export type TaskInsert = Pick<Task, "title" | "cluster"> &
	Partial<
		Omit<
			Task,
			| "id"
			| "created_at"
			| "updated_at"
			| "completed_at"
			| "account_id"
			| "project_id"
			| "created_by"
			| "title"
			| "cluster"
		>
	>

export type TaskUpdate = Partial<Omit<Task, "id" | "created_at" | "account_id" | "project_id" | "created_by">>

// Task Activity Types
export type TaskActivityType = "created" | "status_change" | "assignment" | "comment" | "field_update" | "voice_update"

export type TaskActivitySource = "web" | "voice" | "assistant" | "api"

export interface TaskActivity {
	id: string
	task_id: string
	activity_type: TaskActivityType
	field_name: string | null
	old_value: unknown | null
	new_value: unknown | null
	content: string | null
	user_id: string | null
	source: TaskActivitySource
	created_at: string // ISO timestamp
}

// Agent Task Run Types
export type AgentRunStatus = "queued" | "running" | "success" | "failed" | "cancelled"

export interface AgentTaskRun {
	id: string
	task_id: string
	agent_type: AgentType
	status: AgentRunStatus
	started_at: string | null // ISO timestamp
	completed_at: string | null // ISO timestamp
	output: string | null
	error: string | null
	logs: unknown[] // JSONB array
	triggered_by: string | null
	created_at: string // ISO timestamp
}

// Filter and Query Types
export interface TaskFilters {
	status?: TaskStatus | TaskStatus[]
	cluster?: string
	priority?: TaskPriority
	assigned_to?: string // user_id or agent_type
	tags?: string[]
	parent_task_id?: string | null
	search?: string // search in title/description
}

export interface TaskListOptions {
	filters?: TaskFilters
	sort?: {
		field: keyof Task
		direction: "asc" | "desc"
	}
	limit?: number
	offset?: number
}

// Cluster Type (matching priorities page)
export type Cluster =
	| "Core product – capture & workflow"
	| "Core product – intelligence"
	| "Foundation – reliability & UX"
	| "Monetization & pricing"
	| "Engagement & analytics"
	| "Acquisition & marketing"
