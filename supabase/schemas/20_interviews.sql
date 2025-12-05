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
	key_takeaways text,
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
	interview_type text, -- type of interview: interview, voice_memo, note, meeting
	lens_visibility text default 'account' check (lens_visibility in ('private', 'account')), -- controls lens application
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

COMMENT ON COLUMN public.interviews.key_takeaways IS 'AI-generated synopsis of conversation value, critical next steps, and future improvements (3-4 sentences)';

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
-- Note: analysis_jobs table was consolidated into interviews.conversation_analysis
CREATE OR REPLACE FUNCTION auto_cleanup_jobs_on_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    -- Ensure processing_metadata is set correctly
    NEW.processing_metadata = jsonb_set(COALESCE(NEW.processing_metadata, '{}'::jsonb), '{completed_at}', to_jsonb(NOW()::text));
    NEW.processing_metadata = jsonb_set(NEW.processing_metadata, '{current_step}', '"complete"');
    NEW.processing_metadata = jsonb_set(NEW.processing_metadata, '{progress}', '100');

    -- Ensure conversation_analysis is updated
    NEW.conversation_analysis = jsonb_set(COALESCE(NEW.conversation_analysis, '{}'::jsonb), '{current_step}', '"complete"');
    NEW.conversation_analysis = jsonb_set(NEW.conversation_analysis, '{progress}', '100');
    NEW.conversation_analysis = jsonb_set(NEW.conversation_analysis, '{status_detail}', '"Analysis complete"');
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
    -- Ensure conversation_analysis reflects error state
    NEW.conversation_analysis = jsonb_set(COALESCE(NEW.conversation_analysis, '{}'::jsonb), '{status_detail}', '"Interview processing failed"');
    NEW.conversation_analysis = jsonb_set(NEW.conversation_analysis, '{failed_at}', to_jsonb(NOW()::text));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mark_jobs_error ON interviews;
CREATE TRIGGER trigger_mark_jobs_error BEFORE UPDATE ON interviews FOR EACH ROW WHEN (NEW.status = 'error') EXECUTE FUNCTION auto_mark_jobs_error();

-- Auto-set voice memos and notes to private lens visibility
CREATE OR REPLACE FUNCTION set_default_lens_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.interview_type IN ('voice_memo', 'note', 'voice-memo') THEN
    NEW.lens_visibility := 'private';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS interview_lens_visibility_trigger ON public.interviews;
CREATE TRIGGER interview_lens_visibility_trigger
  BEFORE INSERT ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION set_default_lens_visibility();

COMMENT ON COLUMN public.interviews.lens_visibility IS 'Controls lens application: private = no lenses applied (voice memos, notes), account = all lenses applied';

-- Backwards compatibility view while we generalise nomenclature
create or replace view public.conversations as
select * from public.interviews;
