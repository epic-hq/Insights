
-- 8. Opportunities --------------------------------------------------------------
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
	project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  owner_id uuid references auth.users (id),
  kanban_status text check (kanban_status in ('Explore','Validate','Build')),
  related_insight_ids uuid[],
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_opportunities_account_id ON public.opportunities(account_id);
CREATE INDEX idx_opportunities_project_id ON public.opportunities(project_id);
CREATE INDEX idx_opportunities_title ON public.opportunities(title);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_opportunities_timestamp
    BEFORE INSERT OR UPDATE ON public.opportunities
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_opportunities_user_tracking
    BEFORE INSERT OR UPDATE ON public.opportunities
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

create index if not exists idx_opportunities_account_id on public.opportunities using btree (account_id) tablespace pg_default;

-- enable RLS on the table
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.opportunities
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.opportunities
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.opportunities
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.opportunities
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );