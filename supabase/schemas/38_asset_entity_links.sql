-- supabase/schemas/38_asset_entity_links.sql
-- Junction tables for linking assets and interviews/notes to people, organizations, and opportunities
-- This enables many-to-many relationships between content and entities

--------------------------------------------------------------------------------
-- ASSET-ENTITY JUNCTION TABLES
--------------------------------------------------------------------------------

-- Asset-People junction table
create table if not exists public.asset_people (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.project_assets(id) on delete cascade,
    person_id uuid not null references public.people(id) on delete cascade,
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,

    -- Relationship metadata
    relationship_type text check (relationship_type in ('mentioned', 'about', 'created_by', 'related')),
    notes text,

    -- Audit
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),

    -- Ensure unique asset-person pairs
    unique(asset_id, person_id)
);

comment on table public.asset_people is 'Links project assets (files, tables, documents) to people';
comment on column public.asset_people.relationship_type is 'Type of relationship: mentioned (name appears), about (asset is about this person), created_by, related';

-- Asset-Organizations junction table
create table if not exists public.asset_organizations (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.project_assets(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,

    -- Relationship metadata
    relationship_type text check (relationship_type in ('mentioned', 'about', 'source', 'related')),
    notes text,

    -- Audit
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),

    -- Ensure unique asset-organization pairs
    unique(asset_id, organization_id)
);

comment on table public.asset_organizations is 'Links project assets to organizations';
comment on column public.asset_organizations.relationship_type is 'Type of relationship: mentioned, about (asset is about this org), source (data from this org), related';

-- Asset-Opportunities junction table
create table if not exists public.asset_opportunities (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.project_assets(id) on delete cascade,
    opportunity_id uuid not null references public.opportunities(id) on delete cascade,
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,

    -- Relationship metadata
    relationship_type text check (relationship_type in ('supporting', 'about', 'related')),
    notes text,

    -- Audit
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),

    -- Ensure unique asset-opportunity pairs
    unique(asset_id, opportunity_id)
);

comment on table public.asset_opportunities is 'Links project assets to sales opportunities';
comment on column public.asset_opportunities.relationship_type is 'Type of relationship: supporting (evidence for deal), about, related';

--------------------------------------------------------------------------------
-- INTERVIEW/NOTE-ENTITY JUNCTION TABLES
-- (interview_people already exists in 21_interview_people.sql)
-- Adding organization and opportunity links
--------------------------------------------------------------------------------

-- Interview-Organizations junction table (notes and conversations linked to orgs)
create table if not exists public.interview_organizations (
    id uuid primary key default gen_random_uuid(),
    interview_id uuid not null references public.interviews(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,

    -- Relationship metadata
    relationship_type text check (relationship_type in ('mentioned', 'about', 'with', 'related')),
    notes text,

    -- Audit
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),

    -- Ensure unique interview-organization pairs
    unique(interview_id, organization_id)
);

comment on table public.interview_organizations is 'Links interviews/notes to organizations';
comment on column public.interview_organizations.relationship_type is 'Type of relationship: mentioned, about, with (interview with this org), related';

-- Interview-Opportunities junction table (notes and conversations linked to deals)
create table if not exists public.interview_opportunities (
    id uuid primary key default gen_random_uuid(),
    interview_id uuid not null references public.interviews(id) on delete cascade,
    opportunity_id uuid not null references public.opportunities(id) on delete cascade,
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,

    -- Relationship metadata
    relationship_type text check (relationship_type in ('discovery', 'demo', 'negotiation', 'related')),
    notes text,

    -- Audit
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),

    -- Ensure unique interview-opportunity pairs
    unique(interview_id, opportunity_id)
);

comment on table public.interview_opportunities is 'Links interviews/notes to sales opportunities';
comment on column public.interview_opportunities.relationship_type is 'Type of relationship: discovery (call), demo, negotiation, related';

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Asset-People indexes
create index if not exists idx_asset_people_asset_id on public.asset_people(asset_id);
create index if not exists idx_asset_people_person_id on public.asset_people(person_id);
create index if not exists idx_asset_people_project_id on public.asset_people(project_id);

-- Asset-Organizations indexes
create index if not exists idx_asset_organizations_asset_id on public.asset_organizations(asset_id);
create index if not exists idx_asset_organizations_organization_id on public.asset_organizations(organization_id);
create index if not exists idx_asset_organizations_project_id on public.asset_organizations(project_id);

-- Asset-Opportunities indexes
create index if not exists idx_asset_opportunities_asset_id on public.asset_opportunities(asset_id);
create index if not exists idx_asset_opportunities_opportunity_id on public.asset_opportunities(opportunity_id);
create index if not exists idx_asset_opportunities_project_id on public.asset_opportunities(project_id);

-- Interview-Organizations indexes
create index if not exists idx_interview_organizations_interview_id on public.interview_organizations(interview_id);
create index if not exists idx_interview_organizations_organization_id on public.interview_organizations(organization_id);
create index if not exists idx_interview_organizations_project_id on public.interview_organizations(project_id);

-- Interview-Opportunities indexes
create index if not exists idx_interview_opportunities_interview_id on public.interview_opportunities(interview_id);
create index if not exists idx_interview_opportunities_opportunity_id on public.interview_opportunities(opportunity_id);
create index if not exists idx_interview_opportunities_project_id on public.interview_opportunities(project_id);

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

-- Enable RLS on all tables
alter table public.asset_people enable row level security;
alter table public.asset_organizations enable row level security;
alter table public.asset_opportunities enable row level security;
alter table public.interview_organizations enable row level security;
alter table public.interview_opportunities enable row level security;

-- Asset-People RLS
create policy "Users can view asset_people for their account" on public.asset_people
    for select using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can insert asset_people for their account" on public.asset_people
    for insert with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can update asset_people for their account" on public.asset_people
    for update using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can delete asset_people for their account" on public.asset_people
    for delete using (account_id in (select accounts.get_accounts_with_role()));

-- Asset-Organizations RLS
create policy "Users can view asset_organizations for their account" on public.asset_organizations
    for select using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can insert asset_organizations for their account" on public.asset_organizations
    for insert with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can update asset_organizations for their account" on public.asset_organizations
    for update using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can delete asset_organizations for their account" on public.asset_organizations
    for delete using (account_id in (select accounts.get_accounts_with_role()));

-- Asset-Opportunities RLS
create policy "Users can view asset_opportunities for their account" on public.asset_opportunities
    for select using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can insert asset_opportunities for their account" on public.asset_opportunities
    for insert with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can update asset_opportunities for their account" on public.asset_opportunities
    for update using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can delete asset_opportunities for their account" on public.asset_opportunities
    for delete using (account_id in (select accounts.get_accounts_with_role()));

-- Interview-Organizations RLS
create policy "Users can view interview_organizations for their account" on public.interview_organizations
    for select using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can insert interview_organizations for their account" on public.interview_organizations
    for insert with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can update interview_organizations for their account" on public.interview_organizations
    for update using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can delete interview_organizations for their account" on public.interview_organizations
    for delete using (account_id in (select accounts.get_accounts_with_role()));

-- Interview-Opportunities RLS
create policy "Users can view interview_opportunities for their account" on public.interview_opportunities
    for select using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can insert interview_opportunities for their account" on public.interview_opportunities
    for insert with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can update interview_opportunities for their account" on public.interview_opportunities
    for update using (account_id in (select accounts.get_accounts_with_role()));

create policy "Users can delete interview_opportunities for their account" on public.interview_opportunities
    for delete using (account_id in (select accounts.get_accounts_with_role()));
