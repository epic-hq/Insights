-- Add soft-delete and project-wide archive support to evidence table
-- is_archived: project-wide flag (replaces per-user entity_flags archived behavior)
-- deleted_at: soft-delete timestamp (NULL = active, non-null = soft-deleted)

alter table public.evidence
  add column if not exists is_archived boolean not null default false;

alter table public.evidence
  add column if not exists deleted_at timestamptz default null;

comment on column public.evidence.is_archived is 'Project-wide archive flag. When true, evidence is excluded from all views and analysis pipelines.';
comment on column public.evidence.deleted_at is 'Soft-delete timestamp. NULL means active. Non-null evidence is hidden from all views and auto-purged after 30 days.';

-- Partial indexes for efficient filtering of archived/deleted evidence
create index if not exists idx_evidence_active
  on public.evidence (project_id, created_at desc)
  where deleted_at is null and is_archived = false;

create index if not exists idx_evidence_soft_deleted
  on public.evidence (deleted_at)
  where deleted_at is not null;
