-- Tasks System
-- Unified task/feature model for project prioritization and execution
-- Hierarchically organized under clusters, updated via voice/text chat

-- Primary Tasks Table -------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),

  -- Core Identity
  title text not null,
  description text,

  -- Hierarchy & Organization
  cluster text not null,
  parent_task_id uuid references tasks(id) on delete set null,

  -- Status & Priority
  status text not null default 'backlog',
  -- 'backlog' | 'todo' | 'in_progress' | 'blocked' | 'review' | 'done' | 'archived'
  priority integer not null default 3 check (priority between 1 and 3),
  -- 1 = Now, 2 = Next, 3 = Later

  -- Context Fields (from current feature data)
  benefit text,
  segments text,
  impact integer check (impact between 1 and 3),
  stage text,
  reason text,

  -- Assignment
  assigned_to jsonb default '[]'::jsonb,
  -- Array of: [
  --   { "type": "human", "user_id": "uuid", "name": "User Name" },
  --   { "type": "agent", "agent_type": "code-generation|research|testing|documentation" }
  -- ]

  -- Dates & Effort
  due_date timestamptz,
  estimated_effort text check (estimated_effort in ('S', 'M', 'L', 'XL')),
  actual_hours numeric(8,2),

  -- Tags & Dependencies
  tags text[] default array[]::text[],
  depends_on_task_ids uuid[] default array[]::uuid[],
  blocks_task_ids uuid[] default array[]::uuid[],

  -- Audit Trail
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes for common queries
create index if not exists idx_tasks_account on tasks(account_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_cluster on tasks(cluster);
create index if not exists idx_tasks_parent on tasks(parent_task_id) where parent_task_id is not null;
create index if not exists idx_tasks_assigned_to on tasks using gin(assigned_to);
create index if not exists idx_tasks_tags on tasks using gin(tags);
create index if not exists idx_tasks_priority_status on tasks(project_id, priority, status);

-- Triggers
create trigger set_tasks_timestamp
    before insert or update on tasks
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_tasks_user_tracking
    before insert or update on tasks
    for each row
execute procedure accounts.trigger_set_user_tracking();

-- RLS Policies
alter table tasks enable row level security;

create policy "Account members can select" on tasks
    for select
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account members can insert" on tasks
    for insert
    to authenticated
    with check (
        account_id in (select accounts.get_accounts_with_role())
        and project_id in (
            select p.id from projects p where p.account_id = account_id
        )
    );

create policy "Account members can update" on tasks
    for update
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    )
    with check (
        account_id in (select accounts.get_accounts_with_role())
        and project_id in (
            select p.id from projects p where p.account_id = account_id
        )
    );

create policy "Account owners can delete" on tasks
    for delete
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role('owner'))
    );


-- Task Activity Log ---------------------------------------------------------
create table if not exists task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,

  -- Activity Details
  activity_type text not null,
  -- 'created' | 'status_change' | 'assignment' | 'comment' | 'field_update' | 'voice_update'

  -- Changes (for field updates)
  field_name text,
  old_value jsonb,
  new_value jsonb,

  -- Comment/Description
  content text,

  -- Source
  user_id uuid references auth.users(id),
  source text default 'web',
  -- 'web' | 'voice' | 'assistant' | 'api'

  -- Metadata
  created_at timestamptz not null default now()
);

create index if not exists idx_task_activity_task on task_activity(task_id);
create index if not exists idx_task_activity_created on task_activity(created_at desc);
create index if not exists idx_task_activity_type on task_activity(task_id, activity_type);

-- RLS for task_activity
alter table task_activity enable row level security;

create policy "Users can view activity for accessible tasks" on task_activity
    for select
    to authenticated
    using (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );

create policy "Users can create activity for accessible tasks" on task_activity
    for insert
    to authenticated
    with check (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );


-- Agent Task Execution Runs -------------------------------------------------
create table if not exists agent_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,

  -- Agent Info
  agent_type text not null,
  -- 'code-generation' | 'research' | 'testing' | 'documentation'

  -- Execution Status
  status text not null default 'queued',
  -- 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

  -- Timing
  started_at timestamptz,
  completed_at timestamptz,

  -- Results
  output text,
  error text,
  logs jsonb default '[]'::jsonb,

  -- Context
  triggered_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_task on agent_task_runs(task_id);
create index if not exists idx_agent_runs_status on agent_task_runs(status);
create index if not exists idx_agent_runs_created on agent_task_runs(created_at desc);

-- RLS for agent_task_runs
alter table agent_task_runs enable row level security;

create policy "Users can view runs for accessible tasks" on agent_task_runs
    for select
    to authenticated
    using (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );

create policy "Users can create runs for accessible tasks" on agent_task_runs
    for insert
    to authenticated
    with check (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );


-- Extend Annotations for Task Comments --------------------------------------
-- Add task_id column to existing annotations table for task comments
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'annotations'
    and column_name = 'task_id'
  ) then
    alter table annotations add column task_id uuid references tasks(id) on delete cascade;
    create index idx_annotations_task on annotations(task_id) where task_id is not null;
  end if;
end $$;

-- End of tasks schema
