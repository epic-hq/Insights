-- Project API Keys -----------------------------------------------------------
-- Enables MCP clients (Claude Desktop, Cursor, etc.) to authenticate and
-- resolve project/account context via a hashed bearer token.
-- Key format: upsk_<32 hex chars>  (only the SHA-256 hash is stored)

create table if not exists public.project_api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,                        -- "Claude Desktop", "Cursor", etc.
  key_prefix text not null,                  -- "upsk_" + first 8 chars (for display)
  key_hash text not null,                    -- SHA-256 hash of the full key
  scopes text[] not null default '{read}',   -- 'read', 'write', 'admin'
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz                     -- soft-delete / revoke
);

-- Fast lookup by hash (only active keys)
create index if not exists idx_project_api_keys_hash
  on public.project_api_keys (key_hash)
  where revoked_at is null;

-- List keys per project
create index if not exists idx_project_api_keys_project
  on public.project_api_keys (project_id, created_at desc)
  where revoked_at is null;

-- RLS: keys are managed by the application layer (service role) not end-users
alter table public.project_api_keys enable row level security;

-- Allow service role full access (no user-facing RLS policies needed)
-- The API routes use supabaseAdmin which bypasses RLS.
