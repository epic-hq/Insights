-- Project Answers (normalized per-interview Q/A tracking)
-- Declarative schema: follow member-role RLS and timestamp/user tracking triggers

set search_path = public;

-- Core table ---------------------------------------------------------------
create table if not exists public.project_answers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  interview_id uuid references public.interviews(id) on delete set null,
  interviewer_user_id uuid references auth.users(id) on delete set null,
  respondent_person_id uuid references public.people(id) on delete set null,
  question_id text,                           -- soft link to canonical QuestionSet.questions[].id
  question_text text not null,                -- snapshot at time of asking
  status text check (status in ('asked','answered','skipped','followup')) default 'asked',
  answer_text text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  time_spent_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ------------------------------------------------------------------
create index if not exists idx_project_answers_project_id       on public.project_answers(project_id);
create index if not exists idx_project_answers_interview_id     on public.project_answers(interview_id);
create index if not exists idx_project_answers_respondent_id    on public.project_answers(respondent_person_id);
create index if not exists idx_project_answers_status           on public.project_answers(status);
create index if not exists idx_project_answers_created_at       on public.project_answers(created_at);
create index if not exists idx_project_answers_question_id      on public.project_answers(question_id);

-- Triggers (timestamps + user tracking) ------------------------------------
create trigger set_project_answers_timestamp
  before insert or update on public.project_answers
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_project_answers_user_tracking
  before insert or update on public.project_answers
  for each row execute procedure accounts.trigger_set_user_tracking();

-- RLS ----------------------------------------------------------------------
alter table public.project_answers enable row level security;

-- Read by account members who have access to the owning project
create policy "Account members can select project_answers"
  on public.project_answers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

-- Insert by account members on their project
create policy "Account members can insert project_answers"
  on public.project_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

-- Update by account members on their project
create policy "Account members can update project_answers"
  on public.project_answers
  for update
  to authenticated
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

-- Delete by account owners only
create policy "Account owners can delete project_answers"
  on public.project_answers
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)
    )
  );
