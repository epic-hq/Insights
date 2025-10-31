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
  duration_sec int,
  status interview_status not null default 'draft',
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

-- Backwards compatibility view while we generalise nomenclature
create or replace view public.conversations as
select * from public.interviews;
