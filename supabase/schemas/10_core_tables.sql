
-- ** Core Tables needed by App Logic
-- users and accounts in 'accounts'
-- separate components: def, index, triggers, RLS
-- account_settings as template

create extension if not exists vector;

-- People
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  name text,
  name_hash text generated always as (lower(name)) stored,
  description text,
  segment text,
	image_url text,
  age int,
  gender text,
  income int,
  education text,
  occupation text,
	languages text[],
  location text,
  contact_info jsonb,
  preferences text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_people_account_id ON public.people(account_id);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_people_timestamp
    BEFORE INSERT OR UPDATE ON public.people
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_people_user_tracking
    BEFORE INSERT OR UPDATE ON public.people
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

create index if not exists idx_people_account_id on public.people using btree (account_id) tablespace pg_default;

-- Unique index for deduplication by normalized name within account
create unique index if not exists uniq_people_account_namehash
  on public.people (account_id, name_hash);

-- enable RLS on the table
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table
-- Here are a few example policies that you may find useful when working with accounts

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.people
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.people
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.people
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.people
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );


-- Personas -------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  name text not null,
  description text,
	image_url text,
  percentage numeric,
  color_hex text,
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_personas_account_id ON public.personas(account_id);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_personas_timestamp
    BEFORE INSERT OR UPDATE ON public.personas
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_personas_user_tracking
    BEFORE INSERT OR UPDATE ON public.personas
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

create index if not exists idx_personas_account_id on public.personas using btree (account_id) tablespace pg_default;

-- enable RLS on the table
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table
-- Here are a few example policies that you may find useful when working with accounts

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.personas
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.personas
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.personas
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );


----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.personas
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );


-- 9. Tags (global) --------------------------------------------------------------
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  tag text NOT NULL,
	account_id uuid not null references accounts.accounts (id) on delete cascade,
	term text,
	definition text,
	set_name text,
	embedding vector(1536),
	updated_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
  constraint tags_account_tag_unique unique (account_id, tag)
 );


-- Indexes for performance based on common queries
CREATE INDEX idx_tags_account_id ON public.tags(account_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can select"
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert"
  ON public.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can update"
  ON public.tags
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account owners can delete"
  ON public.tags
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));


-- Views ---------------------------------------------------------------------
-- FUTURE think this out better
-- Materialized view to count insights per theme for treemap dashboard
-- create materialized view if not exists theme_counts_mv as
-- select t.id as theme_id,
--        t.name,
--        count(*) as insight_count
-- from themes t
-- left join insights i on i.category = t.name and i.account_id = t.account_id
-- group by t.id, t.name;

-- -----------------------------------------------------------------------------



-- End of declarative schema
