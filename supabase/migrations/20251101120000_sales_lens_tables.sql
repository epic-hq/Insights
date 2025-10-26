create type if not exists sales_framework as enum ('BANT_GPCT','SPICED','MEDDIC','MAP');

create table public.sales_lens_summaries (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null,
    project_id uuid not null,
    opportunity_id uuid,
    interview_id uuid,
    framework sales_framework not null,
    source_kind text not null default 'interview',
    attendee_person_ids uuid[] not null default '{}',
    attendee_person_keys text[] not null default '{}',
    attendee_unlinked jsonb not null default '[]'::jsonb,
    hygiene_summary jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    computed_at timestamptz not null default now(),
    computed_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.sales_lens_summaries enable row level security;

create table public.sales_lens_slots (
    id uuid primary key default gen_random_uuid(),
    summary_id uuid not null,
    slot text not null,
    label text,
    description text,
    text_value text,
    numeric_value numeric,
    date_value date,
    status text,
    confidence numeric,
    owner_person_id uuid,
    owner_person_key text,
    related_person_ids uuid[] not null default '{}',
    related_organization_ids uuid[] not null default '{}',
    evidence_refs jsonb not null default '[]'::jsonb,
    hygiene jsonb not null default '[]'::jsonb,
    position integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.sales_lens_stakeholders (
    id uuid primary key default gen_random_uuid(),
    summary_id uuid not null,
    account_id uuid not null,
    project_id uuid not null,
    person_id uuid,
    person_key text,
    candidate_person_key text,
    display_name text not null,
    role text,
    influence text check (influence in ('low','medium','high')) default 'low',
    labels text[] not null default '{}',
    organization_id uuid,
    email text,
    confidence numeric,
    evidence_refs jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.sales_lens_slots enable row level security;

alter table public.sales_lens_stakeholders enable row level security;

create table public.sales_lens_hygiene_events (
    id uuid primary key default gen_random_uuid(),
    summary_id uuid not null,
    slot_id uuid,
    code text not null,
    severity text check (severity in ('info','warning','critical')),
    message text,
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    created_by uuid,
    resolved_by uuid
);

alter table public.sales_lens_hygiene_events enable row level security;

create policy "account members can manage sales lens summaries" on public.sales_lens_summaries
    using (account_id in (select accounts.get_accounts_with_role()))
    with check (account_id in (select accounts.get_accounts_with_role()));

create policy "account members can manage sales lens slots" on public.sales_lens_slots
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

create policy "account members can manage sales lens stakeholders" on public.sales_lens_stakeholders
    using (account_id in (select accounts.get_accounts_with_role()))
    with check (account_id in (select accounts.get_accounts_with_role()));

create policy "account members can manage sales lens hygiene events" on public.sales_lens_hygiene_events
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

create unique index sales_lens_summaries_interview_framework_unique
    on public.sales_lens_summaries (framework, interview_id)
    where interview_id is not null;

create index sales_lens_summaries_project_id_idx
    on public.sales_lens_summaries (project_id, framework);

create index sales_lens_summaries_opportunity_idx
    on public.sales_lens_summaries (opportunity_id)
    where opportunity_id is not null;

create index sales_lens_slots_summary_idx
    on public.sales_lens_slots (summary_id);

create index sales_lens_slots_owner_idx
    on public.sales_lens_slots (owner_person_id)
    where owner_person_id is not null;

create index sales_lens_stakeholders_summary_idx
    on public.sales_lens_stakeholders (summary_id);

create index sales_lens_stakeholders_person_idx
    on public.sales_lens_stakeholders (person_id)
    where person_id is not null;

create index sales_lens_stakeholders_person_key_idx
    on public.sales_lens_stakeholders (person_key)
    where person_key is not null;

create index sales_lens_hygiene_events_summary_idx
    on public.sales_lens_hygiene_events (summary_id);

create index sales_lens_stakeholders_account_idx
    on public.sales_lens_stakeholders (account_id, project_id);

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

alter table public.sales_lens_summaries
    add constraint sales_lens_summaries_account_id_fkey
        foreign key (account_id) references accounts.accounts(id) on delete cascade not valid;
alter table public.sales_lens_summaries validate constraint sales_lens_summaries_account_id_fkey;

alter table public.sales_lens_summaries
    add constraint sales_lens_summaries_project_id_fkey
        foreign key (project_id) references projects(id) on delete cascade not valid;
alter table public.sales_lens_summaries validate constraint sales_lens_summaries_project_id_fkey;

alter table public.sales_lens_summaries
    add constraint sales_lens_summaries_opportunity_id_fkey
        foreign key (opportunity_id) references opportunities(id) on delete set null not valid;
alter table public.sales_lens_summaries validate constraint sales_lens_summaries_opportunity_id_fkey;

alter table public.sales_lens_summaries
    add constraint sales_lens_summaries_interview_id_fkey
        foreign key (interview_id) references interviews(id) on delete cascade not valid;
alter table public.sales_lens_summaries validate constraint sales_lens_summaries_interview_id_fkey;

alter table public.sales_lens_summaries
    add constraint sales_lens_summaries_computed_by_fkey
        foreign key (computed_by) references auth.users(id) on delete set null;

alter table public.sales_lens_slots
    add constraint sales_lens_slots_summary_id_fkey
        foreign key (summary_id) references public.sales_lens_summaries(id) on delete cascade not valid;
alter table public.sales_lens_slots validate constraint sales_lens_slots_summary_id_fkey;

alter table public.sales_lens_stakeholders
    add constraint sales_lens_stakeholders_summary_id_fkey
        foreign key (summary_id) references public.sales_lens_summaries(id) on delete cascade not valid;
alter table public.sales_lens_stakeholders validate constraint sales_lens_stakeholders_summary_id_fkey;

alter table public.sales_lens_stakeholders
    add constraint sales_lens_stakeholders_account_id_fkey
        foreign key (account_id) references accounts.accounts(id) on delete cascade not valid;
alter table public.sales_lens_stakeholders validate constraint sales_lens_stakeholders_account_id_fkey;

alter table public.sales_lens_stakeholders
    add constraint sales_lens_stakeholders_project_id_fkey
        foreign key (project_id) references projects(id) on delete cascade not valid;
alter table public.sales_lens_stakeholders validate constraint sales_lens_stakeholders_project_id_fkey;

alter table public.sales_lens_stakeholders
    add constraint sales_lens_stakeholders_person_id_fkey
        foreign key (person_id) references public.people(id) on delete set null not valid;
alter table public.sales_lens_stakeholders validate constraint sales_lens_stakeholders_person_id_fkey;

alter table public.sales_lens_stakeholders
    add constraint sales_lens_stakeholders_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete set null not valid;
alter table public.sales_lens_stakeholders validate constraint sales_lens_stakeholders_organization_id_fkey;

alter table public.sales_lens_slots
    add constraint sales_lens_slots_owner_person_id_fkey
        foreign key (owner_person_id) references public.people(id) on delete set null not valid;
alter table public.sales_lens_slots validate constraint sales_lens_slots_owner_person_id_fkey;

alter table public.sales_lens_slots
    add constraint sales_lens_slots_related_person_ids_project_check
        check (related_person_ids is null or array_length(related_person_ids, 1) is null or true);

alter table public.sales_lens_hygiene_events
    add constraint sales_lens_hygiene_events_summary_id_fkey
        foreign key (summary_id) references public.sales_lens_summaries(id) on delete cascade not valid;
alter table public.sales_lens_hygiene_events validate constraint sales_lens_hygiene_events_summary_id_fkey;

alter table public.sales_lens_hygiene_events
    add constraint sales_lens_hygiene_events_slot_id_fkey
        foreign key (slot_id) references public.sales_lens_slots(id) on delete cascade not valid;
alter table public.sales_lens_hygiene_events validate constraint sales_lens_hygiene_events_slot_id_fkey;

alter table public.sales_lens_hygiene_events
    add constraint sales_lens_hygiene_events_created_by_fkey
        foreign key (created_by) references auth.users(id) on delete set null;

alter table public.sales_lens_hygiene_events
    add constraint sales_lens_hygiene_events_resolved_by_fkey
        foreign key (resolved_by) references auth.users(id) on delete set null;

grant select, insert, update, delete on table public.sales_lens_summaries to authenticated, service_role;
grant references on table public.sales_lens_summaries to authenticated, service_role;

grant select, insert, update, delete on table public.sales_lens_slots to authenticated, service_role;
grant references on table public.sales_lens_slots to authenticated, service_role;

grant select, insert, update, delete on table public.sales_lens_stakeholders to authenticated, service_role;
grant references on table public.sales_lens_stakeholders to authenticated, service_role;

grant select, insert, update, delete on table public.sales_lens_hygiene_events to authenticated, service_role;
grant references on table public.sales_lens_hygiene_events to authenticated, service_role;
