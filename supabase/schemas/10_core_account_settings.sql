-- Ensure accounts schema exists first
CREATE SCHEMA IF NOT EXISTS accounts;

create table
  public.account_settings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  title text,
  role text,
  onboarding_completed boolean not null default false,
  app_activity jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
	current_account_id uuid,
	current_project_id uuid,
    -- timestamps are useful for auditing
    -- accounts has some convenience functions defined below for automatically handling these
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    -- Useful for tracking who made changes to a record
    -- accounts has some convenience functions defined below for automatically handling these
    updated_by uuid references auth.users(id),
    created_by uuid references auth.users(id)
  );

-- Indexes for performance based on common queries
CREATE INDEX idx_account_settings_account_id ON public.account_settings(account_id);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_account_settings_timestamp
    BEFORE INSERT OR UPDATE ON public.account_settings
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_account_settings_user_tracking
    BEFORE INSERT OR UPDATE ON public.account_settings
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

create index if not exists idx_account_settings_account_id on public.account_settings using btree (account_id) tablespace pg_default;

-- enable RLS on the table
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table
-- Here are a few example policies that you may find useful when working with accounts

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.account_settings
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.account_settings
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.account_settings
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.account_settings
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );

drop function public.set_current_account_id(uuid);

CREATE OR REPLACE FUNCTION public.set_current_account_id(new_account_id uuid)
 RETURNS public.account_settings
 LANGUAGE plpgsql
AS $function$
declare
  updated_row public.account_settings;
begin
  update public.account_settings
  set current_account_id = new_account_id
  where user_id = auth.uid()
  returning * into updated_row;
  return updated_row;
end;
$function$
;

grant execute on function public.set_current_account_id(uuid) to authenticated, service_role;
