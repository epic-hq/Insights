-- Asset-Evidence junction table ------------------------------------------------
-- Links assets to evidence records extracted from them
-- NOTE: This file must load AFTER 32_evidence.sql (evidence table) and 25_project_assets.sql

create table if not exists asset_evidence (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references project_assets(id) on delete cascade,
    evidence_id uuid not null references evidence(id) on delete cascade,
    account_id uuid not null,
    project_id uuid references projects(id) on delete cascade,

    -- Provenance
    row_index int,                     -- Which row in the table this evidence came from
    column_name text,                  -- Which column (for column summaries)
    extraction_type text check (extraction_type in ('row', 'column_summary', 'document_summary', 'manual')),

    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),

    unique(asset_id, evidence_id)
);

create index if not exists idx_asset_evidence_asset_id on asset_evidence(asset_id);
create index if not exists idx_asset_evidence_evidence_id on asset_evidence(evidence_id);
create index if not exists idx_asset_evidence_account_id on asset_evidence(account_id);

alter table asset_evidence enable row level security;

create policy "Account members can select" on public.asset_evidence
    for select to authenticated
    using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can insert" on public.asset_evidence
    for insert to authenticated
    with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can update" on public.asset_evidence
    for update to authenticated
    using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account owners can delete" on public.asset_evidence
    for delete to authenticated
    using (account_id in (select accounts.get_accounts_with_role('owner')));
