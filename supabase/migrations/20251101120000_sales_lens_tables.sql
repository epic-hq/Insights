-- No-op placeholder: sales lens tables & policies defined earlier in 20251027074503_saleslens.sql

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
