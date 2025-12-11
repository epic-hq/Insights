-- Project Assets ----------------------------------------------------------------
-- Imported files, tables, PDFs, and external data sources
-- Separate from interviews (conversations) and project_sections (config/metadata)

-- Asset type enum
do $$
begin
    create type public.asset_type as enum (
        'table',      -- Spreadsheet/CSV data
        'pdf',        -- PDF documents
        'document',   -- Word docs, rich text, etc.
        'image',      -- Screenshots, diagrams
        'audio',      -- Audio files (podcasts, recordings)
        'video',      -- Video files (generated reels, clips)
        'link'        -- External URLs/embeds
    );
exception when duplicate_object then
    null;
end $$;

-- Reuse interview_status for consistency across the app
-- interview_status enum is defined in 20_interviews.sql:
--   'draft', 'scheduled', 'uploading', 'uploaded', 'transcribing',
--   'transcribed', 'processing', 'ready', 'tagged', 'archived', 'error'

create table if not exists project_assets (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    project_id uuid not null references projects(id) on delete cascade,

    -- Classification
    asset_type public.asset_type not null,
    title text not null,
    description text,
    tags text[] default '{}',

    -- Storage (for binary files)
    -- NOTE: Store R2 key only, NOT presigned URLs. Generate signed URLs on-demand.
    -- Use createR2PresignedUrl() from app/utils/r2.server.ts for read access.
    -- Use uploadToR2() for writes. See existing interview media_url pattern.
    media_key text,                    -- R2 object key (e.g., 'assets/{account}/{project}/{id}.pdf')
    thumbnail_key text,                -- R2 key for thumbnail/preview image
    file_extension text,               -- pdf, csv, xlsx, png, mp4, etc.
    original_filename text,
    file_size_bytes bigint,
    mime_type text,
    duration_sec int,                  -- Duration for audio/video assets

    -- Content (for text-based assets)
    content_md text,                   -- Markdown representation (tables, extracted PDF text)
    content_raw text,                  -- Original raw content (CSV string, etc.)

    -- Structured data (for tables)
    table_data jsonb,                  -- {headers: string[], rows: Record<string,any>[], column_types?: Record<string,string>}
    row_count int,
    column_count int,

    -- Processing state (reuses interview_status for consistency)
    status public.interview_status not null default 'ready',
    processing_metadata jsonb default '{}'::jsonb,
    error_message text,

    -- Source tracking
    source_type text check (source_type in ('upload', 'paste', 'import', 'link')),
    source_url text,                   -- Original URL if imported from external source

    -- Semantic search
    embedding vector(1536),
    embedding_model text default 'text-embedding-3-small',
    embedding_generated_at timestamptz,

    -- Full-text search
    content_tsv tsvector generated always as (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content_md, ''))
    ) stored,

    -- Audit
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references auth.users(id),
    updated_by uuid references auth.users(id)
);

-- Comments
comment on table project_assets is 'Imported files, tables, PDFs, and external data sources. Separate from interviews (conversations) and project_sections (config/metadata).';
comment on column project_assets.asset_type is 'Type of asset: table, pdf, document, image, audio, video, link';
comment on column project_assets.media_key is 'R2 object key (NOT a URL). Generate signed URLs on-demand via createR2PresignedUrl(). Pattern: assets/{account_id}/{project_id}/{asset_id}.{ext}';
comment on column project_assets.thumbnail_key is 'R2 key for thumbnail/preview. For videos: first frame. For PDFs: first page render. For audio: waveform image.';
comment on column project_assets.duration_sec is 'Duration in seconds for audio/video assets';
comment on column project_assets.content_md is 'Markdown representation for display (tables rendered as markdown, PDF text extracted)';
comment on column project_assets.content_raw is 'Original raw content (e.g., CSV string) for re-parsing';
comment on column project_assets.table_data is 'Structured table data: {headers: string[], rows: Record<string,any>[], column_types?: Record<string,string>}';
comment on column project_assets.source_type is 'How the asset was created: upload (file drop), paste (copy-paste), import (API/integration), link (URL reference)';

-- Indexes
create index if not exists idx_project_assets_account_id on project_assets(account_id);
create index if not exists idx_project_assets_project_id on project_assets(project_id);
create index if not exists idx_project_assets_asset_type on project_assets(asset_type);
create index if not exists idx_project_assets_status on project_assets(status);
create index if not exists idx_project_assets_created_at on project_assets(created_at desc);
create index if not exists idx_project_assets_content_tsv on project_assets using gin(content_tsv);

-- HNSW index for semantic similarity search
do $$
begin
    if not exists (
        select 1 from pg_indexes
        where tablename = 'project_assets' and indexname = 'project_assets_embedding_idx'
    ) then
        create index project_assets_embedding_idx on public.project_assets
        using hnsw (embedding vector_cosine_ops);
    end if;
end $$;

-- RLS Policies
-- Users can read assets for accounts they belong to
create policy "Users can read project assets for their accounts"
    on project_assets for select
    using (
        account_id in (
            select account_id from accounts.account_user
            where user_id = auth.uid()
        )
    );

-- Users can create assets for accounts they belong to
create policy "Users can create project assets for their accounts"
    on project_assets for insert
    with check (
        account_id in (
            select account_id from accounts.account_user
            where user_id = auth.uid()
        )
    );

-- Users can update assets for accounts they belong to
create policy "Users can update project assets for their accounts"
    on project_assets for update
    using (
        account_id in (
            select account_id from accounts.account_user
            where user_id = auth.uid()
        )
    );

-- Users can delete assets for accounts they belong to
create policy "Users can delete project assets for their accounts"
    on project_assets for delete
    using (
        account_id in (
            select account_id from accounts.account_user
            where user_id = auth.uid()
        )
    );

-- Triggers
create trigger set_project_assets_timestamp
    before insert or update on public.project_assets
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_project_assets_user_tracking
    before insert or update on public.project_assets
    for each row
execute procedure accounts.trigger_set_user_tracking();

-- RLS
alter table public.project_assets enable row level security;

-- Account members can read
create policy "Account members can select" on public.project_assets
    for select to authenticated
    using (account_id in (select accounts.get_accounts_with_role()));

-- Account members can insert
create policy "Account members can insert" on public.project_assets
    for insert to authenticated
    with check (account_id in (select accounts.get_accounts_with_role()));

-- Account members can update
create policy "Account members can update" on public.project_assets
    for update to authenticated
    using (account_id in (select accounts.get_accounts_with_role()));

-- Only account owners can delete
create policy "Account owners can delete" on public.project_assets
    for delete to authenticated
    using (account_id in (select accounts.get_accounts_with_role('owner')));


-- NOTE: asset_evidence junction table is in 35_asset_evidence.sql
-- (must load after 32_evidence.sql which defines the evidence table)
