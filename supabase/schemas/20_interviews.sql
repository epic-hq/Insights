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

-- Interaction context: what kind of conversation this is (LLM-determined)
create type interaction_context as enum (
  'research',   -- User research, customer discovery, interviews
  'sales',      -- Sales calls, demos, deal discussions
  'support',    -- Support conversations, escalations, customer success
  'internal',   -- Team meetings, debriefs, planning
  'debrief',    -- Voice memos, call recaps, field notes, quick capture
  'personal'    -- Personal content, vlogs, non-business recordings
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
	thumbnail_url text, -- url to video thumbnail image
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
  -- LLM-determined interaction context
  interaction_context interaction_context, -- what kind of conversation (research, sales, support, internal, personal)
  context_confidence real, -- 0.0-1.0 confidence in classification
  context_reasoning text, -- brief explanation of why this context was chosen
  processing_metadata jsonb default '{}'::jsonb, -- processing state and progress tracking
  -- Survey/Ask link support (unified conversation architecture)
  draft_responses jsonb default '{}'::jsonb, -- in-progress survey answers saved in real-time
  research_link_id uuid, -- FK to Ask link config (added later via ALTER to avoid circular deps)
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	created_by uuid references auth.users (id),
	updated_by uuid references auth.users (id)
);

-- Backfill guard for environments created before key_takeaways existed
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS key_takeaways text;

COMMENT ON COLUMN public.interviews.key_takeaways IS 'AI-generated synopsis of conversation value, critical next steps, and future improvements (3-4 sentences)';
COMMENT ON COLUMN public.interviews.interviewer_id IS 'DEPRECATED: Use interview_people + people.person_type=internal for internal attendees';

COMMENT ON COLUMN public.interviews.media_url IS 'URL to the primary asset (audio/video/document) for this interview. For uploads this is typically an R2/Supabase Storage URL; for external imports it may be a remote URL.';
COMMENT ON COLUMN public.interviews.thumbnail_url IS 'Optional preview image URL for video content (or other rich media).';

COMMENT ON COLUMN public.interviews.source_type IS 'Where the content came from / ingestion path (free-text). Conventions: realtime_recording | audio_upload | video_upload | document_upload | transcript_paste | transcript_import.';
COMMENT ON COLUMN public.interviews.interview_type IS 'User-entered workflow classification for UI + filtering (free-text). Conventions: interview | voice_memo | note | meeting. Notes are often stored as interviews for a unified pipeline.';
COMMENT ON COLUMN public.interviews.media_type IS 'User-entered semantic content category (free-text). Conventions: interview | focus_group | customer_call | user_testing | voice_memo | meeting. Distinct from interaction_context (LLM) and from file_extension (format).';

COMMENT ON COLUMN public.interviews.file_extension IS 'File format of the uploaded asset (mp3, mp4, wav, m4a, pdf, csv, md, etc.). Prefer lowercase without leading dot.';
COMMENT ON COLUMN public.interviews.original_filename IS 'Original filename from the user upload (for display/debugging).';

-- Indexes for performance based on common queries
CREATE INDEX idx_interviews_account_id ON public.interviews(account_id);
CREATE INDEX idx_interviews_project_id ON public.interviews(project_id);
CREATE INDEX idx_interviews_date ON public.interviews(interview_date);
CREATE INDEX idx_interviews_title ON public.interviews(title);
CREATE INDEX idx_interviews_interaction_context ON public.interviews(interaction_context);

COMMENT ON COLUMN public.interviews.interaction_context IS 'LLM-determined content type: research, sales, support, internal, or personal. Used for automatic lens selection.';
COMMENT ON COLUMN public.interviews.context_confidence IS 'LLM confidence (0.0-1.0) in the interaction_context classification';
COMMENT ON COLUMN public.interviews.context_reasoning IS 'LLM explanation for why this interaction_context was chosen';

-- Survey/Ask link support comments
COMMENT ON COLUMN public.interviews.draft_responses IS 'In-progress survey/chat answers saved in real-time. Cleared when finalized to transcript_formatted. Structure: { "question_id": "answer_text", ... }';
COMMENT ON COLUMN public.interviews.research_link_id IS 'FK to research_links for Ask link responses. Null for traditional interviews/uploads.';

-- Indexes for Ask link lookups
CREATE UNIQUE INDEX IF NOT EXISTS uniq_interviews_research_link_person
  ON public.interviews(research_link_id, person_id)
  WHERE research_link_id IS NOT NULL AND person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_research_link_id
  ON public.interviews(research_link_id)
  WHERE research_link_id IS NOT NULL;

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

-- Note: All content types now default to 'account' lens_visibility (analyze everything)
-- Users can manually set to 'private' to exclude from lens processing
-- Removed auto-private trigger as of Dec 2024 per "analyze everything by default" philosophy

COMMENT ON COLUMN public.interviews.lens_visibility IS 'Controls lens application: private = excluded from lenses, account = lenses applied (default)';

-- Backwards compatibility view while we generalise nomenclature
create or replace view public.conversations as
select * from public.interviews;
