-- Research analysis tracking tables -----------------------------------------
-- Stores metadata about AI analysis runs and the resulting summaries per
-- decision/research question so we can surface KeyDecisionsCard insights.

set search_path = public;

create table if not exists public.project_research_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  custom_instructions text,
  min_confidence numeric check (min_confidence >= 0 and min_confidence <= 1) default 0.6,
  run_summary text,
  recommended_actions jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_analysis_runs_project on public.project_research_analysis_runs(project_id, created_at desc);

create trigger set_project_analysis_runs_timestamp
  before insert or update on public.project_research_analysis_runs
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_project_analysis_runs_user_tracking
  before insert or update on public.project_research_analysis_runs
  for each row execute procedure accounts.trigger_set_user_tracking();

alter table public.project_research_analysis_runs enable row level security;

create policy "Account members can select project analysis runs"
  on public.project_research_analysis_runs
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account members can insert project analysis runs"
  on public.project_research_analysis_runs
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account members can update project analysis runs"
  on public.project_research_analysis_runs
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account owners can delete project analysis runs"
  on public.project_research_analysis_runs
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)
    )
  );

-- Per-question summaries generated from each run ----------------------------
create type public.research_analysis_question_kind as enum ('decision','research');

create table if not exists public.project_question_analysis (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.project_research_analysis_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  question_type public.research_analysis_question_kind not null,
  question_id uuid not null,
  summary text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  next_steps text,
  goal_achievement_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, question_type, question_id)
);

create index if not exists idx_project_question_analysis_project on public.project_question_analysis(project_id);
create index if not exists idx_project_question_analysis_question on public.project_question_analysis(question_id, question_type);
create index if not exists idx_project_question_analysis_run on public.project_question_analysis(run_id);

create trigger set_project_question_analysis_timestamp
  before insert or update on public.project_question_analysis
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_project_question_analysis_user_tracking
  before insert or update on public.project_question_analysis
  for each row execute procedure accounts.trigger_set_user_tracking();

alter table public.project_question_analysis enable row level security;

create policy "Account members can select project question analysis"
  on public.project_question_analysis
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account members can insert project question analysis"
  on public.project_question_analysis
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account members can update project question analysis"
  on public.project_question_analysis
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account owners can delete project question analysis"
  on public.project_question_analysis
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)
    )
  );

grant usage on type public.research_analysis_question_kind to authenticated;
grant select, insert, update on public.project_research_analysis_runs to authenticated;
grant select, insert, update on public.project_question_analysis to authenticated;
