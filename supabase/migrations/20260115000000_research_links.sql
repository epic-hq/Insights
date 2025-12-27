create extension if not exists "pgcrypto";

create table if not exists public.research_links (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts.accounts (id) on delete cascade,
    project_id uuid references projects (id) on delete set null,
    name text not null,
    slug text not null,
    description text,
    hero_title text,
    hero_subtitle text,
    hero_cta_label text default 'Start the survey',
    hero_cta_helper text,
    redirect_url text,
    calendar_url text,
    questions jsonb not null default '[]'::jsonb,
    allow_chat boolean not null default false,
    default_response_mode text not null default 'form' check (default_response_mode in ('form', 'chat')),
    is_live boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.research_links
    add constraint research_links_slug_key unique (slug);

create table if not exists public.research_link_responses (
    id uuid primary key default gen_random_uuid(),
    research_link_id uuid not null references public.research_links (id) on delete cascade,
    email text not null,
    responses jsonb not null default '{}'::jsonb,
    response_mode text not null default 'form' check (response_mode in ('form', 'chat')),
    completed boolean not null default false,
    evidence_id uuid references public.evidence (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists research_link_responses_unique_email
    on public.research_link_responses (research_link_id, lower(email));

create index if not exists research_link_responses_list_id_idx
    on public.research_link_responses (research_link_id);

create trigger set_research_links_updated_at
    before update on public.research_links
    for each row execute function public.set_updated_at();

create trigger set_research_link_responses_updated_at
    before update on public.research_link_responses
    for each row execute function public.set_updated_at();

alter table public.research_links enable row level security;

create policy "Members can read research links"
    on public.research_links
    for select
    using (account_id in (select accounts.get_accounts_with_role()));

create policy "Members can insert research links"
    on public.research_links
    for insert to authenticated
    with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Members can update research links"
    on public.research_links
    for update to authenticated
    using (account_id in (select accounts.get_accounts_with_role()))
    with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Owners can delete research links"
    on public.research_links
    for delete to authenticated
    using (account_id in (select accounts.get_accounts_with_role('owner')));

alter table public.research_link_responses enable row level security;

create policy "Members can read research link responses"
    on public.research_link_responses
    for select
    using (
        research_link_id in (
            select id from public.research_links
            where account_id in (select accounts.get_accounts_with_role())
        )
    );

-- RPC function to get response counts for research links
create or replace function public.get_research_link_response_counts(link_ids uuid[])
returns table (research_link_id uuid, response_count bigint)
language sql
stable
as $$
  select research_link_id, count(*)::bigint as response_count
  from public.research_link_responses
  where research_link_id = any(link_ids)
  group by research_link_id
$$;
