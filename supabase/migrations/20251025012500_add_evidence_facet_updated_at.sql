-- Add updated_at column to evidence_facet table
alter table public.evidence_facet
  add column if not exists updated_at timestamptz not null default now();

-- The trigger already exists and will now work correctly
