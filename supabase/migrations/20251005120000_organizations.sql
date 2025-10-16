-- Add organizations and people_organizations tables

-- Organizations -------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  legal_name text,
  description text,
  industry text,
  sub_industry text,
  company_type text,
  size_range text,
  employee_count int,
  annual_revenue numeric,
  phone text,
  email text,
  website_url text,
  linkedin_url text,
  twitter_url text,
  domain text,
  headquarters_location text,
  billing_address jsonb,
  shipping_address jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_account_id on public.organizations(account_id);
create index if not exists idx_organizations_project_id on public.organizations(project_id);
create unique index if not exists uniq_organizations_account_lower_name
  on public.organizations (account_id, lower(name));

create trigger set_organizations_timestamp
    before insert or update on public.organizations
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_organizations_user_tracking
    before insert or update on public.organizations
    for each row
execute procedure accounts.trigger_set_user_tracking();

alter table public.organizations enable row level security;

create policy if not exists "Account members can select" on public.organizations
    for select
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy if not exists "Account members can insert" on public.organizations
    for insert
    to authenticated
    with check (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy if not exists "Account members can update" on public.organizations
    for update
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy if not exists "Account owners can delete" on public.organizations
    for delete
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role('owner'))
    );


-- People <> Organizations Junction -------------------------------------------------
create table if not exists people_organizations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts (id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text,
  relationship_status text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_organizations_person_org_unique unique (person_id, organization_id)
);

create index if not exists idx_people_organizations_account_id on public.people_organizations(account_id);
create index if not exists idx_people_organizations_project_id on public.people_organizations(project_id);
create index if not exists idx_people_organizations_person_id on public.people_organizations(person_id);
create index if not exists idx_people_organizations_org_id on public.people_organizations(organization_id);

create trigger set_people_organizations_timestamp
    before insert or update on public.people_organizations
    for each row
execute procedure accounts.trigger_set_timestamps();

create trigger set_people_organizations_user_tracking
    before insert or update on public.people_organizations
    for each row
execute procedure accounts.trigger_set_user_tracking();

alter table public.people_organizations enable row level security;

create policy if not exists "Account members can select" on public.people_organizations
    for select
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy if not exists "Account members can insert" on public.people_organizations
    for insert
    to authenticated
    with check (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy if not exists "Account members can update" on public.people_organizations
    for update
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role())
    );

create policy if not exists "Account owners can delete" on public.people_organizations
    for delete
    to authenticated
    using (
        account_id in (select accounts.get_accounts_with_role('owner'))
    );
