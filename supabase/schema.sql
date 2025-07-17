-- Declarative Database Schema for Interview Insights (Supabase)
-- Generated 2025-07-12
-- -----------------------------------------------------------------------------
-- NOTE: All tables live in the public schema and are scoped by org_id (UUID)
-- Row-Level Security (RLS) will be enabled separately via `supabase db diff`.
-- Extensions -------------------------------------------------------------------
create extension if not exists pgcrypto; -- gen_random_uuid()
create extension if not exists pgvector;

-- 1. Organizations & Memberships ------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_org_memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role text not null check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- 2. Research Projects ----------------------------------------------------------
create table if not exists research_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
	-- owner_id uuid not null references auth.users (id) on delete cascade,
  code text unique,
  title text not null,
  description text,
  created_at timestamptz not null default now()
	updated_at timestamptz not null default now()
);

-- 3. Interviews -----------------------------------------------------------------
create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  project_id uuid not null references research_projects (id) on delete cascade,
  title text,
  interview_date date,
  interviewer_id uuid references auth.users (id),
  participant_pseudonym text,
  segment text,
  duration_min int,
  status text not null check (status in ('uploaded','transcribed','processed')),
  created_at timestamptz not null default now()
);

-- 4. Media Files & Transcripts --------------------------------------------------
create table if not exists media_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  interview_id uuid references interviews (id) on delete set null,
  r2_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  uploaded_by uuid references auth.users (id),
  uploaded_at timestamptz not null default now()
);

-- create table if not exists transcripts (
--   id uuid primary key default gen_random_uuid(),
--   org_id uuid not null references organizations (id) on delete cascade,
--   interview_id uuid not null references interviews (id) on delete cascade,
--   text text,
--   source_json jsonb,
--   created_at timestamptz not null default now()
-- );

-- 5. Insights & Quotes ----------------------------------------------------------
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  interview_id uuid references interviews (id),
  name text not null,
  category text not null,
  journey_stage text,
  impact smallint check (impact between 1 and 5),
  novelty smallint check (novelty between 1 and 5),
  jtbd text,
	details text,
  motivation text,
  pain text,
  desired_outcome text,
  emotional_response text,
	evidence text,
  opportunity_ideas text[],
  confidence text check (confidence in ('low','medium','high')),
  contradictions text,
	related_tags text[],
  embedding vector(1536),
  created_at timestamptz not null default now()
	updated_at timestamptz not null default now()
);
-- Consider adding multiple quotes and evidence with timestamps so user can see when they were said and rest of context.

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  insight_id uuid not null references insights (id) on delete cascade,
  quote text not null,
  timestamp_sec int,
  created_at timestamptz not null default now()
);

-- 6. Themes ---------------------------------------------------------------------
create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  category text,
  color_hex text,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- 7. Personas -------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  percentage numeric,
  color_hex text,
  created_at timestamptz not null default now()
);

-- 8. Opportunities --------------------------------------------------------------
-- 7. Comments -------------------------------------------------------------------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  insight_id uuid not null references insights (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_insight_id_idx on comments (insight_id);
create index if not exists comments_org_id_idx on comments (org_id);
create index if not exists comments_user_id_idx on comments (user_id);
create index if not exists comments_created_at_idx on comments (created_at desc);

-- 8. Opportunities ------------------------------------------------------------
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  owner_id uuid references auth.users (id),
  kanban_status text check (kanban_status in ('Explore','Validate','Build')),
  related_insight_ids uuid[],
  created_at timestamptz not null default now()
);

-- 9. Tags (global) --------------------------------------------------------------
create table if not exists tags (
  tag text primary key,
  description text
);

create table if not exists insight_tags (
  insight_id uuid not null references insights (id) on delete cascade,
  tag text not null references tags (tag) on delete cascade,
  primary key (insight_id, tag)
);

-- 10. Views ---------------------------------------------------------------------
-- Materialized view to count insights per theme for treemap dashboard
create materialized view if not exists theme_counts_mv as
select t.id as theme_id,
       t.name,
       count(*) as insight_count
from themes t
left join insights i on i.category = t.name and i.org_id = t.org_id
group by t.id, t.name;

-- -----------------------------------------------------------------------------
-- End of declarative schema
