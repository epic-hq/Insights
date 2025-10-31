-- Mini CRM foundation: enrich people, organizations, and opportunities tables
-- to support structured stakeholder tracking and CRM-aligned exports.

alter table public.people
    add column if not exists primary_email text,
    add column if not exists primary_phone text,
    add column if not exists linkedin_url text,
    add column if not exists website_url text,
    add column if not exists lifecycle_stage text,
    add column if not exists timezone text,
    add column if not exists pronouns text,
    add column if not exists default_organization_id uuid references public.organizations(id) on delete set null,
    add column if not exists contact_info jsonb default '{}'::jsonb,
    add column if not exists project_id uuid references public.projects(id) on delete cascade,
    add column if not exists role text,
    add column if not exists title text,
    add column if not exists industry text,
    add column if not exists company text;

create index if not exists idx_people_default_organization
    on public.people (default_organization_id)
    where default_organization_id is not null;

alter table public.organizations
    add column if not exists parent_organization_id uuid references public.organizations(id) on delete set null,
    add column if not exists primary_contact_id uuid references public.people(id) on delete set null,
    add column if not exists lifecycle_stage text,
    add column if not exists timezone text,
    add column if not exists crm_external_id text,
    add column if not exists tags text[];

create index if not exists idx_organizations_primary_contact on public.organizations(primary_contact_id)
    where primary_contact_id is not null;

create index if not exists idx_organizations_parent on public.organizations(parent_organization_id)
    where parent_organization_id is not null;

alter table public.opportunities
    add column if not exists organization_id uuid references public.organizations(id) on delete set null,
    add column if not exists primary_contact_id uuid references public.people(id) on delete set null,
    add column if not exists description text,
    add column if not exists stage text,
    add column if not exists forecast_category text,
    add column if not exists amount numeric,
    add column if not exists currency text,
    add column if not exists close_date date,
    add column if not exists next_step text,
    add column if not exists next_step_due date,
    add column if not exists confidence numeric,
    add column if not exists source text,
    add column if not exists crm_external_id text,
    add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_opportunities_organization on public.opportunities(organization_id)
    where organization_id is not null;

create index if not exists idx_opportunities_stage on public.opportunities(stage)
    where stage is not null;

create index if not exists idx_opportunities_close_date on public.opportunities(close_date)
    where close_date is not null;

-- Ensure existing NULL contact_info rows adopt the new default shape for consistency.
update public.people
set contact_info = '{}'::jsonb
where contact_info is null;
