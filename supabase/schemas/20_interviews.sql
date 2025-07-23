-- Interviews -----------------------------------------------------------------
create type interview_status as enum (
  'draft',
  'scheduled',
  'uploaded',
  'transcribed',
  'processing',
  'ready',
  'tagged',
  'archived'
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
	media_url text,
	transcript text,
	transcript_formatted jsonb,
	high_impact_themes text[],
	open_questions_and_next_steps text,
	observations_and_notes text,
  duration_min int,
  status interview_status not null default 'draft',
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
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
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.interviews
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.interviews
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.interviews
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.interviews
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );
