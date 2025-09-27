

-- Research Projects ----------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  name text not null,
	slug text,
  description text,
	status text default 'new',
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



-- Projects_Sections ----------------------------------------------------------
-- PROJECT SECTIONS: flexible, markdown-first sections per project
-- Assumes:
--   - projects(id uuid, account_id uuid, ...)
--   - accounts_users(account_id uuid, user_id uuid)
--   - Supabase auth functions: auth.uid(), auth.role()

-- 1) Lookup table for allowed kinds (flexible; add rows anytime)
create table if not exists public.project_section_kinds (
  id text primary key -- e.g., 'goal','questions','findings','background'
);

insert into public.project_section_kinds (id) values
  ('goal'), ('questions'), ('findings'), ('background'), ('target_market'), ('risks'), ('methodology'), ('assumptions'), ('recommendations'), ('unknowns'), ('custom_instructions'),('target_roles'),('target_orgs'),('research_goal'),('research_goal_details'),('decision_questions'),('research_questions'),('interview_prompts'),('settings')
  on conflict (id) do nothing;

-- 2) Sections table (Markdown content + optional JSONB meta)
create table if not exists public.project_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null references public.project_section_kinds(id) on update cascade,
  content_md text not null,
  meta jsonb,
  position int,
  content_tsv tsvector generated always as (
    to_tsvector('english', coalesce(content_md, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
	created_by uuid references auth.users(id) on delete cascade,
	updated_by uuid references auth.users(id) on delete cascade
);

-- 3) Updated-at trigger (optional but useful)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

CREATE TRIGGER set_project_sections_user_tracking
    BEFORE INSERT OR UPDATE ON public.project_sections
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

drop trigger if exists trg_project_sections_updated_at on public.project_sections;
create trigger trg_project_sections_updated_at
before update on public.project_sections
for each row execute function public.set_updated_at();

-- 4) Indexes tuned for your queries
create unique index if not exists idx_project_sections_project_id_kind_unique
  on public.project_sections (project_id, kind);
create index if not exists idx_project_sections_project_id_kind_key
  on public.project_sections (project_id, kind);

-- Latest-per-kind within a project (accordion preview)
create index if not exists idx_project_sections_project_kind_created_at
  on public.project_sections (project_id, kind, created_at desc);

-- Ordered list by position (NULLS LAST) then recency
create index if not exists idx_project_sections_project_position_created_at
  on public.project_sections (project_id, coalesce(position, 2147483647), created_at desc);

-- Full‑text search on markdown
create index if not exists idx_project_sections_content_tsv
  on public.project_sections using gin (content_tsv);

-- Optional: enforce at most one *active* goal per project (if desired)
-- create unique index uniq_project_single_goal_active
--   on public.project_sections(project_id)
--   where kind = 'goal' and coalesce(nullif(meta->>'archived',''), 'false')::boolean = false;

-- 5) RLS: enable and lock down by project.account_id membership
alter table public.project_sections enable row level security;
alter table public.project_section_kinds enable row level security;

-- Read kinds: anyone authenticated can read (or make it public if needed)
create policy "Read kinds"
  on public.project_section_kinds
  for select
  using (true);

-- Optionally restrict write on kinds to service role only
create policy "Admin write kinds"
  on public.project_section_kinds
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Helper predicate: membership in the owning account of the project
-- (Uses a lateral EXISTS against projects -> accounts_users)
-- SELECT
create policy "Account members can read sections"
  on public.project_sections
  for select
  using (
    auth.role() = 'service_role' or exists (
      select 1
      from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- INSERT
create policy "Account members can insert sections"
  on public.project_sections
  for insert
  with check (
    auth.role() = 'service_role' or exists (
      select 1
      from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- UPDATE
create policy "Account members can update sections"
  on public.project_sections
  for update
  using (
    auth.role() = 'service_role' or exists (
      select 1
      from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  )
  with check (
    auth.role() = 'service_role' or exists (
      select 1
      from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- DELETE
create policy "Account members can delete sections"
  on public.project_sections
  for delete
  using (
    auth.role() = 'service_role' or exists (
      select 1
      from public.projects p
      join accounts.account_user au on au.account_id = p.account_id
      where p.id = project_id and au.user_id = auth.uid()
    )
  );

-- 6) (Optional) Convenience view: latest section per kind for a project
create or replace view public.project_sections_latest with (security_invoker = on) as
 SELECT DISTINCT ON (project_id, kind) id,
    project_id,
    kind,
    content_md,
    meta,
    "position",
    content_tsv,
    created_at,
    updated_at
   FROM project_sections
  ORDER BY project_id, kind, created_at DESC;
comment on view public.project_sections_latest is 'Latest section per kind (by created_at desc) for each project.';

GRANT SELECT ON public.project_sections_latest TO authenticated;

-- Queries you’ll want
-- Latest per kind (powers your accordion preview):

-- select distinct on (kind) *
-- from project_sections
-- where project_id = $1
-- order by kind, created_at desc;

-- All sections grouped (for “Show all”):
-- select * from project_sections
-- where project_id = $1
-- order by kind, coalesce(position, 1e9), created_at desc;