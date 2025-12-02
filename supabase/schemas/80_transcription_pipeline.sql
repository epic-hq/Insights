-- Workflow state storage for interview processing
-- Processing progress and status are tracked in interviews.processing_metadata
-- This table only stores intermediate workflow data needed for resumption

-- Job status enum (kept for backwards compatibility)
create type job_status as enum ('pending','in_progress','done','error','retry');

-- Analysis jobs - stores workflow state for Trigger.dev v2 orchestrator
-- Progress tracking moved to interviews.processing_metadata
create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  transcript_data jsonb not null,
  custom_instructions text,

  -- Legacy status fields (maintained by database triggers for compatibility)
  progress int default 0,
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  status_detail text,
  trigger_run_id text,

  -- V2 modular workflow state (primary purpose of this table)
  workflow_state jsonb,      -- Full workflow state for resume capability (evidenceUnits, transcriptData, etc.)
  completed_steps text[],    -- Array of completed step names
  current_step text,         -- Current workflow step
  evidence_count int,        -- Number of evidence units extracted

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies - inherit security from parent interview
alter table analysis_jobs enable row level security;

-- Analysis jobs policies  
create policy "Users can view analysis jobs for their interviews" on analysis_jobs
  for select using (
    interview_id in (
      select id from interviews
      where account_id in (
        select account_id from accounts.account_user where user_id = auth.uid()
      )
    )
  );

create policy "Users can insert analysis jobs for their interviews" on analysis_jobs
  for insert with check (
    interview_id in (
      select id from interviews
      where account_id in (
        select account_id from accounts.account_user where user_id = auth.uid()
      )
    )
  );

create policy "Users can update analysis jobs for their interviews" on analysis_jobs
  for update using (
    interview_id in (
      select id from interviews
      where account_id in (
        select account_id from accounts.account_user where user_id = auth.uid()
      )
    )
  );

-- Triggers for updated_at timestamp
create trigger set_analysis_jobs_timestamp
  before insert or update on analysis_jobs
  for each row execute procedure accounts.trigger_set_timestamps();

-- Indexes for workflow state queries
create index idx_analysis_jobs_status_created on analysis_jobs(status, created_at);
create index idx_analysis_jobs_trigger_run on analysis_jobs(trigger_run_id);
create index idx_analysis_jobs_interview on analysis_jobs(interview_id);

-- Service role grants for Trigger.dev tasks
grant select, insert, update on analysis_jobs to service_role;
