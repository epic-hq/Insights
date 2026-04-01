-- OAuth 2.1 Support for MCP Server Authentication ----------------------------
-- Enables Claude Desktop and ChatGPT to connect via their native Connectors UI
-- using OAuth 2.1 Authorization Code + PKCE + Dynamic Client Registration.
--
-- Flow: Client discovers endpoints → registers via DCR → user authorizes →
-- tokens issued as standard API keys (reuses project_api_keys table).

-- Dynamic Client Registration (RFC 7591) ------------------------------------
-- Claude and ChatGPT auto-register themselves before starting the OAuth flow.
-- Each client gets a unique client_id; we store their redirect_uris for validation.

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

-- Authorization Codes (PKCE flow state) --------------------------------------
-- Short-lived (10 min), single-use codes created when user clicks "Allow"
-- on the /oauth/authorize page. Exchanged for tokens at POST /oauth/token.

create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,          -- SHA-256 hash of the authorization code
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

-- Fast lookup by code (only unused codes)
create index if not exists idx_oauth_auth_codes_hash
  on public.oauth_authorization_codes (code_hash)
  where used_at is null;

-- Cleanup: auto-expire old codes (optional, for maintenance queries)
create index if not exists idx_oauth_auth_codes_expires
  on public.oauth_authorization_codes (expires_at)
  where used_at is null;

alter table public.oauth_authorization_codes enable row level security;
