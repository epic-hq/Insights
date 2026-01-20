
-- ** Core Tables needed by App Logic
-- users and accounts in 'accounts'
-- separate components: def, index, triggers, RLS
-- account_settings as template

create extension if not exists vector;

-- Organizations -------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  legal_name text,
  description text,
  industry text,
  sub_industry text,
  company_type text,
  size_range text,
  employee_count int,
  annual_revenue numeric,
  market_cap numeric,
  funding_stage text,
  total_funding numeric,
  phone text,
  email text,
  website_url text,
  linkedin_url text,
  twitter_url text,
  domain text,
  headquarters_location text,
  billing_address jsonb,
  shipping_address jsonb,
  parent_organization_id uuid references public.organizations(id) on delete set null,
  primary_contact_id uuid, -- Will reference people(id) after people table is created
  lifecycle_stage text,
  timezone text,
  crm_external_id text,
  tags text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- People
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  person_type text,
  firstname text,
  lastname text,
  name text generated always as (
    case
      when firstname is not null and lastname is not null then trim(firstname || ' ' || lastname)
      when firstname is not null then trim(firstname)
      when lastname is not null then trim(lastname)
      else null
    end
  ) stored,
  name_hash text generated always as (
    lower(
      case
        when firstname is not null and lastname is not null then trim(firstname || ' ' || lastname)
        when firstname is not null then trim(firstname)
        when lastname is not null then trim(lastname)
        else ''
      end
    )
  ) stored,
  description text,
  role text,
  title text,
  industry text,
  company text not null default '',
  segment text,
  image_url text,
  age int,
  gender text,
  income int,
  education text,
  occupation text,
  languages text[],
  location text,
  primary_email text,
  primary_phone text,
  linkedin_url text,
  website_url text,
  contact_info jsonb default '{}'::jsonb,
  preferences text,
  lifecycle_stage text,
  timezone text,
  pronouns text,
  default_organization_id uuid references public.organizations(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_people_account_id ON public.people(account_id);
CREATE INDEX IF NOT EXISTS idx_people_user_id ON public.people(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_account_user
  ON public.people (account_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_default_organization
    ON public.people (default_organization_id)
    WHERE default_organization_id IS NOT NULL;

-- Project scoping support
CREATE INDEX IF NOT EXISTS idx_people_account_project_created
    ON public.people (account_id, project_id, created_at);

COMMENT ON COLUMN public.people.person_type IS 'Type of person: internal, external, partner, unknown';
COMMENT ON COLUMN public.people.user_id IS 'Auth user ID for internal people';

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

-- Unique index for deduplication by normalized name+company+email within account
-- Allows same name at same company if emails differ (different people can have same name)
-- Expression index for constraint enforcement (handles null normalization)
create unique index if not exists uniq_people_account_name_company_email
  on public.people (
    account_id,
    name_hash,
    COALESCE(lower(company), ''),
    COALESCE(lower(primary_email), '')
  );

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
-- Account members can delete people records
----------------
create policy "Account members can delete" on public.people
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

create trigger set_organizations_timestamp
    before insert or update on public.organizations
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_organizations_user_tracking
    before insert or update on public.organizations
    for each row
execute procedure accounts.trigger_set_user_tracking();

alter table public.organizations enable row level security;

create policy "Account members can select" on public.organizations
    for select
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account members can insert" on public.organizations
    for insert
    to authenticated
    with check (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account members can update" on public.organizations
    for update
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account owners can delete" on public.organizations
    for delete
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role('owner'))
    );

-- Add foreign key constraint for organizations.primary_contact_id now that people table exists
alter table public.organizations
    add constraint organizations_primary_contact_id_fkey
        foreign key (primary_contact_id) references public.people(id) on delete set null;

create index if not exists idx_organizations_account_id on public.organizations(account_id);
create index if not exists idx_organizations_project_id on public.organizations(project_id);
create index if not exists idx_organizations_primary_contact on public.organizations(primary_contact_id)
    where primary_contact_id is not null;
create index if not exists idx_organizations_parent on public.organizations(parent_organization_id)
    where parent_organization_id is not null;
create unique index if not exists uniq_organizations_account_lower_name
  on public.organizations (account_id, lower(name));


-- People <> Organizations Junction -------------------------------------------------
create table if not exists people_organizations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text,
  relationship_status text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_organizations_person_org_unique unique (person_id, organization_id)
);

create index if not exists idx_people_organizations_account_id on public.people_organizations(account_id);
create index if not exists idx_people_organizations_project_id on public.people_organizations(project_id);
create index if not exists idx_people_organizations_person_id on public.people_organizations(person_id);
create index if not exists idx_people_organizations_org_id on public.people_organizations(organization_id);

create trigger set_people_organizations_timestamp
    before insert or update on public.people_organizations
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_people_organizations_user_tracking
    before insert or update on public.people_organizations
    for each row
execute procedure accounts.trigger_set_user_tracking();

alter table public.people_organizations enable row level security;

create policy "Account members can select" on public.people_organizations
    for select
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account members can insert" on public.people_organizations
    for insert
    to authenticated
    with check (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account members can update" on public.people_organizations
    for update
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy "Account owners can delete" on public.people_organizations
    for delete
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role('owner'))
    );


-- Facet Catalog --------------------------------------------------------------
create table if not exists facet_kind_global (
  id serial primary key,
  slug text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TRIGGER set_facet_kind_global_timestamp
    BEFORE INSERT OR UPDATE ON public.facet_kind_global
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_facet_kind_global_user_tracking
    BEFORE INSERT OR UPDATE ON public.facet_kind_global
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_kind_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can select"
  ON public.facet_kind_global
  FOR SELECT
  TO authenticated
  USING (true);


create table if not exists facet_global (
  id serial primary key,
  kind_id int not null references facet_kind_global(id) on delete cascade,
  slug text not null unique,
  label text not null,
  synonyms text[] default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_facet_global_kind ON public.facet_global(kind_id);

CREATE TRIGGER set_facet_global_timestamp
    BEFORE INSERT OR UPDATE ON public.facet_global
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_facet_global_user_tracking
    BEFORE INSERT OR UPDATE ON public.facet_global
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read"
  ON public.facet_global
  FOR SELECT
  TO authenticated
  USING (true);


create table if not exists facet_account (
  id serial primary key,
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  kind_id int not null references facet_kind_global(id) on delete restrict,
  global_facet_id int references facet_global(id) on delete set null,
  slug text not null,
  label text not null,
  synonyms text[] default '{}',
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facet_account_unique_slug unique (account_id, kind_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_facet_account_account ON public.facet_account(account_id);
CREATE INDEX IF NOT EXISTS idx_facet_account_kind ON public.facet_account(kind_id);

CREATE TRIGGER set_facet_account_timestamp
    BEFORE INSERT OR UPDATE ON public.facet_account
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_facet_account_user_tracking
    BEFORE INSERT OR UPDATE ON public.facet_account
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_account ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can select"
  ON public.facet_account
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert"
  ON public.facet_account
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can update"
  ON public.facet_account
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account owners can delete"
  ON public.facet_account
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));


create table if not exists person_facet (
  person_id uuid not null references people(id) on delete cascade,
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  facet_account_id int not null references facet_account(id) on delete cascade,
  source text not null check (source in ('interview','survey','telemetry','inferred','manual','document')),
  evidence_id uuid,
  confidence numeric default 0.8 check (confidence >= 0 and confidence <= 1),
  noted_at timestamptz default now(),
  embedding vector(1536), -- Semantic embedding for clustering similar facets
  embedding_model text default 'text-embedding-3-small',
  embedding_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (person_id, facet_account_id)
);

CREATE INDEX IF NOT EXISTS idx_person_facet_account ON public.person_facet(account_id);
CREATE INDEX IF NOT EXISTS idx_person_facet_project ON public.person_facet(project_id);
CREATE INDEX IF NOT EXISTS idx_person_facet_facet_account ON public.person_facet(facet_account_id);

-- HNSW index for semantic similarity search on person facet embeddings
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where tablename = 'person_facet' and indexname = 'person_facet_embedding_idx'
  ) then
    create index person_facet_embedding_idx on public.person_facet
    using hnsw (embedding vector_cosine_ops);
  end if;
end $$;

CREATE TRIGGER set_person_facet_timestamp
    BEFORE INSERT OR UPDATE ON public.person_facet
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_person_facet_user_tracking
    BEFORE INSERT OR UPDATE ON public.person_facet
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.person_facet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can select"
  ON public.person_facet
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert"
  ON public.person_facet
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account members can update"
  ON public.person_facet
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account owners can delete"
  ON public.person_facet
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));


-- Per-person facet lens summaries (1-2 sentence takeaways per kind)
create table if not exists person_facet_summaries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  kind_slug text not null,
  summary text not null,
  supporting_evidence jsonb,
  model_version text,
  input_hash text,
  created_at timestamptz not null default now(),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, kind_slug)
);

create index if not exists idx_person_facet_summaries_person on public.person_facet_summaries(person_id);
create index if not exists idx_person_facet_summaries_project on public.person_facet_summaries(project_id);

CREATE TRIGGER set_person_facet_summaries_timestamp
    BEFORE INSERT OR UPDATE ON public.person_facet_summaries
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_person_facet_summaries_user_tracking
    BEFORE INSERT OR UPDATE ON public.person_facet_summaries
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.person_facet_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can select"
  ON public.person_facet_summaries
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert"
  ON public.person_facet_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account members can update"
  ON public.person_facet_summaries
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account owners can delete"
  ON public.person_facet_summaries
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));


create table if not exists person_scale (
  person_id uuid not null references people(id) on delete cascade,
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  kind_slug text not null,
  score numeric not null check (score >= 0 and score <= 1),
  band text,
  source text not null check (source in ('interview','survey','telemetry','inferred','manual')),
  evidence_id uuid,
  confidence numeric default 0.8 check (confidence >= 0 and confidence <= 1),
  noted_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (person_id, kind_slug)
);

CREATE INDEX IF NOT EXISTS idx_person_scale_account ON public.person_scale(account_id);
CREATE INDEX IF NOT EXISTS idx_person_scale_project ON public.person_scale(project_id);

CREATE TRIGGER set_person_scale_timestamp
    BEFORE INSERT OR UPDATE ON public.person_scale
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_person_scale_user_tracking
    BEFORE INSERT OR UPDATE ON public.person_scale
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.person_scale ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can select"
  ON public.person_scale
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert"
  ON public.person_scale
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account members can update"
  ON public.person_scale
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account owners can delete"
  ON public.person_scale
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));


-- Personas -------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  name text not null,
  description text,
  image_url text, -- generate by AI caricature
  percentage numeric,
  color text, -- canonical going forward
  color_hex text, -- legacy compatibility; keep until full migration
  kind text check (kind in ('core', 'provisional', 'contrast')) default 'core',
  tags text[],
  -- PersonaCompareBoard fields
  goals text[],
  pains text[], -- renamed from frustrations
  differentiators text[],
  behaviors text[], -- renamed from behavior (was single text)
  roles text[], -- converted from single role text
  spectra1d jsonb, -- 1D behavioral spectra: Record<string, number>
  spectra2d jsonb, -- 2D behavioral positioning: Record<string, {x: number, y: number}>
  -- demographics, psychographics, and behavior generated by BAML
  role text, -- legacy field, use roles[] instead
  segment text,
  age text,
  gender text,
  income text,
  education text,
  occupation text,
	languages text,
  location text,
  preferences text,
  primary_goal text, -- legacy field, use goals[] instead
	secondary_goals text[], -- legacy field, use goals[] instead
  key_tasks text[], -- JTBD
  frustrations text[], -- legacy field, use pains[] instead
  motivations text[],
  tech_comfort_level text,
  tools_used text[],
	frequency_of_use text,
	frequency_of_purchase text,
	learning_style text,
	values text[],
  quotes text[],
  sources text[],
	project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_personas_account_id ON public.personas(account_id);

-- Project scoping support
CREATE INDEX IF NOT EXISTS idx_personas_account_project_created
    ON public.personas (account_id, project_id, created_at);

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
	project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
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
