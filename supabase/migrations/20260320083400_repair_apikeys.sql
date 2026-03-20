-- Repair: create project_api_keys if the previous migration was recorded
-- but the table was not actually created (bloated diff failure).

create table if not exists public.project_api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{read}'::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_project_api_keys_hash
  on public.project_api_keys (key_hash)
  where revoked_at is null;

create index if not exists idx_project_api_keys_project
  on public.project_api_keys (project_id, created_at desc)
  where revoked_at is null;

alter table public.project_api_keys enable row level security;
