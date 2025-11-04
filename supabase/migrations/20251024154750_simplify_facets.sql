drop trigger if exists "set_facet_candidate_timestamp" on "public"."facet_candidate";

drop trigger if exists "set_facet_candidate_user_tracking" on "public"."facet_candidate";

drop trigger if exists "set_project_facet_timestamp" on "public"."project_facet";

drop trigger if exists "set_project_facet_user_tracking" on "public"."project_facet";

drop policy "Account members can insert" on "public"."facet_candidate";

drop policy "Account members can select" on "public"."facet_candidate";

drop policy "Account members can update" on "public"."facet_candidate";

drop policy "Account owners can delete" on "public"."facet_candidate";

drop policy "Account members can insert" on "public"."project_facet";

drop policy "Account members can select" on "public"."project_facet";

drop policy "Account members can update" on "public"."project_facet";

drop policy "Account owners can delete" on "public"."project_facet";

revoke delete on table "public"."facet_candidate" from "anon";

revoke insert on table "public"."facet_candidate" from "anon";

revoke references on table "public"."facet_candidate" from "anon";

revoke select on table "public"."facet_candidate" from "anon";

revoke trigger on table "public"."facet_candidate" from "anon";

revoke truncate on table "public"."facet_candidate" from "anon";

revoke update on table "public"."facet_candidate" from "anon";

revoke delete on table "public"."facet_candidate" from "authenticated";

revoke insert on table "public"."facet_candidate" from "authenticated";

revoke references on table "public"."facet_candidate" from "authenticated";

revoke select on table "public"."facet_candidate" from "authenticated";

revoke trigger on table "public"."facet_candidate" from "authenticated";

revoke truncate on table "public"."facet_candidate" from "authenticated";

revoke update on table "public"."facet_candidate" from "authenticated";

revoke delete on table "public"."facet_candidate" from "service_role";

revoke insert on table "public"."facet_candidate" from "service_role";

revoke references on table "public"."facet_candidate" from "service_role";

revoke select on table "public"."facet_candidate" from "service_role";

revoke trigger on table "public"."facet_candidate" from "service_role";

revoke truncate on table "public"."facet_candidate" from "service_role";

revoke update on table "public"."facet_candidate" from "service_role";

revoke delete on table "public"."project_facet" from "anon";

revoke insert on table "public"."project_facet" from "anon";

revoke references on table "public"."project_facet" from "anon";

revoke select on table "public"."project_facet" from "anon";

revoke trigger on table "public"."project_facet" from "anon";

revoke truncate on table "public"."project_facet" from "anon";

revoke update on table "public"."project_facet" from "anon";

revoke delete on table "public"."project_facet" from "authenticated";

revoke insert on table "public"."project_facet" from "authenticated";

revoke references on table "public"."project_facet" from "authenticated";

revoke select on table "public"."project_facet" from "authenticated";

revoke trigger on table "public"."project_facet" from "authenticated";

revoke truncate on table "public"."project_facet" from "authenticated";

revoke update on table "public"."project_facet" from "authenticated";

revoke delete on table "public"."project_facet" from "service_role";

revoke insert on table "public"."project_facet" from "service_role";

revoke references on table "public"."project_facet" from "service_role";

revoke select on table "public"."project_facet" from "service_role";

revoke trigger on table "public"."project_facet" from "service_role";

revoke truncate on table "public"."project_facet" from "service_role";

revoke update on table "public"."project_facet" from "service_role";

alter table "public"."evidence_facet" drop constraint "evidence_facet_ref_pattern";

alter table "public"."facet_candidate" drop constraint "facet_candidate_account_id_fkey";

alter table "public"."facet_candidate" drop constraint "facet_candidate_person_id_fkey";

alter table "public"."facet_candidate" drop constraint "facet_candidate_project_id_fkey";

alter table "public"."facet_candidate" drop constraint "facet_candidate_source_check";

alter table "public"."facet_candidate" drop constraint "facet_candidate_status_check";

alter table "public"."facet_candidate" drop constraint "facet_candidate_unique";

alter table "public"."person_facet" drop constraint "person_facet_candidate_id_fkey";

alter table "public"."person_facet" drop constraint "person_facet_ref_pattern";

alter table "public"."project_facet" drop constraint "project_facet_account_id_fkey";

alter table "public"."project_facet" drop constraint "project_facet_project_id_fkey";

alter table "public"."project_facet" drop constraint "project_facet_ref_pattern";

alter table "public"."project_facet" drop constraint "project_facet_scope_check";

alter table "public"."interview_prompts" drop constraint "interview_prompts_status_check";

alter table "public"."facet_candidate" drop constraint "facet_candidate_pkey";

alter table "public"."project_facet" drop constraint "project_facet_pkey";

alter table "public"."person_facet" drop constraint "person_facet_pkey";

drop index if exists "public"."facet_candidate_pkey";

drop index if exists "public"."facet_candidate_unique";

drop index if exists "public"."idx_facet_candidate_account";

drop index if exists "public"."idx_facet_candidate_project";

drop index if exists "public"."idx_project_facet_account";

drop index if exists "public"."project_facet_pkey";

drop index if exists "public"."person_facet_pkey";

drop table "public"."facet_candidate";

drop table "public"."project_facet";

-- Add facet_account_id columns as NULLABLE first
alter table "public"."evidence_facet" add column if not exists "facet_account_id" integer;
alter table "public"."person_facet" add column if not exists "facet_account_id" integer;

-- Migrate data from facet_ref to facet_account_id
-- Extract the numeric ID from strings like "a:123" -> 123
update "public"."evidence_facet"
set facet_account_id = split_part(facet_ref, ':', 2)::integer
where facet_ref like 'a:%' 
  and facet_account_id is null
  and split_part(facet_ref, ':', 2) ~ '^[0-9]+$';  -- Only if it's a valid integer

update "public"."person_facet"
set facet_account_id = split_part(facet_ref, ':', 2)::integer
where facet_ref like 'a:%' 
  and facet_account_id is null
  and split_part(facet_ref, ':', 2) ~ '^[0-9]+$';  -- Only if it's a valid integer

-- Log what will be deleted (for safety)
do $$
declare
  evidence_delete_count int;
  person_delete_count int;
begin
  select count(*) into evidence_delete_count from "public"."evidence_facet" where facet_account_id is null;
  select count(*) into person_delete_count from "public"."person_facet" where facet_account_id is null;
  
  raise notice 'Will delete % evidence_facet rows with null facet_account_id', evidence_delete_count;
  raise notice 'Will delete % person_facet rows with null facet_account_id', person_delete_count;
end $$;

-- Delete rows that couldn't be migrated
-- These are legacy global/project facets (g:, p:) or null refs being removed
delete from "public"."evidence_facet" where facet_account_id is null;
delete from "public"."person_facet" where facet_account_id is null;

-- Now drop the old columns
alter table "public"."evidence_facet" drop column "facet_ref";
alter table "public"."person_facet" drop column "candidate_id";
alter table "public"."person_facet" drop column "facet_ref";

-- Set NOT NULL constraint after data is migrated
alter table "public"."evidence_facet" alter column "facet_account_id" set not null;
alter table "public"."person_facet" alter column "facet_account_id" set not null;

-- Add is_active column to facet_account
alter table "public"."facet_account" add column "is_active" boolean not null default true;

CREATE INDEX idx_evidence_facet_facet_account_id ON public.evidence_facet USING btree (facet_account_id);

CREATE INDEX idx_person_facet_facet_account ON public.person_facet USING btree (facet_account_id);

CREATE UNIQUE INDEX person_facet_pkey ON public.person_facet USING btree (person_id, facet_account_id);

alter table "public"."person_facet" add constraint "person_facet_pkey" PRIMARY KEY using index "person_facet_pkey";

alter table "public"."evidence_facet" add constraint "evidence_facet_facet_account_id_fkey" FOREIGN KEY (facet_account_id) REFERENCES facet_account(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_facet_account_id_fkey";

alter table "public"."person_facet" add constraint "person_facet_facet_account_id_fkey" FOREIGN KEY (facet_account_id) REFERENCES facet_account(id) ON DELETE CASCADE not valid;

alter table "public"."person_facet" validate constraint "person_facet_facet_account_id_fkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_status_check" CHECK ((status = ANY (ARRAY['proposed'::text, 'asked'::text, 'answered'::text, 'skipped'::text, 'rejected'::text, 'deleted'::text, 'selected'::text, 'backup'::text]))) not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_status_check";


