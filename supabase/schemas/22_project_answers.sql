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
  prompt_id uuid references public.interview_prompts(id) on delete set null,
  research_question_id uuid references public.research_questions(id) on delete set null,
  decision_question_id uuid references public.decision_questions(id) on delete set null,
  followup_of_answer_id uuid references public.project_answers(id) on delete set null,
  question_id text,                           -- legacy soft link to question meta (kept for compatibility)
  question_text text not null,                -- snapshot at time of asking
  detected_question_text text,                -- raw text when inferred from transcript (ad-hoc)
  question_category text,                     -- e.g. context, pain, goals
  estimated_time_minutes int,
  order_index int,
  status text default 'planned',
  origin text default 'scripted',
  asked_at timestamptz,
  answered_at timestamptz,
  skipped_at timestamptz,
  answer_text text,
  confidence numeric,
  analysis_summary text,
  analysis_rationale text,
  analysis_next_steps text,
  analysis_run_metadata jsonb,
  time_spent_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ------------------------------------------------------------------
create index if not exists idx_project_answers_project_id          on public.project_answers(project_id);
create index if not exists idx_project_answers_interview_id        on public.project_answers(interview_id);
create index if not exists idx_project_answers_respondent_id       on public.project_answers(respondent_person_id);
create index if not exists idx_project_answers_status              on public.project_answers(status);
create index if not exists idx_project_answers_origin              on public.project_answers(origin);
create index if not exists idx_project_answers_created_at          on public.project_answers(created_at);
create index if not exists idx_project_answers_question_id         on public.project_answers(question_id);
create index if not exists idx_project_answers_prompt_id           on public.project_answers(prompt_id);
create index if not exists idx_project_answers_research_question   on public.project_answers(project_id, research_question_id);
create index if not exists idx_project_answers_decision_question   on public.project_answers(project_id, decision_question_id);
create index if not exists idx_project_answers_followup            on public.project_answers(followup_of_answer_id);
create index if not exists idx_project_answers_order               on public.project_answers(interview_id, order_index);

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
