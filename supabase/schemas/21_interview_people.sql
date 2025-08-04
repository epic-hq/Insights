-- Interview <-> People junction table ---------------------------------------
-- Allows an interview to have many participants and a person to appear in
-- multiple interviews. Mirrors accounts-trigger, timestamp and RLS patterns
-- used elsewhere in the project.

set search_path = public;

create table if not exists interview_people (
  interview_id uuid not null references public.interviews (id) on delete cascade,
  person_id    uuid not null references public.people     (id) on delete cascade,
	project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role         text, -- participant / moderator / observer etc.
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  updated_by   uuid references auth.users(id),
  primary key (interview_id, person_id)
);

-- Indexes for performance ----------------------------------------------------
create index if not exists idx_interview_people_interview_id on public.interview_people (interview_id);
create index if not exists idx_interview_people_person_id   on public.interview_people (person_id);

-- Timestamp + user tracking triggers ----------------------------------------
create trigger set_interview_people_timestamp
    before insert or update on public.interview_people
    for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_interview_people_user_tracking
    before insert or update on public.interview_people
    for each row execute procedure accounts.trigger_set_user_tracking();

-- Enable RLS -----------------------------------------------------------------
alter table public.interview_people enable row level security;

-- Policies -------------------------------------------------------------------
-- Account members can SELECT their interview participants
create policy "Account members can select" on public.interview_people
    for select to authenticated
    using (
      interview_id in (
        select id from public.interviews
        where account_id in (select accounts.get_accounts_with_role())
      )
    );

-- Account members can INSERT when the interview is theirs
create policy "Account members can insert" on public.interview_people
    for insert to authenticated
    with check (
      interview_id in (
        select id from public.interviews
        where account_id in (select accounts.get_accounts_with_role())
      )
    );

-- Account members can UPDATE when the interview is theirs
create policy "Account members can update" on public.interview_people
    for update to authenticated
    using (
      interview_id in (
        select id from public.interviews
        where account_id in (select accounts.get_accounts_with_role())
      )
    );

-- Owners can DELETE ----------------------------------------------------------
create policy "Account owners can delete" on public.interview_people
    for delete to authenticated
    using (
      interview_id in (
        select id from public.interviews
        where account_id in (select accounts.get_accounts_with_role('owner'))
      )
    );
