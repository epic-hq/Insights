-- Ensure person_facet_summaries has a created_at column so timestamp triggers don't fail
alter table public.person_facet_summaries
  add column if not exists created_at timestamptz not null default now();
