alter table "public"."interview_prompts" drop constraint "interview_prompts_status_check";

create table "public"."organizations" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid,
    "project_id" uuid,
    "name" text not null,
    "legal_name" text,
    "description" text,
    "industry" text,
    "sub_industry" text,
    "company_type" text,
    "size_range" text,
    "employee_count" integer,
    "annual_revenue" numeric,
    "phone" text,
    "email" text,
    "website_url" text,
    "linkedin_url" text,
    "twitter_url" text,
    "domain" text,
    "headquarters_location" text,
    "billing_address" jsonb,
    "shipping_address" jsonb,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."organizations" enable row level security;

create table "public"."people_organizations" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid,
    "project_id" uuid,
    "person_id" uuid not null,
    "organization_id" uuid not null,
    "role" text,
    "relationship_status" text,
    "is_primary" boolean default false,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."people_organizations" enable row level security;

CREATE INDEX idx_organizations_account_id ON public.organizations USING btree (account_id);

CREATE INDEX idx_organizations_project_id ON public.organizations USING btree (project_id);

CREATE INDEX idx_people_organizations_account_id ON public.people_organizations USING btree (account_id);

CREATE INDEX idx_people_organizations_org_id ON public.people_organizations USING btree (organization_id);

CREATE INDEX idx_people_organizations_person_id ON public.people_organizations USING btree (person_id);

CREATE INDEX idx_people_organizations_project_id ON public.people_organizations USING btree (project_id);

CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);

CREATE UNIQUE INDEX people_organizations_person_org_unique ON public.people_organizations USING btree (person_id, organization_id);

CREATE UNIQUE INDEX people_organizations_pkey ON public.people_organizations USING btree (id);

CREATE UNIQUE INDEX uniq_organizations_account_lower_name ON public.organizations USING btree (account_id, lower(name));

alter table "public"."organizations" add constraint "organizations_pkey" PRIMARY KEY using index "organizations_pkey";

alter table "public"."people_organizations" add constraint "people_organizations_pkey" PRIMARY KEY using index "people_organizations_pkey";

alter table "public"."organizations" add constraint "organizations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."organizations" validate constraint "organizations_account_id_fkey";

alter table "public"."organizations" add constraint "organizations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."organizations" validate constraint "organizations_project_id_fkey";

alter table "public"."people_organizations" add constraint "people_organizations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."people_organizations" validate constraint "people_organizations_account_id_fkey";

alter table "public"."people_organizations" add constraint "people_organizations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."people_organizations" validate constraint "people_organizations_organization_id_fkey";

alter table "public"."people_organizations" add constraint "people_organizations_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE not valid;

alter table "public"."people_organizations" validate constraint "people_organizations_person_id_fkey";

alter table "public"."people_organizations" add constraint "people_organizations_person_org_unique" UNIQUE using index "people_organizations_person_org_unique";

alter table "public"."people_organizations" add constraint "people_organizations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."people_organizations" validate constraint "people_organizations_project_id_fkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_status_check" CHECK ((status = ANY (ARRAY['proposed'::text, 'asked'::text, 'answered'::text, 'skipped'::text, 'rejected'::text]))) not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_status_check";

grant delete on table "public"."organizations" to "anon";

grant insert on table "public"."organizations" to "anon";

grant references on table "public"."organizations" to "anon";

grant select on table "public"."organizations" to "anon";

grant trigger on table "public"."organizations" to "anon";

grant truncate on table "public"."organizations" to "anon";

grant update on table "public"."organizations" to "anon";

grant delete on table "public"."organizations" to "authenticated";

grant insert on table "public"."organizations" to "authenticated";

grant references on table "public"."organizations" to "authenticated";

grant select on table "public"."organizations" to "authenticated";

grant trigger on table "public"."organizations" to "authenticated";

grant truncate on table "public"."organizations" to "authenticated";

grant update on table "public"."organizations" to "authenticated";

grant delete on table "public"."organizations" to "service_role";

grant insert on table "public"."organizations" to "service_role";

grant references on table "public"."organizations" to "service_role";

grant select on table "public"."organizations" to "service_role";

grant trigger on table "public"."organizations" to "service_role";

grant truncate on table "public"."organizations" to "service_role";

grant update on table "public"."organizations" to "service_role";

grant delete on table "public"."people_organizations" to "anon";

grant insert on table "public"."people_organizations" to "anon";

grant references on table "public"."people_organizations" to "anon";

grant select on table "public"."people_organizations" to "anon";

grant trigger on table "public"."people_organizations" to "anon";

grant truncate on table "public"."people_organizations" to "anon";

grant update on table "public"."people_organizations" to "anon";

grant delete on table "public"."people_organizations" to "authenticated";

grant insert on table "public"."people_organizations" to "authenticated";

grant references on table "public"."people_organizations" to "authenticated";

grant select on table "public"."people_organizations" to "authenticated";

grant trigger on table "public"."people_organizations" to "authenticated";

grant truncate on table "public"."people_organizations" to "authenticated";

grant update on table "public"."people_organizations" to "authenticated";

grant delete on table "public"."people_organizations" to "service_role";

grant insert on table "public"."people_organizations" to "service_role";

grant references on table "public"."people_organizations" to "service_role";

grant select on table "public"."people_organizations" to "service_role";

grant trigger on table "public"."people_organizations" to "service_role";

grant truncate on table "public"."people_organizations" to "service_role";

grant update on table "public"."people_organizations" to "service_role";

create policy "Account members can insert"
on "public"."organizations"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."organizations"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."organizations"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."organizations"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."people_organizations"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."people_organizations"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."people_organizations"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."people_organizations"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


CREATE TRIGGER set_organizations_timestamp BEFORE INSERT OR UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_organizations_user_tracking BEFORE INSERT OR UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_people_organizations_timestamp BEFORE INSERT OR UPDATE ON public.people_organizations FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_people_organizations_user_tracking BEFORE INSERT OR UPDATE ON public.people_organizations FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


