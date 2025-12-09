-- Task Links Table
-- Supports linking tasks to various entities (evidence, people, organizations, opportunities, interviews, insights)
-- This provides structured relationships for the "reason" and "rationale" fields

create table if not exists task_links (
  id uuid primary key default gen_random_uuid(),

  -- Task reference
  task_id uuid not null references tasks(id) on delete cascade,

  -- Entity reference (polymorphic)
  entity_type text not null check (entity_type in ('evidence', 'person', 'organization', 'opportunity', 'interview', 'insight', 'persona')),
  entity_id uuid not null,

  -- Link metadata
  link_type text not null default 'supports' check (link_type in ('supports', 'blocks', 'related', 'source')),
  -- 'supports' - evidence/insight that supports this task
  -- 'blocks' - something that's blocking progress
  -- 'related' - general relationship
  -- 'source' - origin/reason for the task

  description text, -- Optional explanation of the relationship

  -- Audit
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_task_links_task on task_links(task_id);
create index if not exists idx_task_links_entity on task_links(entity_type, entity_id);
create index if not exists idx_task_links_type on task_links(link_type);

-- Trigger for updated_at
create trigger set_task_links_timestamp
    before insert or update on task_links
    for each row
execute procedure accounts.trigger_set_timestamps();

-- RLS Policies
alter table task_links enable row level security;

create policy "Users can select task links for accessible tasks" on task_links
    for select
    to authenticated
    using (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );

create policy "Users can insert task links for accessible tasks" on task_links
    for insert
    to authenticated
    with check (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );

create policy "Users can update task links for accessible tasks" on task_links
    for update
    to authenticated
    using (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    )
    with check (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );

create policy "Users can delete task links for accessible tasks" on task_links
    for delete
    to authenticated
    using (
        task_id in (
            select id from tasks
            where account_id in (select accounts.get_accounts_with_role())
        )
    );
