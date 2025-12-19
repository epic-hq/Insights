-- Themes and Theme-Evidence Junction ---------------------------------------
-- Normalized grouping of evidence into named themes with criteria

create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,

  -- Core theme definition
  name text not null,
  statement text,

  -- AI-assisted clustering fields
  inclusion_criteria text,
  exclusion_criteria text,
  synonyms text[] default '{}',
  anti_examples text[] default '{}',

  -- User-friendly fields (backward compatible with old insights)
  category text,
  jtbd text, -- Jobs To Be Done
  pain text,
  desired_outcome text,
  journey_stage text,
  emotional_response text,
  motivation text,

  -- Additional context fields
  details text,
  evidence text,
  impact text,
  contradictions text,
  novelty text,
  opportunity_ideas text[] default '{}',
  related_tags text[] default '{}',
  confidence smallint,

  -- Prioritization (for insight triage)
  priority integer default 3 check (priority between 1 and 3),
  -- 1 = High, 2 = Medium, 3 = Low (matches task priority)

  -- Legacy compatibility (for migration from insights)
  interview_id uuid references interviews(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete cascade,
  updated_by uuid references auth.users (id) on delete cascade
);

comment on table themes is 'Conceptual groupings used to organize related evidence.';

create index if not exists idx_themes_account_id on public.themes(account_id);
create index if not exists idx_themes_project_id on public.themes(project_id);
create index if not exists idx_themes_created_at on public.themes(created_at desc);

create trigger set_themes_timestamp
    before insert or update on public.themes
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_themes_user_tracking
    before insert or update on public.themes
    for each row
execute procedure accounts.trigger_set_user_tracking();

alter table public.themes enable row level security;

create policy "Account members can select" on public.themes
  for select to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can insert" on public.themes
  for insert to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can update" on public.themes
  for update to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account owners can delete" on public.themes
  for delete to authenticated
  using (account_id in (select accounts.get_accounts_with_role('owner')));

-- theme_evidence junction ----------------------------------------------------
create table if not exists theme_evidence (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references themes(id) on delete cascade,
  evidence_id uuid not null references evidence(id) on delete cascade,
  account_id uuid not null,
  project_id uuid references projects(id) on delete cascade,
  rationale text,
  confidence numeric,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique(theme_id, evidence_id, account_id)
);

create index if not exists idx_theme_evidence_theme_id on theme_evidence(theme_id);
create index if not exists idx_theme_evidence_evidence_id on theme_evidence(evidence_id);
create index if not exists idx_theme_evidence_account_id on theme_evidence(account_id);

alter table theme_evidence enable row level security;

create policy "Users can view theme_evidence for their account" on theme_evidence
  for select using (
    exists (select 1 from themes t where t.id = theme_evidence.theme_id
            and t.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

create policy "Users can insert theme_evidence for their account" on theme_evidence
  for insert with check (
    exists (select 1 from themes t where t.id = theme_evidence.theme_id
            and t.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

create policy "Users can update theme_evidence for their account" on theme_evidence
  for update using (
    exists (select 1 from themes t where t.id = theme_evidence.theme_id
            and t.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );

create policy "Users can delete theme_evidence for their account" on theme_evidence
  for delete using (
    exists (select 1 from themes t where t.id = theme_evidence.theme_id
            and t.account_id in (select account_id from accounts.account_user where user_id = auth.uid()))
  );
