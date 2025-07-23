
-- ** Core Tables needed by App Logic
-- users and accounts in 'accounts'
-- separate components: def, index, triggers, RLS
-- account_settings as template

create extension if not exists vector;

create table if not exists account_settings (
  account_id uuid primary key references accounts.accounts (id) on delete cascade,
  title text,
  role text,
  onboarding_completed boolean not null default false,
  app_activity jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- People
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  name text,
  description text,
  segment text,
  persona text,
  age int,
  gender text,
  income int,
  education text,
  occupation text,
  location text,
  contact_info jsonb,
  preferences text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Research Projects ----------------------------------------------------------
create table if not exists research_projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  title text not null,
  description text,
	status text,
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);


-- Personas -------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  name text not null,
  description text,
  percentage numeric,
  color_hex text,
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);


-- 9. Tags (global) --------------------------------------------------------------
create table if not exists tags (
  tag text NOT NULL primary key,
	account_id uuid not null references accounts.accounts (id) on delete cascade,
	term text,
	definition text,
	set_name text,
	embedding vector(1536) --
	updated_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);


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
