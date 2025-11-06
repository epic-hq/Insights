-- Pain Matrix Cache Table
-- Stores computed pain matrices to avoid expensive recalculation

create table if not exists pain_matrix_cache (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,

  -- Computed matrix data
  matrix_data jsonb not null,
  insights text,

  -- Metadata for cache management
  evidence_count int not null,
  pain_count int not null,
  user_group_count int not null,
  computation_time_ms int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure one cache per project
  unique(project_id)
);

comment on table pain_matrix_cache is 'Cached pain matrix computations for product lens';
comment on column pain_matrix_cache.matrix_data is 'Full PainMatrix object as JSONB';
comment on column pain_matrix_cache.insights is 'LLM-generated strategic insights';
comment on column pain_matrix_cache.evidence_count is 'Evidence count when matrix was computed (for invalidation)';

create index if not exists idx_pain_matrix_cache_project_id on pain_matrix_cache(project_id);
create index if not exists idx_pain_matrix_cache_updated_at on pain_matrix_cache(updated_at desc);

create trigger set_pain_matrix_cache_timestamp
    before insert or update on pain_matrix_cache
    for each row
execute procedure accounts.trigger_set_timestamps();

alter table pain_matrix_cache enable row level security;

create policy "Account members can view cached matrices" on pain_matrix_cache
  for select to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can insert cached matrices" on pain_matrix_cache
  for insert to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can update cached matrices" on pain_matrix_cache
  for update to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account owners can delete cached matrices" on pain_matrix_cache
  for delete to authenticated
  using (account_id in (select accounts.get_accounts_with_role('owner')));

-- Allow service_role to bypass RLS for cache management
create policy "Service role can manage all cached matrices" on pain_matrix_cache
  for all to service_role
  using (true)
  with check (true);
