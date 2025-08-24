-- Evidence -----------------------------------------------------------------
-- Standalone evidence records extracted from interviews or other sources
-- Mirrors patterns in `20_interviews.sql` and `30_insights.sql`

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  interview_id uuid references interviews (id) on delete cascade,

  -- provenance
  source_type text check (source_type in ('primary','secondary')) default 'primary',
  method text check (method in (
    'interview','usability','survey','telemetry','market_report','support_ticket','benchmark','other'
  )) default 'interview',
  modality text check (modality in ('qual','quant')) not null default 'qual',

  -- semantics
  support text check (support in ('supports','refutes','neutral')) default 'supports',
  kind_tags text[] default '{}', -- e.g., {pain, goal, motivation, usability_issue}
  personas text[] default '{}',
  segments text[] default '{}',
  journey_stage text,

  -- weighting / quality (MVP defaults)
  weight_quality numeric default 0.8,
  weight_relevance numeric default 0.8,
  independence_key text,
  confidence text check (confidence in ('low','medium','high')) default 'medium',

  -- content
  verbatim text not null,
  anchors jsonb not null default '[]'::jsonb, -- [{type, target, start?, end?}]
  citation text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete cascade,
  updated_by uuid references auth.users (id) on delete cascade
);

-- Comments ----------------------------------------------------------
comment on table evidence is 'Normalized evidence snippets (verbatim + anchors) extracted from sources.';
comment on column evidence.account_id   is 'Owning account (tenant). Cascades on delete.';
comment on column evidence.project_id   is 'Owning project.';
comment on column evidence.interview_id is 'Source interview if applicable.';
comment on column evidence.verbatim     is 'Quoted text or descriptive evidence.';
comment on column evidence.anchors      is 'JSONB array of deep-link anchors. Each: {type, target, start?, end?}.';

-- Indexes -----------------------------------------------------------
create index if not exists idx_evidence_account_id   on public.evidence(account_id);
create index if not exists idx_evidence_project_id   on public.evidence(project_id);
create index if not exists idx_evidence_interview_id on public.evidence(interview_id);
create index if not exists idx_evidence_created_at   on public.evidence(created_at desc);
create index if not exists idx_evidence_kind_tags    on public.evidence using gin (kind_tags);
create index if not exists idx_evidence_anchors_gin  on public.evidence using gin (anchors jsonb_path_ops);

-- Triggers ----------------------------------------------------------
create trigger set_evidence_timestamp
    before insert or update on public.evidence
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_evidence_user_tracking
    before insert or update on public.evidence
    for each row
execute procedure accounts.trigger_set_user_tracking();

-- RLS ---------------------------------------------------------------
alter table public.evidence enable row level security;

-- Account members can read
create policy "Account members can select" on public.evidence
  for select to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

-- Account members can insert
create policy "Account members can insert" on public.evidence
  for insert to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

-- Account members can update
create policy "Account members can update" on public.evidence
  for update to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

-- Only account owners can delete
create policy "Account owners can delete" on public.evidence
  for delete to authenticated
  using (account_id in (select accounts.get_accounts_with_role('owner')));

-- Evidence tags (junction to tags) ----------------------------------
create table if not exists evidence_tag (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  account_id uuid not null,
  project_id uuid references projects(id) on delete cascade,
  confidence numeric,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique(evidence_id, tag_id, account_id)
);

create index if not exists idx_evidence_tag_evidence_id on evidence_tag(evidence_id);
create index if not exists idx_evidence_tag_tag_id      on evidence_tag(tag_id);
create index if not exists idx_evidence_tag_account_id  on evidence_tag(account_id);

alter table evidence_tag enable row level security;

create policy "Users can view evidence_tag for their account" on evidence_tag
  for select using (
    exists (select 1 from evidence e where e.id = evidence_tag.evidence_id
            and e.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

create policy "Users can insert evidence_tag for their account" on evidence_tag
  for insert with check (
    exists (select 1 from evidence e where e.id = evidence_tag.evidence_id
            and e.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

create policy "Users can update evidence_tag for their account" on evidence_tag
  for update using (
    exists (select 1 from evidence e where e.id = evidence_tag.evidence_id
            and e.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

create policy "Users can delete evidence_tag for their account" on evidence_tag
  for delete using (
    exists (select 1 from evidence e where e.id = evidence_tag.evidence_id
            and e.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

-- Note: `theme_evidence` join will be added when `themes` table lands (kept out to avoid broken refs).
