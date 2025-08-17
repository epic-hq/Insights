-- Transcription pipeline job queues
-- This schema implements the queue-based architecture for processing interviews

-- Job status enum for all queue tables
create type job_status as enum ('pending','in_progress','done','error','retry');

-- Upload jobs queue - handles file uploads to AssemblyAI
create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  file_name text,
  file_type text,
  external_url text,         -- AssemblyAI upload URL after successful upload
  assemblyai_id text,        -- AssemblyAI transcript ID for webhook correlation
  custom_instructions text,  -- Custom instructions for analysis processing
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  status_detail text,        -- Granular status messages for UI
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Analysis jobs queue - handles BAML insight extraction  
create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  transcript_data jsonb not null,
  custom_instructions text,
  progress int default 0,    -- 0-100 for UI progress bar
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  status_detail text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies - inherit security from parent interview
alter table upload_jobs enable row level security;
alter table analysis_jobs enable row level security;

-- Upload jobs policies
create policy "Users can view upload jobs for their interviews" on upload_jobs
  for select using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can insert upload jobs for their interviews" on upload_jobs
  for insert with check (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can update upload jobs for their interviews" on upload_jobs
  for update using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

-- Analysis jobs policies  
create policy "Users can view analysis jobs for their interviews" on analysis_jobs
  for select using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can insert analysis jobs for their interviews" on analysis_jobs
  for insert with check (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can update analysis jobs for their interviews" on analysis_jobs
  for update using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

-- Triggers for updated_at timestamp
create trigger set_upload_jobs_timestamp 
  before insert or update on upload_jobs 
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_analysis_jobs_timestamp 
  before insert or update on analysis_jobs 
  for each row execute procedure accounts.trigger_set_timestamps();

-- Indexes for worker performance
create index idx_upload_jobs_status_created on upload_jobs(status, created_at);
create index idx_analysis_jobs_status_created on analysis_jobs(status, created_at);
create index idx_upload_jobs_assemblyai_id on upload_jobs(assemblyai_id);

-- Database webhooks will be configured via Supabase Dashboard to trigger edge functions
-- on INSERT/UPDATE events for instant processing

-- Service role grants for workers
grant select, insert, update on upload_jobs to service_role;
grant select, insert, update on analysis_jobs to service_role;