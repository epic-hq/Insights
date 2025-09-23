-- Research Planning: Goals → Decision Questions → Research Questions → Interview Prompts
-- Declarative schema (generate migrations via supabase db diff)

-- Container for a research plan per project (optional but useful for versioning)
create table if not exists public.project_research_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  goal text not null,
  status text default 'draft',
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Decision questions that guide research (e.g., Should we X?)
create table if not exists public.decision_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_id uuid references public.project_research_plans(id) on delete cascade,
  text text not null,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Key metrics to evaluate a decision question (normalized)
create table if not exists public.decision_question_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  decision_question_id uuid not null references public.decision_questions(id) on delete cascade,
  metric text not null
);

-- Risks if answered incorrectly (normalized)
create table if not exists public.decision_question_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  decision_question_id uuid not null references public.decision_questions(id) on delete cascade,
  risk text not null
);

-- Research questions that answer decision questions
create table if not exists public.research_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_id uuid references public.project_research_plans(id) on delete cascade,
  decision_question_id uuid references public.decision_questions(id) on delete set null,
  text text not null,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Evidence types for research questions (e.g., QUOTES, ANALYTICS)
create table if not exists public.research_question_evidence_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  research_question_id uuid not null references public.research_questions(id) on delete cascade,
  evidence_type text not null
);

-- Suggested methods to collect evidence (e.g., interviews, survey)
create table if not exists public.research_question_methods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  research_question_id uuid not null references public.research_questions(id) on delete cascade,
  method text not null
);

-- Interview prompts (questions you ask people)
create table if not exists public.interview_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_id uuid references public.project_research_plans(id) on delete cascade,
  text text not null,
  category text,
  estimated_time_minutes int,
  is_must_have boolean default false,
  status text check (status in ('proposed','asked','answered','skipped','rejected')) default 'proposed',
  order_index int,
  scores jsonb,
  source text default 'ai',
  rationale text,
  is_selected boolean default false,
  selected_order int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Follow-up prompts for a given interview prompt
create table if not exists public.interview_prompt_followups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_id uuid not null references public.interview_prompts(id) on delete cascade,
  text text not null
);

-- Bias checks / interviewer cautions per prompt
create table if not exists public.interview_prompt_bias_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_id uuid not null references public.interview_prompts(id) on delete cascade,
  text text not null
);

-- Junction: prompts map to one or more research questions
create table if not exists public.interview_prompt_research_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_id uuid not null references public.interview_prompts(id) on delete cascade,
  research_question_id uuid not null references public.research_questions(id) on delete cascade
);

-- Optional: other data sources suggestions per plan
create table if not exists public.research_plan_data_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_id uuid not null references public.project_research_plans(id) on delete cascade,
  source text not null
);

-- Indexes
create index if not exists idx_research_plans_project on public.project_research_plans(project_id);
create index if not exists idx_decision_questions_project on public.decision_questions(project_id);
create index if not exists idx_decision_questions_plan on public.decision_questions(plan_id);
create index if not exists idx_dq_metrics_dq on public.decision_question_metrics(decision_question_id);
create index if not exists idx_dq_risks_dq on public.decision_question_risks(decision_question_id);
create index if not exists idx_research_questions_project on public.research_questions(project_id);
create index if not exists idx_research_questions_plan on public.research_questions(plan_id);
create index if not exists idx_research_questions_dq on public.research_questions(decision_question_id);
create index if not exists idx_rq_evidence_rq on public.research_question_evidence_types(research_question_id);
create index if not exists idx_rq_methods_rq on public.research_question_methods(research_question_id);
create index if not exists idx_prompts_project on public.interview_prompts(project_id);
create index if not exists idx_prompts_project_order on public.interview_prompts(project_id, order_index);
create index if not exists idx_prompts_plan on public.interview_prompts(plan_id);
create index if not exists idx_prompt_followups_prompt on public.interview_prompt_followups(prompt_id);
create index if not exists idx_prompt_bias_prompt on public.interview_prompt_bias_checks(prompt_id);
create index if not exists idx_prompt_rq_prompt on public.interview_prompt_research_questions(prompt_id);
create index if not exists idx_prompt_rq_rq on public.interview_prompt_research_questions(research_question_id);
create index if not exists idx_plan_sources_plan on public.research_plan_data_sources(plan_id);

-- RLS
alter table public.project_research_plans enable row level security;
alter table public.decision_questions enable row level security;
alter table public.decision_question_metrics enable row level security;
alter table public.decision_question_risks enable row level security;
alter table public.research_questions enable row level security;
alter table public.research_question_evidence_types enable row level security;
alter table public.research_question_methods enable row level security;
alter table public.interview_prompts enable row level security;
alter table public.interview_prompt_followups enable row level security;
alter table public.interview_prompt_bias_checks enable row level security;
alter table public.interview_prompt_research_questions enable row level security;
alter table public.research_plan_data_sources enable row level security;

-- Shared predicate: account membership via owning project
-- SELECT
create policy "Account members can read research plans"
  on public.project_research_plans
  for select
  using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- INSERT
create policy "Account members can insert research plans"
  on public.project_research_plans
  for insert
  with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- UPDATE
create policy "Account members can update research plans"
  on public.project_research_plans
  for update
  using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  )
  with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- DELETE
create policy "Account members can delete research plans"
  on public.project_research_plans
  for delete
  using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- Apply same membership policies to child tables (read/insert/update/delete)
do $$
begin
  perform 1;
exception when others then
  null;
end$$;

-- Helper to DRY policy creation via SQL snippets is not available in declarative file,
-- so we repeat patterns for each table for clarity and explicitness.

-- decision_questions
create policy "Account members can read DQ"
  on public.decision_questions for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can insert DQ"
  on public.decision_questions for insert with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can update DQ"
  on public.decision_questions for update using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can delete DQ"
  on public.decision_questions for delete using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- decision_question_metrics
create policy "Account members can read DQ metrics"
  on public.decision_question_metrics for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write DQ metrics"
  on public.decision_question_metrics for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- decision_question_risks
create policy "Account members can read DQ risks"
  on public.decision_question_risks for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write DQ risks"
  on public.decision_question_risks for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- research_questions
create policy "Account members can read RQ"
  on public.research_questions for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can insert RQ"
  on public.research_questions for insert with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can update RQ"
  on public.research_questions for update using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can delete RQ"
  on public.research_questions for delete using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- research_question_evidence_types
create policy "Account members can read RQ evidence"
  on public.research_question_evidence_types for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write RQ evidence"
  on public.research_question_evidence_types for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- research_question_methods
create policy "Account members can read RQ methods"
  on public.research_question_methods for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write RQ methods"
  on public.research_question_methods for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- interview_prompts
create policy "Account members can read prompts"
  on public.interview_prompts for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can insert prompts"
  on public.interview_prompts for insert with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can update prompts"
  on public.interview_prompts for update using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can delete prompts"
  on public.interview_prompts for delete using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- interview_prompt_followups
create policy "Account members can read prompt followups"
  on public.interview_prompt_followups for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write prompt followups"
  on public.interview_prompt_followups for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- interview_prompt_bias_checks
create policy "Account members can read prompt bias"
  on public.interview_prompt_bias_checks for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write prompt bias"
  on public.interview_prompt_bias_checks for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- interview_prompt_research_questions
create policy "Account members can read prompt↔rq"
  on public.interview_prompt_research_questions for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write prompt↔rq"
  on public.interview_prompt_research_questions for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- research_plan_data_sources
create policy "Account members can read plan sources"
  on public.research_plan_data_sources for select using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );
create policy "Account members can write plan sources"
  on public.research_plan_data_sources for all using (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  ) with check (
    auth.role() = 'service_role' or exists (
      select 1 from public.projects p join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid())
  );

-- Timestamps/User tracking triggers
CREATE TRIGGER set_project_research_plans_timestamp
    BEFORE INSERT OR UPDATE ON public.project_research_plans
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();
CREATE TRIGGER set_project_research_plans_user_tracking
    BEFORE INSERT OR UPDATE ON public.project_research_plans
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_decision_questions_timestamp
    BEFORE INSERT OR UPDATE ON public.decision_questions
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();
CREATE TRIGGER set_decision_questions_user_tracking
    BEFORE INSERT OR UPDATE ON public.decision_questions
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_research_questions_timestamp
    BEFORE INSERT OR UPDATE ON public.research_questions
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();
CREATE TRIGGER set_research_questions_user_tracking
    BEFORE INSERT OR UPDATE ON public.research_questions
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_interview_prompts_timestamp
    BEFORE INSERT OR UPDATE ON public.interview_prompts
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();
CREATE TRIGGER set_interview_prompts_user_tracking
    BEFORE INSERT OR UPDATE ON public.interview_prompts
    FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();
