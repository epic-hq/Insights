-- Sales lens summaries capture extracted sales methodology data from interviews.
-- Tables include summaries (per framework), granular slots, stakeholder roster, and hygiene events.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'sales_framework') then
        create type sales_framework as enum ('BANT_GPCT','SPICED','MEDDIC','MAP');
    end if;
end $$;

create table if not exists sales_lens_summaries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  interview_id uuid references interviews(id) on delete cascade,
  framework sales_framework not null,
  source_kind text not null default 'interview',
  attendee_person_ids uuid[] not null default '{}',
  attendee_person_keys text[] not null default '{}',
  attendee_unlinked jsonb not null default '[]'::jsonb,
  hygiene_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  computed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_lens_slots (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references sales_lens_summaries(id) on delete cascade,
  slot text not null,
  label text,
  description text,
  text_value text,
  numeric_value numeric,
  date_value date,
  status text,
  confidence numeric,
  owner_person_id uuid references public.people(id) on delete set null,
  owner_person_key text,
  related_person_ids uuid[] not null default '{}',
  related_organization_ids uuid[] not null default '{}',
  evidence_refs jsonb not null default '[]'::jsonb,
  hygiene jsonb not null default '[]'::jsonb,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_lens_stakeholders (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references sales_lens_summaries(id) on delete cascade,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  person_key text,
  candidate_person_key text,
  display_name text not null,
  role text,
  influence text check (influence in ('low','medium','high')) default 'low',
  labels text[] not null default '{}',
  organization_id uuid references public.organizations(id) on delete set null,
  email text,
  confidence numeric,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_lens_hygiene_events (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references sales_lens_summaries(id) on delete cascade,
  slot_id uuid references sales_lens_slots(id) on delete cascade,
  code text not null,
  severity text check (severity in ('info','warning','critical')),
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null
);

create unique index if not exists sales_lens_summaries_interview_framework_unique
  on public.sales_lens_summaries (framework, interview_id)
  where interview_id is not null;

create index if not exists sales_lens_summaries_project_id_idx
  on public.sales_lens_summaries (project_id, framework);

create index if not exists sales_lens_summaries_opportunity_idx
  on public.sales_lens_summaries (opportunity_id)
  where opportunity_id is not null;

create index if not exists sales_lens_slots_summary_idx
  on public.sales_lens_slots (summary_id);

create index if not exists sales_lens_slots_owner_idx
  on public.sales_lens_slots (owner_person_id)
  where owner_person_id is not null;

create index if not exists sales_lens_stakeholders_summary_idx
  on public.sales_lens_stakeholders (summary_id);

create index if not exists sales_lens_stakeholders_person_idx
  on public.sales_lens_stakeholders (person_id)
  where person_id is not null;

create index if not exists sales_lens_stakeholders_person_key_idx
  on public.sales_lens_stakeholders (person_key)
  where person_key is not null;

create index if not exists sales_lens_hygiene_events_summary_idx
  on public.sales_lens_hygiene_events (summary_id);

create trigger set_sales_lens_summaries_timestamp
  before insert or update on public.sales_lens_summaries
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_sales_lens_slots_timestamp
  before insert or update on public.sales_lens_slots
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_sales_lens_stakeholders_timestamp
  before insert or update on public.sales_lens_stakeholders
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_sales_lens_hygiene_events_timestamp
  before insert or update on public.sales_lens_hygiene_events
  for each row execute procedure accounts.trigger_set_timestamps();

alter table public.sales_lens_summaries enable row level security;
alter table public.sales_lens_slots enable row level security;
alter table public.sales_lens_stakeholders enable row level security;
alter table public.sales_lens_hygiene_events enable row level security;

create policy "Account members can manage sales lens summaries" on public.sales_lens_summaries
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can manage sales lens slots" on public.sales_lens_slots
  using (
    summary_id in (
      select id from public.sales_lens_summaries
      where account_id in (select accounts.get_accounts_with_role())
    )
  )
  with check (
    summary_id in (
      select id from public.sales_lens_summaries
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Account members can manage sales lens stakeholders" on public.sales_lens_stakeholders
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can manage sales lens hygiene events" on public.sales_lens_hygiene_events
  using (
    summary_id in (
      select id from public.sales_lens_summaries
      where account_id in (select accounts.get_accounts_with_role())
    )
  )
  with check (
    summary_id in (
      select id from public.sales_lens_summaries
      where account_id in (select accounts.get_accounts_with_role())
    )
  );
