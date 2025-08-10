-- Enable RLS and create policies + indexes for annotations, entity_flags
-- Add extra composite indexes for votes
-- Generated 2025-08-09

-- ───────────────────────────────────────────────────────────
--  ANNOTATIONS
-- ───────────────────────────────────────────────────────────
alter table public.annotations
    enable row level security;

create policy "Users can view annotations in their account"
    on public.annotations
    for select
    using (
        auth.uid() = created_by_user_id
        or auth.role() = 'service_role'
    );

create policy "Users can insert annotations in their account"
    on public.annotations
    for insert
    with check (
        auth.uid() = created_by_user_id
        or auth.role() = 'service_role'
    );

create policy "Users can update their own annotations"
    on public.annotations
    for update
    using  (auth.uid() = created_by_user_id or auth.role() = 'service_role')
    with check (auth.uid() = created_by_user_id or auth.role() = 'service_role');

create policy "Users can delete their own annotations"
    on public.annotations
    for delete
    using (auth.uid() = created_by_user_id or auth.role() = 'service_role');

-- Composite index for fast entity lookup
create index if not exists idx_annotations_entity_project
    on public.annotations (entity_type, entity_id, project_id);

-- ───────────────────────────────────────────────────────────
--  ENTITY FLAGS
-- ───────────────────────────────────────────────────────────
alter table public.entity_flags
    enable row level security;

create policy "Users can view flags in their account"
    on public.entity_flags
    for select
    using (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

create policy "Users can insert flags in their account"
    on public.entity_flags
    for insert
    with check (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

create policy "Users can update their own flags"
    on public.entity_flags
    for update
    using  (auth.uid() = user_id or auth.role() = 'service_role')
    with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "Users can delete their own flags"
    on public.entity_flags
    for delete
    using (auth.uid() = user_id or auth.role() = 'service_role');

-- Composite index for fast entity lookup
create index if not exists idx_entity_flags_entity_project
    on public.entity_flags (entity_type, entity_id, project_id);

-- ───────────────────────────────────────────────────────────
--  VOTES – extra composite index
-- ───────────────────────────────────────────────────────────
create index if not exists idx_votes_entity_project
    on public.votes (entity_type, entity_id, project_id);