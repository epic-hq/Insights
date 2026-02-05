# Task System Proposal

## Overview
Extend the Feature Prioritization table with a comprehensive task management system that bridges strategic planning with tactical execution.

## Core Requirements

### 1. Task Status
**States:**
- `backlog` - Not yet started, in consideration
- `todo` - Ready to start, prioritized
- `in_progress` - Actively being worked on
- `blocked` - Work stopped due to dependencies or issues
- `review` - Implementation complete, awaiting review
- `done` - Completed and shipped
- `archived` - Deprioritized or cancelled

**Visual Indicators:**
- Color-coded badges (similar to Priority badges)
- Status transitions via dropdown or drag-and-drop
- Auto-timestamp status changes for audit trail

### 2. Assignment System
**Assignee Types:**
- **Team Member** - Human user from account
  - Select from team member dropdown
  - Show avatar + name
  - Support multiple assignees for collaboration

- **AI Agent** - Automated task execution
  - Assign to specific agent types:
    - `code-generation` - For implementation tasks
    - `research` - For discovery and analysis
    - `testing` - For QA and validation
    - `documentation` - For writing docs
  - Show agent icon + type
  - Track agent execution logs

**Unassigned Handling:**
- Tasks default to unassigned
- Filter to show only unassigned tasks
- Quick-assign to self button

### 3. Task Details & Metadata
**Essential Fields:**
- Title (from feature name)
- Description (expandable, markdown support)
- Due date (optional, with overdue indicators)
- Estimated effort (S/M/L/XL or hours)
- Actual effort (tracked automatically or manually)
- Tags (for categorization beyond clusters)

**Relationships:**
- Parent feature (from priorities table)
- Dependencies (blocked by / blocks other tasks)
- Related tasks (soft links)
- Subtasks (break large tasks down)

### 4. Activity & History
**Audit Trail:**
- Status changes (who, when, old → new)
- Assignment changes
- Comments and updates
- Time spent (if tracking enabled)

**Comments:**
- Threaded discussions per task
- @mentions for team members
- File attachments
- Link to external resources
- Use the existing public.annotations table and expand it to support tasks

### 5. Views & Filters
**Built-in Views:**
- List view (default, sortable table)
- Board view (Kanban by status)
- Timeline view (Gantt-style)
- My Tasks (assigned to current user)
- Agent Tasks (assigned to AI agents)

**Filters:**
- By assignee (human or agent)
- By status
- By cluster (inherited from feature)
- By priority
- By due date (overdue, this week, this month)
- By tags

**Grouping:**
- Group by status (quick links for in_progress, todo, backlog -- and to the feature/task eg we use now, next, later)
- Group by assignee
- Group by cluster
- Group by priority

### 6. AI Agent Integration
**Agent Capabilities:**
- Auto-create tasks from features (one-click "Generate Tasks")
- Suggest task breakdowns for complex features
- Auto-assign based on task type and team availability
- Estimate effort based on similar past tasks
- Flag potential blockers or dependencies
- Auto-update status based on git commits or PR merges

**Agent Execution:**
- Track agent task attempts
- Show logs and outputs
- Manual review before marking done
- Retry failed agent tasks

### 7. Notifications & Reminders
**Trigger Events:**
- Task assigned to you
- Task you're watching changes status
- Task approaching due date
- Task blocked on your work
- Agent completes assigned task

**Delivery:**
- In-app notifications
- Email digest (daily/weekly)
- Slack/Teams integration (optional)

## Data Model

```typescript
type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "archived"

type AssigneeType = "human" | "ai_agent"

type Assignee = {
  id: string
  type: AssigneeType
  // If human
  user_id?: string
  user_name?: string
  user_avatar?: string
  // If AI agent
  agent_type?: "code-generation" | "research" | "testing" | "documentation"
}

type Task = {
  id: string
  feature_id: string // Link to feature row
  title: string
  description: string
  status: TaskStatus
  assignees: Assignee[]

  // Metadata
  priority: 1 | 2 | 3 // Inherited or overridden
  due_date?: Date
  estimated_effort?: "S" | "M" | "L" | "XL"
  actual_effort_hours?: number
  tags: string[]

  // Relationships
  parent_task_id?: string
  depends_on_task_ids: string[]
  blocks_task_ids: string[]

  // Audit
  created_by: string
  created_at: Date
  updated_at: Date
  completed_at?: Date

  // Agent specific
  agent_execution_logs?: AgentLog[]
}

type AgentLog = {
  id: string
  task_id: string
  agent_type: string
  started_at: Date
  completed_at?: Date
  status: "running" | "success" | "failed"
  output?: string
  error?: string
}

type TaskComment = {
  id: string
  task_id: string
  user_id: string
  user_name: string
  content: string
  created_at: Date
  updated_at?: Date
  parent_comment_id?: string // For threading
}

type TaskActivity = {
  id: string
  task_id: string
  user_id?: string
  activity_type: "status_change" | "assignment" | "comment" | "metadata_update"
  old_value?: any
  new_value?: any
  created_at: Date
}
```

## UI Components

### Task Table Row Extension
- Expandable rows to show task details inline
- Quick actions: assign, change status, add comment
- Visual indicators for blockers, overdue, agent-assigned

### Task Detail Modal
- Full task information and history
- Edit all fields inline
- Activity timeline on the right
- Comment section at bottom
- Related tasks sidebar

### Task Creation
- "Add Task" button on feature rows
- Bulk task generation via AI
- Template-based task creation (common patterns)

### Agent Task Monitor
- Dedicated view for agent-assigned tasks
- Real-time logs and status
- Intervention options (pause, retry, cancel)

## Implementation Phases

### Phase 1: Basic Tasks (MVP)
- Add task status field to features
- Simple assignee (single human only)
- Status transitions
- Basic list view with filters

### Phase 2: Enhanced Metadata
- Multiple assignees
- Due dates and effort estimates
- Tags and dependencies
- Comments

### Phase 3: AI Agent Integration
- Assign to AI agents
- Agent execution tracking
- Auto-task generation from features
- Agents ask humans for Review at different stages as needed

### Phase 4: Advanced Views & Workflows
- Board and timeline views
- Notifications
- Bulk operations
- Custom workflows

## Success Metrics
- % of features with associated tasks
- Task completion rate
- Average time in each status
- Agent vs human task distribution
- Team utilization (assigned vs capacity)

## Open Questions
1. Should tasks live in same table as features, or separate?
A: Tasks and features seem like same thing to me or could be handled in same table for simplicity. Ideally tasks grow out of
and are rooted hierarchically in some context like the Clustering we have. So maybe use the term 'task' instead of feature. does this make sense?
2. Integration with git/GitHub for auto-status updates?
No, this is not a dev tool. But we should update a tasks progress via user voice or text chat via the Assistant.
3. Time tracking - automatic, manual, or both?
Manual for now. Not a  high priority now.
4. Permission model - who can create/edit/assign tasks?
Anyone for now.
5. API for external integrations (Jira, Linear, etc.)?
None for now. Not a high priority now.
6. Voice chat/mastra integration - yes.