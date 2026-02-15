-- Gen-UI Event Store
-- Tables for bidirectional agent-UI state synchronization
-- Event sourcing model with materialized state views

-- Threads: top-level conversation containers
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  resource_id text,
  created_at timestamptz not null default now()
);

create index if not exists threads_account_id_idx on public.threads(account_id);
create index if not exists threads_resource_id_idx on public.threads(resource_id);

-- Thread sequence counters for monotonic event ordering
create table if not exists public.thread_seq (
  thread_id uuid primary key references public.threads(id) on delete cascade,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  next_seq bigint not null default 1
);

-- Artifacts: generated UI components with versioning
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  artifact_type text not null,
  version int not null default 1,
  parent_id uuid references public.artifacts(id),
  status text not null default 'active' check (status in ('draft','active','archived','deleted')),
  created_by text not null check (created_by in ('user','agent','system')),
  trace_id uuid,
  a2ui_doc jsonb not null,
  data_model jsonb not null,
  capabilities_snapshot jsonb not null,
  etag text not null,
  created_at timestamptz not null default now()
);

create index if not exists artifacts_thread_type_created_idx
  on public.artifacts(thread_id, artifact_type, created_at desc);
create index if not exists artifacts_status_idx on public.artifacts(status);

-- UI Events: event log for all state changes
create table if not exists public.ui_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  seq bigint not null,
  client_event_id uuid not null,
  event_type text not null,
  path text not null,
  value jsonb,
  artifact_id uuid references public.artifacts(id),
  actor text not null check (actor in ('user','agent','system')),
  trace_id uuid,
  created_at timestamptz not null default now(),
  unique(thread_id, seq),
  unique(thread_id, client_event_id)
);

create index if not exists ui_events_thread_seq_idx
  on public.ui_events(thread_id, seq desc);
create index if not exists ui_events_event_type_idx on public.ui_events(event_type);

-- UI State: materialized current state per thread
create table if not exists public.ui_state (
  thread_id uuid not null references public.threads(id) on delete cascade,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  state_key text not null,
  state_value jsonb not null,
  updated_by text not null check (updated_by in ('user','agent','system')),
  updated_at timestamptz not null default now(),
  seq bigint not null,
  primary key(thread_id, state_key)
);

create index if not exists ui_state_thread_idx on public.ui_state(thread_id);

-- Atomic event ingestion function
-- Handles: thread upsert, seq increment, event insert, state materialization
create or replace function public.ingest_ui_event(
  p_account_id uuid,
  p_thread_id uuid,
  p_client_event_id uuid,
  p_event_type text,
  p_path text,
  p_value jsonb,
  p_artifact_id uuid,
  p_actor text,
  p_trace_id uuid
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_seq bigint;
  v_path text[];
  v_state jsonb;
begin
  -- Upsert thread
  insert into public.threads(id, account_id)
  values (p_thread_id, p_account_id)
  on conflict (id) do update
    set account_id = excluded.account_id;

  -- Upsert thread_seq
  insert into public.thread_seq(thread_id, account_id)
  values (p_thread_id, p_account_id)
  on conflict (thread_id) do update
    set account_id = excluded.account_id;

  -- Atomically increment and get sequence number
  update public.thread_seq
    set next_seq = next_seq + 1
    where thread_id = p_thread_id
    returning (next_seq - 1) into v_seq;

  -- Insert event (idempotent via client_event_id)
  begin
    insert into public.ui_events(
      thread_id,
      account_id,
      seq,
      client_event_id,
      event_type,
      path,
      value,
      artifact_id,
      actor,
      trace_id
    )
    values (
      p_thread_id,
      p_account_id,
      v_seq,
      p_client_event_id,
      p_event_type,
      p_path,
      p_value,
      p_artifact_id,
      p_actor,
      p_trace_id
    );
  exception when unique_violation then
    -- Idempotent: return existing seq for duplicate client_event_id
    select seq into v_seq
      from public.ui_events
      where thread_id = p_thread_id
        and client_event_id = p_client_event_id;
  end;

  -- Materialize state
  if p_path is null or p_path = '' then
    -- Full state replacement
    v_state := coalesce(p_value, '{}'::jsonb);

    insert into public.ui_state(
      thread_id,
      account_id,
      state_key,
      state_value,
      updated_by,
      seq
    )
    values (
      p_thread_id,
      p_account_id,
      'root',
      v_state,
      p_actor,
      v_seq
    )
    on conflict (thread_id, state_key) do update
      set state_value = v_state,
          updated_by = excluded.updated_by,
          updated_at = now(),
          seq = excluded.seq;
  else
    -- Partial state update via JSON path
    v_path := string_to_array(trim(leading '/' from p_path), '/');

    insert into public.ui_state(
      thread_id,
      account_id,
      state_key,
      state_value,
      updated_by,
      seq
    )
    values (
      p_thread_id,
      p_account_id,
      'root',
      jsonb_set('{}'::jsonb, v_path, coalesce(p_value, 'null'::jsonb), true),
      p_actor,
      v_seq
    )
    on conflict (thread_id, state_key) do update
      set state_value = jsonb_set(ui_state.state_value, v_path, coalesce(p_value, 'null'::jsonb), true),
          updated_by = excluded.updated_by,
          updated_at = now(),
          seq = excluded.seq;
  end if;

  return jsonb_build_object('seq', v_seq, 'server_ts', now());
end;
$$;

-- Row Level Security
alter table public.threads enable row level security;
alter table public.thread_seq enable row level security;
alter table public.ui_events enable row level security;
alter table public.ui_state enable row level security;
alter table public.artifacts enable row level security;

-- RLS Policies for threads
drop policy if exists "Account members can access threads" on public.threads;
create policy "Account members can access threads"
  on public.threads
  for select
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can insert threads" on public.threads;
create policy "Account members can insert threads"
  on public.threads
  for insert
  to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can update threads" on public.threads;
create policy "Account members can update threads"
  on public.threads
  for update
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

-- RLS Policies for ui_events
drop policy if exists "Account members can access ui_events" on public.ui_events;
create policy "Account members can access ui_events"
  on public.ui_events
  for select
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can insert ui_events" on public.ui_events;
create policy "Account members can insert ui_events"
  on public.ui_events
  for insert
  to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

-- RLS Policies for ui_state
drop policy if exists "Account members can access ui_state" on public.ui_state;
create policy "Account members can access ui_state"
  on public.ui_state
  for select
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can write ui_state" on public.ui_state;
create policy "Account members can write ui_state"
  on public.ui_state
  for insert
  to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can update ui_state" on public.ui_state;
create policy "Account members can update ui_state"
  on public.ui_state
  for update
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

-- RLS Policies for artifacts
drop policy if exists "Account members can access artifacts" on public.artifacts;
create policy "Account members can access artifacts"
  on public.artifacts
  for select
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can insert artifacts" on public.artifacts;
create policy "Account members can insert artifacts"
  on public.artifacts
  for insert
  to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

drop policy if exists "Account members can update artifacts" on public.artifacts;
create policy "Account members can update artifacts"
  on public.artifacts
  for update
  to authenticated
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

-- Service role policies for thread_seq (RPC function runs as definer)
drop policy if exists "Service role can manage thread_seq" on public.thread_seq;
create policy "Service role can manage thread_seq"
  on public.thread_seq
  for all
  to service_role
  using (true)
  with check (true);

-- Grants
grant select, insert, update, delete on public.threads to authenticated, service_role;
grant select, insert, update, delete on public.thread_seq to service_role;
grant select, insert, update, delete on public.ui_events to authenticated, service_role;
grant select, insert, update, delete on public.ui_state to authenticated, service_role;
grant select, insert, update, delete on public.artifacts to authenticated, service_role;

-- Grant execute on ingest function
grant execute on function public.ingest_ui_event to authenticated, service_role;
