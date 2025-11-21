# Task System - Technical Design

## Overview
Based on feedback, we're implementing a **unified task model** where "features" and "tasks" are the same entity. Tasks are hierarchically organized under clusters and can be updated via voice/text chat through the Assistant.

## Core Design Principles
1. **Unified Model**: One table, multiple views - no distinction between "features" and "tasks"
2. **Hierarchical Organization**: Tasks belong to clusters (like our current grouping)
3. **Conversational Updates**: Primary interaction is via chat with Uppy Assistant
4. **Simple Permissions**: Anyone can create/edit/assign initially
5. **Manual Time Tracking**: Optional, low priority

## Database Schema

### Primary Table: `tasks`
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core Identity
  title TEXT NOT NULL,
  description TEXT,

  -- Hierarchy & Organization
  cluster TEXT NOT NULL, -- Maps to our Cluster type
  parent_task_id UUID REFERENCES tasks(id), -- For subtasks

  -- Status & Priority
  status TEXT NOT NULL DEFAULT 'backlog',
    -- 'backlog' | 'todo' | 'in_progress' | 'blocked' | 'review' | 'done' | 'archived'
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 3),
    -- 1 = Now, 2 = Next, 3 = Later

  -- Context Fields (from current feature data)
  benefit TEXT, -- Who benefits and how
  segments TEXT, -- Target user segments
  impact INTEGER CHECK (impact BETWEEN 1 AND 3), -- Visual confidence bars
  stage TEXT CHECK (stage IN ('activation', 'onboarding', 'retention')),
  reason TEXT, -- Prioritization rationale

  -- Assignment
  assigned_to JSONB DEFAULT '[]'::jsonb,
    -- Array of: [
    --   { "type": "human", "user_id": "uuid", "name": "User Name" },
    --   { "type": "agent", "agent_type": "code-generation|research|testing|documentation" }
    -- ]

  -- Dates & Effort
  due_date TIMESTAMP WITH TIME ZONE,
  estimated_effort TEXT CHECK (estimated_effort IN ('S', 'M', 'L', 'XL')),
  actual_hours DECIMAL(8,2),

  -- Tags & Dependencies
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  depends_on_task_ids UUID[] DEFAULT ARRAY[]::UUID[],
  blocks_task_ids UUID[] DEFAULT ARRAY[]::UUID[],

  -- Audit Trail
  account_id UUID NOT NULL REFERENCES accounts(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- RLS
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

-- Indexes for common queries
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_cluster ON tasks(cluster);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_assigned_to ON tasks USING gin(assigned_to);
CREATE INDEX idx_tasks_tags ON tasks USING gin(tags);

-- RLS Policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their projects"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tasks in their projects"
  ON tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in their projects"
  ON tasks FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );
```

### Activity Log: `task_activity`
```sql
CREATE TABLE task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Activity Details
  activity_type TEXT NOT NULL,
    -- 'status_change' | 'assignment' | 'comment' | 'field_update' | 'voice_update'

  -- Changes (for field updates)
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,

  -- Comment/Description
  content TEXT,

  -- Source
  user_id UUID REFERENCES auth.users(id),
  source TEXT DEFAULT 'web', -- 'web' | 'voice' | 'assistant' | 'api'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT task_activity_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_task_activity_task ON task_activity(task_id);
CREATE INDEX idx_task_activity_created ON task_activity(created_at);
```

### Agent Execution: `agent_task_runs`
```sql
CREATE TABLE agent_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Agent Info
  agent_type TEXT NOT NULL,
    -- 'code-generation' | 'research' | 'testing' | 'documentation'

  -- Execution Status
  status TEXT NOT NULL DEFAULT 'queued',
    -- 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Results
  output TEXT,
  error TEXT,
  logs JSONB DEFAULT '[]'::jsonb,

  -- Context
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT agent_task_runs_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_agent_runs_task ON agent_task_runs(task_id);
CREATE INDEX idx_agent_runs_status ON agent_task_runs(status);
```

### Reuse Annotations Table for Comments
The existing `annotations` table can be extended to support task comments:

```sql
-- Add task_id column to annotations
ALTER TABLE annotations ADD COLUMN task_id UUID REFERENCES tasks(id);

-- Add index
CREATE INDEX idx_annotations_task ON annotations(task_id);

-- Comments are annotations with task_id set and insight_id/evidence_id null
```

## Data Migration Strategy

### Phase 1: Create Tables
1. Run migrations to create `tasks`, `task_activity`, `agent_task_runs` tables
2. Update `annotations` to add `task_id` column
3. Set up RLS policies

### Phase 2: Seed Initial Data
Transform current mock feature data into tasks:

```typescript
// Migration script: seed-initial-tasks.ts
const MOCK_FEATURES: FeatureRow[] = [/* ... existing data ... */]

async function seedTasks(supabase: SupabaseClient, projectId: string, accountId: string, userId: string) {
  const tasksToInsert = MOCK_FEATURES.map(feature => ({
    title: feature.feature,
    description: `${feature.benefit}\n\nTarget: ${feature.segments}\n\nReason: ${feature.reason}`,
    cluster: feature.cluster,
    status: feature.priority === 1 ? 'todo' : 'backlog',
    priority: feature.priority,
    impact: feature.impact,
    stage: feature.stage,
    benefit: feature.benefit,
    segments: feature.segments,
    reason: feature.reason,
    project_id: projectId,
    account_id: accountId,
    created_by: userId,
  }))

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  return { data, error }
}
```

## CRUD Operations

### Create Task
```typescript
// app/features/tasks/db.ts

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
  data: Partial<TaskInsert>
}) {
  const task = {
    ...data,
    account_id: accountId,
    project_id: projectId,
    created_by: userId,
    status: data.status || 'backlog',
    priority: data.priority || 3,
  }

  const { data: created, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()

  if (error) throw error

  // Log activity
  await logTaskActivity({
    supabase,
    taskId: created.id,
    activityType: 'created',
    userId,
  })

  return created
}
```

### Read Tasks
```typescript
export async function getTasks({
  supabase,
  projectId,
  filters = {},
}: {
  supabase: SupabaseClient
  projectId: string
  filters?: {
    status?: string
    cluster?: string
    assignedTo?: string
    priority?: number
  }
}) {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.cluster) {
    query = query.eq('cluster', filters.cluster)
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }
  // Note: assignedTo filter needs JSONB query

  const { data, error } = await query.order('priority').order('created_at')

  if (error) throw error
  return data
}

export async function getTaskById({
  supabase,
  taskId,
}: {
  supabase: SupabaseClient
  taskId: string
}) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (error) throw error
  return data
}
```

### Update Task
```typescript
export async function updateTask({
  supabase,
  taskId,
  userId,
  updates,
}: {
  supabase: SupabaseClient
  taskId: string
  userId: string
  updates: Partial<TaskUpdate>
}) {
  // Get current state for activity log
  const current = await getTaskById({ supabase, taskId })

  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw error

  // Log each changed field
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = current[key as keyof typeof current]
    if (oldValue !== newValue) {
      await logTaskActivity({
        supabase,
        taskId,
        activityType: 'field_update',
        userId,
        fieldName: key,
        oldValue,
        newValue,
      })
    }
  }

  return data
}
```

### Delete Task
```typescript
export async function deleteTask({
  supabase,
  taskId,
  userId,
}: {
  supabase: SupabaseClient
  taskId: string
  userId: string
}) {
  // Soft delete by archiving
  return updateTask({
    supabase,
    taskId,
    userId,
    updates: { status: 'archived' },
  })
}
```

### Activity Logging
```typescript
async function logTaskActivity({
  supabase,
  taskId,
  activityType,
  userId,
  fieldName,
  oldValue,
  newValue,
  content,
  source = 'web',
}: {
  supabase: SupabaseClient
  taskId: string
  activityType: string
  userId: string
  fieldName?: string
  oldValue?: any
  newValue?: any
  content?: string
  source?: 'web' | 'voice' | 'assistant' | 'api'
}) {
  await supabase.from('task_activity').insert({
    task_id: taskId,
    activity_type: activityType,
    field_name: fieldName,
    old_value: oldValue ? JSON.stringify(oldValue) : null,
    new_value: newValue ? JSON.stringify(newValue) : null,
    content,
    user_id: userId,
    source,
  })
}
```

## API Routes

### Task CRUD Endpoints
```typescript
// app/routes/api.tasks.ts
export async function loader({ context, params, request }: LoaderArgs) {
  const ctx = context.get(userContext)
  const url = new URL(request.url)

  const filters = {
    status: url.searchParams.get('status') || undefined,
    cluster: url.searchParams.get('cluster') || undefined,
    priority: url.searchParams.get('priority')
      ? parseInt(url.searchParams.get('priority')!)
      : undefined,
  }

  const tasks = await getTasks({
    supabase: ctx.supabase,
    projectId: params.projectId!,
    filters,
  })

  return json({ tasks })
}

export async function action({ context, params, request }: ActionArgs) {
  const ctx = context.get(userContext)
  const formData = await request.json()
  const intent = formData._action

  switch (intent) {
    case 'create':
      return createTaskAction(ctx, params, formData)
    case 'update':
      return updateTaskAction(ctx, params, formData)
    case 'delete':
      return deleteTaskAction(ctx, params, formData)
    default:
      return json({ error: 'Invalid action' }, { status: 400 })
  }
}
```

## Voice/Chat Integration

### Voice Command Parsing
The Assistant can parse natural language commands to update tasks:

```typescript
// app/features/tasks/services/task-command-parser.ts

interface TaskCommand {
  action: 'update_status' | 'assign' | 'set_priority' | 'add_comment'
  taskId?: string
  taskTitle?: string // For fuzzy matching
  params: Record<string, any>
}

export function parseTaskCommand(userInput: string): TaskCommand | null {
  // Examples:
  // "Mark STT input as in progress"
  // "Assign OAuth reliability to me"
  // "Set pricing to priority 1"
  // "Add comment to call workflow: needs design review"

  // Use AI to parse intent
  // Return structured command
}
```

### Assistant Tool Definition
```typescript
// In ProjectStatusAgent tools configuration

const taskUpdateTool = {
  name: 'update_task',
  description: 'Update a task status, priority, assignment, or other fields',
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to update',
      },
      taskTitle: {
        type: 'string',
        description: 'Task title for fuzzy matching if taskId not provided',
      },
      updates: {
        type: 'object',
        description: 'Fields to update',
        properties: {
          status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'blocked', 'review', 'done', 'archived'] },
          priority: { type: 'number', enum: [1, 2, 3] },
          assigned_to: { type: 'array' },
          // ... other fields
        },
      },
    },
    required: ['updates'],
  },
}
```

## UI Components

### Task Table with Inline Editing
```typescript
// app/features/tasks/components/TaskTable.tsx

export function TaskTable() {
  const fetcher = useFetcher()
  const [tasks, setTasks] = useState<Task[]>([])

  const handleStatusChange = (taskId: string, newStatus: string) => {
    fetcher.submit(
      {
        _action: 'update',
        taskId,
        updates: { status: newStatus },
      },
      { method: 'POST', encType: 'application/json' }
    )
  }

  return (
    <Table>
      {/* Grouped by cluster like current implementation */}
      {/* Inline dropdowns for status/priority */}
      {/* Editable fields on click */}
    </Table>
  )
}
```

### Task Detail Modal
```typescript
// app/features/tasks/components/TaskDetailModal.tsx

export function TaskDetailModal({ taskId }: { taskId: string }) {
  const { data: task } = useTaskDetail(taskId)
  const { data: activity } = useTaskActivity(taskId)

  return (
    <Dialog>
      <TaskForm task={task} />
      <TaskActivityTimeline activity={activity} />
      <TaskComments taskId={taskId} />
    </Dialog>
  )
}
```

## Implementation Status

### Phase 1: Data Layer ✅ **COMPLETED**
1. ✅ Create database migrations - `supabase/schemas/43_tasks.sql` + generated migration
2. ✅ Implement CRUD functions in `app/features/tasks/db.ts` - Full CRUD + activity logging
3. ✅ Create API routes for tasks - `app/routes/api.tasks.tsx` with GET/POST endpoints
4. ✅ Seed initial data from mock features - `app/features/tasks/seed.ts` with auto-seeding
5. ✅ Test RLS policies - Policies implemented and tested

**Files Created:**
- `supabase/schemas/43_tasks.sql` - Schema definitions
- `supabase/migrations/20251121191403_tasks_system.sql` - Auto-generated migration
- `app/features/tasks/types.ts` - TypeScript type definitions
- `app/features/tasks/db.ts` - CRUD operations and query helpers
- `app/features/tasks/seed.ts` - Data seeding utilities
- `app/routes/api.tasks.tsx` - RESTful API endpoints

### Phase 2: UI Layer 🚧 **IN PROGRESS**
1. ✅ Update priorities page to read from database - Uses loader with auto-seeding
2. 🚧 Add inline editing for status/priority/assignment - **NEXT**
3. ⬜ Create task detail modal
4. ⬜ Add task creation form
5. ⬜ Implement filters and grouping

### Phase 3: Voice Integration
1. Add task update tool to ProjectStatusAgent
2. Implement command parser
3. Add voice activity logging
4. Test natural language task updates

### Phase 4: Agent Automation
1. Create agent task assignment logic
2. Implement agent execution tracking
3. Add agent run logs to UI
4. Build agent review workflow

## Testing Strategy

### Unit Tests
- CRUD operations
- RLS policy validation
- Command parser accuracy

### Integration Tests
- API route handlers
- Voice command execution
- Database constraints

### E2E Tests
- Complete task lifecycle
- Voice update flow
- Agent assignment and execution

## Performance Considerations

1. **Pagination**: Implement cursor-based pagination for large task lists
2. **Caching**: Use React Query for client-side caching
3. **Indexing**: Database indexes on common query patterns
4. **Real-time Updates**: Consider Supabase realtime subscriptions for collaborative editing

## Security Considerations

1. **RLS**: All queries go through RLS policies
2. **Input Validation**: Zod schemas for all mutations
3. **Rate Limiting**: Limit voice command frequency
4. **Audit Trail**: Complete activity log for compliance
