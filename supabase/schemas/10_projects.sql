

-- Research Projects ----------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  name text not null,
	slug text,
  description text,
	status text default 'new',
	goal JSONB,
	questions JSONB,
	background JSONB,
	findings JSONB,
	constraint projects_account_id_slug_unique unique (account_id, slug),
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_projects_account_id ON public.projects(account_id);
CREATE INDEX idx_projects_slug ON public.projects(slug);

-- convert any character in the slug that's not a letter, number, or dash to a dash on insert/update for accounts
CREATE OR REPLACE FUNCTION public.slugify_project_name()
  RETURNS TRIGGER AS
$$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
    -- 1a) replace non-alnum/dash → dash
    -- 1b) collapse multiple dashes → one
    -- 1c) trim dashes off ends
    -- 1d) lowercase
    NEW.slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.name, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- trigger to slugify the project name
CREATE TRIGGER projects_slugify_project_slug
    BEFORE INSERT OR UPDATE
    ON public.projects
    FOR EACH ROW
EXECUTE FUNCTION public.slugify_project_name();


-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_projects_timestamp
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_projects_user_tracking
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

-- enable RLS on the table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table
-- Here are a few example policies that you may find useful when working with accounts

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.projects
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.projects
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.projects
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.projects
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );
