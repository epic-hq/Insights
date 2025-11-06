-- Actions table for tracking recommended actions from lenses
-- Used by Product Lens (features), Sales Lens (tasks), Research Lens (gaps)

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  -- Action metadata
  type text not null check (type in ('feature', 'deal_task', 'research_gap', 'support_improvement', 'other')),
  title text not null,
  description text,

  -- Prioritization
  priority text check (priority in ('critical', 'high', 'medium', 'low')),
  impact_score numeric check (impact_score >= 0 and impact_score <= 1),

  -- Status tracking
  status text not null default 'proposed' check (status in ('proposed', 'planned', 'in_progress', 'done', 'cancelled')),

  -- Relationships
  evidence_ids uuid[] default '{}',  -- Direct links to supporting evidence
  insight_id uuid references public.insights(id) on delete set null,
  theme_id uuid references public.themes(id) on delete set null,

  -- Lens context
  lens_type text check (lens_type in ('product', 'sales', 'research', 'support', 'custom')),
  metadata jsonb default '{}',  -- Lens-specific data (e.g., WTP score, frequency, pain_theme_id)

  -- Ownership
  owner_user_id uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  -- Constraints
  constraint actions_account_project_fk foreign key (account_id, project_id) references public.projects(account_id, id) on delete cascade
);

-- Indexes
create index if not exists idx_actions_project_id on public.actions(project_id);
create index if not exists idx_actions_type on public.actions(type);
create index if not exists idx_actions_status on public.actions(status);
create index if not exists idx_actions_lens_type on public.actions(lens_type);
create index if not exists idx_actions_priority on public.actions(priority);
create index if not exists idx_actions_impact_score on public.actions(impact_score desc);
create index if not exists idx_actions_metadata_gin on public.actions using gin (metadata);
create index if not exists idx_actions_evidence_ids_gin on public.actions using gin (evidence_ids);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_actions_updated_at on public.actions;
create trigger set_actions_updated_at
  before update on public.actions
  for each row
  execute function public.set_updated_at();

-- RLS policies
alter table public.actions enable row level security;

-- Policy: Users can view actions for projects they belong to
create policy "Users can view actions for their projects"
  on public.actions for select
  using (
    exists (
      select 1 from public.account_user
      where account_user.account_id = actions.account_id
        and account_user.user_id = auth.uid()
    )
  );

-- Policy: Users can insert actions for projects they belong to
create policy "Users can create actions for their projects"
  on public.actions for insert
  with check (
    exists (
      select 1 from public.account_user
      where account_user.account_id = actions.account_id
        and account_user.user_id = auth.uid()
    )
  );

-- Policy: Users can update actions for projects they belong to
create policy "Users can update actions for their projects"
  on public.actions for update
  using (
    exists (
      select 1 from public.account_user
      where account_user.account_id = actions.account_id
        and account_user.user_id = auth.uid()
    )
  );

-- Policy: Users can delete actions for projects they belong to
create policy "Users can delete actions for their projects"
  on public.actions for delete
  using (
    exists (
      select 1 from public.account_user
      where account_user.account_id = actions.account_id
        and account_user.user_id = auth.uid()
    )
  );

-- Comments for documentation
comment on table public.actions is 'Recommended actions generated from lens analysis (features, tasks, research gaps)';
comment on column public.actions.type is 'Type of action: feature, deal_task, research_gap, support_improvement, other';
comment on column public.actions.lens_type is 'Which lens generated this action: product, sales, research, support, custom';
comment on column public.actions.impact_score is 'Combined impact score (0-1) from lens metrics (e.g., frequency × intensity × WTP for product lens)';
comment on column public.actions.metadata is 'Lens-specific metadata (e.g., pain_theme_id, user_group_type, wtp_score, frequency)';
comment on column public.actions.evidence_ids is 'Array of evidence IDs supporting this action';
