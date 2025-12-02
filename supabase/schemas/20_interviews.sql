-- Interviews -----------------------------------------------------------------
create type interview_status as enum (
  'draft',
  'scheduled',
  'uploading',
  'uploaded',
  'transcribing',
  'transcribed',
  'processing',
  'ready',
  'tagged',
  'archived',
  'error'
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  title text,
  interview_date date,
  interviewer_id uuid references auth.users (id),
  participant_pseudonym text,
  segment text,
	media_url text, -- url to the media file
	media_type text, -- type of content: interview, focus-group, customer-call, user-testing
	transcript text,
	transcript_formatted jsonb,
	conversation_analysis jsonb,
	high_impact_themes text[],
	relevant_answers text[],
	open_questions_and_next_steps text,
	observations_and_notes text,
	source_type text, -- source of the content: realtime_recording, audio_upload, video_upload, document, transcript
	file_extension text, -- file extension (mp3, mp4, pdf, csv, md, etc.)
	original_filename text, -- original filename when uploaded
	person_id uuid references people (id) on delete set null, -- link to person if attached
  duration_sec int,
  status interview_status not null default 'draft',
  processing_metadata jsonb default '{}'::jsonb, -- processing state and progress tracking
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	created_by uuid references auth.users (id),
	updated_by uuid references auth.users (id)
);

-- Indexes for performance based on common queries
CREATE INDEX idx_interviews_account_id ON public.interviews(account_id);
CREATE INDEX idx_interviews_project_id ON public.interviews(project_id);
CREATE INDEX idx_interviews_date ON public.interviews(interview_date);
CREATE INDEX idx_interviews_title ON public.interviews(title);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_interviews_timestamp
    BEFORE INSERT OR UPDATE ON public.interviews
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_interviews_user_tracking
    BEFORE INSERT OR UPDATE ON public.interviews
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

-- enable RLS on the table
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-------------
-- Account members can read interviews in their accounts
create policy "Account members can select interviews" on public.interviews
    for select
    to authenticated
    using (account_id in (select accounts.get_accounts_with_role()));

----------------
-- Account members can create interviews for their accounts
----------------
create policy "Account members can insert interviews" on public.interviews
    for insert
    to authenticated
    with check (account_id in (select accounts.get_accounts_with_role()));

---------------
-- Account members can update interviews in their accounts
---------------
create policy "Account members can update interviews" on public.interviews
    for update
    to authenticated
    using (account_id in (select accounts.get_accounts_with_role()));

----------------
-- Account owners can delete interviews in their accounts
----------------
create policy "Account owners can delete interviews" on public.interviews
    for delete
    to authenticated
    using (account_id in (select accounts.get_accounts_with_role('owner')));

-- Index for querying stuck interviews
CREATE INDEX IF NOT EXISTS idx_interviews_status_processing ON public.interviews(status) WHERE status = 'processing';

-- Auto-cleanup triggers for stuck jobs
CREATE OR REPLACE FUNCTION auto_cleanup_jobs_on_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    -- Cleanup analysis_jobs (workflow state storage)
    UPDATE analysis_jobs SET status = 'done', status_detail = 'Auto-completed: interview is ready', current_step = 'complete', updated_at = NOW()
    WHERE interview_id = NEW.id AND status IN ('pending', 'in_progress');

    -- Ensure processing_metadata is set correctly
    NEW.processing_metadata = jsonb_set(COALESCE(NEW.processing_metadata, '{}'::jsonb), '{completed_at}', to_jsonb(NOW()::text));
    NEW.processing_metadata = jsonb_set(NEW.processing_metadata, '{current_step}', '"complete"');
    NEW.processing_metadata = jsonb_set(NEW.processing_metadata, '{progress}', '100');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_jobs_on_ready ON interviews;
CREATE TRIGGER trigger_cleanup_jobs_on_ready BEFORE UPDATE ON interviews FOR EACH ROW WHEN (NEW.status = 'ready') EXECUTE FUNCTION auto_cleanup_jobs_on_ready();

CREATE OR REPLACE FUNCTION auto_mark_jobs_error()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'error' AND (OLD.status IS NULL OR OLD.status != 'error') THEN
    -- Mark analysis_jobs (workflow state storage) as error
    UPDATE analysis_jobs SET status = 'error', status_detail = 'Interview processing failed', updated_at = NOW()
    WHERE interview_id = NEW.id AND status IN ('pending', 'in_progress');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mark_jobs_error ON interviews;
CREATE TRIGGER trigger_mark_jobs_error BEFORE UPDATE ON interviews FOR EACH ROW WHEN (NEW.status = 'error') EXECUTE FUNCTION auto_mark_jobs_error();

-- Backwards compatibility view while we generalise nomenclature
create or replace view public.conversations as
select * from public.interviews;
