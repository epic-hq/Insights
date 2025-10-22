-- Recall meeting bots integration

-- Create meeting_bots table to track Recall.ai runs per interview
create table if not exists public.meeting_bots (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  bot_id text not null,
  region text not null,
  meeting_url text not null,
  bot_name text,
  status public.job_status not null default 'pending',
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

alter table public.meeting_bots enable row level security;

create unique index if not exists idx_meeting_bots_bot_id on public.meeting_bots(bot_id);
create index if not exists idx_meeting_bots_interview on public.meeting_bots(interview_id);
create index if not exists idx_meeting_bots_status_updated on public.meeting_bots(status, updated_at);

create policy if not exists "Users can view meeting bots" on public.meeting_bots
  for select using (
    interview_id in (
      select id from public.interviews
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy if not exists "Users can insert meeting bots" on public.meeting_bots
  for insert with check (
    interview_id in (
      select id from public.interviews
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy if not exists "Users can update meeting bots" on public.meeting_bots
  for update using (
    interview_id in (
      select id from public.interviews
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create trigger if not exists set_meeting_bots_timestamp
  before insert or update on public.meeting_bots
  for each row execute function accounts.trigger_set_timestamps();

grant select, insert, update on public.meeting_bots to service_role;

-- Extend upload_jobs with Recall linkage and media metadata
alter table public.upload_jobs
  add column if not exists source_provider text not null default 'assemblyai',
  add column if not exists meeting_bot_id uuid references public.meeting_bots(id) on delete set null,
  add column if not exists raw_media_key text,
  add column if not exists processed_media_key text,
  add column if not exists processed_media_url text,
  add column if not exists transcript_download_url text;

create index if not exists idx_upload_jobs_meeting_bot on public.upload_jobs(meeting_bot_id);

-- Interviews now store both raw and processed media URLs
alter table public.interviews
  add column if not exists raw_media_url text,
  add column if not exists processed_media_url text;
