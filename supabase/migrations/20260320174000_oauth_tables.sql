-- OAuth 2.1 support for MCP server authentication
-- Enables Claude Desktop and ChatGPT to connect via their native Connectors UI

-- 1. OAuth client registrations (Dynamic Client Registration - RFC 7591)
create table if not exists public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_name text,
  redirect_uris text[] not null,
  grant_types text[] not null default '{authorization_code}',
  response_types text[] not null default '{code}',
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_clients_client_id
  on public.oauth_clients (client_id);

alter table public.oauth_clients enable row level security;

-- 2. Authorization codes (PKCE flow state, short-lived, single-use)
create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  project_id uuid not null references projects (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  scopes text[] not null default '{read,write}',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_auth_codes_hash
  on public.oauth_authorization_codes (code_hash)
  where used_at is null;

create index if not exists idx_oauth_auth_codes_expires
  on public.oauth_authorization_codes (expires_at)
  where used_at is null;

alter table public.oauth_authorization_codes enable row level security;

-- 3. Extend project_api_keys for OAuth token storage
alter table public.project_api_keys
  add column if not exists refresh_token_hash text,
  add column if not exists oauth_client_id text references public.oauth_clients (client_id) on delete set null;

create index if not exists idx_project_api_keys_refresh_token
  on public.project_api_keys (refresh_token_hash)
  where refresh_token_hash is not null and revoked_at is null;
