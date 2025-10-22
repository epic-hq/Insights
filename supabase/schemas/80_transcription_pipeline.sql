-- Transcription pipeline primitives
-- Centralizes storage for meeting bots, upload jobs, and AI analysis queues

-- Job status enum shared by all pipeline tables
create type job_status as enum ('pending','in_progress','done','error','retry');

-- Meeting bots (Recall.ai) - track bot lifecycle and downloaded assets
create table meeting_bots (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  bot_id text not null,
  region text not null,
  meeting_url text not null,
  bot_name text,
  status job_status not null default 'pending',
  status_detail text,
  recall_status text,
  last_status_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  raw_recording_key text,
  raw_recording_url text,
  processed_recording_key text,
  processed_recording_url text,
  transcript_download_url text,
  metadata jsonb,
  raw_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Upload jobs queue - handles ingestion and transcription orchestration
create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  file_name text,
  file_type text,
  external_url text,            -- External upload URL (AssemblyAI/Recall)
  assemblyai_id text,           -- AssemblyAI transcript ID for webhook correlation
  custom_instructions text,     -- Custom instructions for analysis processing
  source_provider text not null default 'assemblyai', -- 'assemblyai' | 'recall'
  meeting_bot_id uuid references meeting_bots(id) on delete set null,
  raw_media_key text,           -- R2 key for original media (audio/video)
  processed_media_key text,     -- R2 key for normalized audio (mp3)
  processed_media_url text,     -- Signed URL for processed media
  transcript_download_url text, -- Provider transcript download URL
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  status_detail text,           -- Granular status messages for UI
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Analysis jobs queue - handles BAML insight extraction  
create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  transcript_data jsonb not null,
  custom_instructions text,
  progress int default 0,       -- 0-100 for UI progress bar
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  status_detail text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS - policies mirror interview access via accounts.get_accounts_with_role()
alter table meeting_bots enable row level security;
alter table upload_jobs enable row level security;
alter table analysis_jobs enable row level security;

create policy "Users can view meeting bots" on meeting_bots
  for select using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can insert meeting bots" on meeting_bots
  for insert with check (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can update meeting bots" on meeting_bots
  for update using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

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

-- Timestamps
create trigger set_meeting_bots_timestamp 
  before insert or update on meeting_bots 
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_upload_jobs_timestamp 
  before insert or update on upload_jobs 
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_analysis_jobs_timestamp 
  before insert or update on analysis_jobs 
  for each row execute procedure accounts.trigger_set_timestamps();

-- Indexes for worker performance
create unique index idx_meeting_bots_bot_id on meeting_bots(bot_id);
create index idx_meeting_bots_interview on meeting_bots(interview_id);
create index idx_meeting_bots_status_updated on meeting_bots(status, updated_at);

create index idx_upload_jobs_status_created on upload_jobs(status, created_at);
create index idx_upload_jobs_assemblyai_id on upload_jobs(assemblyai_id);
create index idx_upload_jobs_meeting_bot on upload_jobs(meeting_bot_id);

create index idx_analysis_jobs_status_created on analysis_jobs(status, created_at);

-- Service role grants for workers
grant select, insert, update on meeting_bots to service_role;
grant select, insert, update on upload_jobs to service_role;
grant select, insert, update on analysis_jobs to service_role;
