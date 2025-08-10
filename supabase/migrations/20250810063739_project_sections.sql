create table "public"."project_section_kinds" (
    "id" text not null
);


alter table "public"."project_section_kinds" enable row level security;

create table "public"."project_sections" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "kind" text not null,
    "content_md" text not null,
    "meta" jsonb,
    "position" integer,
    "content_tsv" tsvector generated always as (to_tsvector('english'::regconfig, COALESCE(content_md, ''::text))) stored,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."project_sections" enable row level security;

alter table "public"."projects" drop column "background";

alter table "public"."projects" drop column "findings";

alter table "public"."projects" drop column "goal";

alter table "public"."projects" drop column "questions";

CREATE INDEX idx_project_sections_content_tsv ON public.project_sections USING gin (content_tsv);

CREATE INDEX idx_project_sections_project_kind_created_at ON public.project_sections USING btree (project_id, kind, created_at DESC);

CREATE INDEX idx_project_sections_project_position_created_at ON public.project_sections USING btree (project_id, COALESCE("position", 2147483647), created_at DESC);

CREATE UNIQUE INDEX project_section_kinds_pkey ON public.project_section_kinds USING btree (id);

CREATE UNIQUE INDEX project_sections_pkey ON public.project_sections USING btree (id);

alter table "public"."project_section_kinds" add constraint "project_section_kinds_pkey" PRIMARY KEY using index "project_section_kinds_pkey";

alter table "public"."project_sections" add constraint "project_sections_pkey" PRIMARY KEY using index "project_sections_pkey";

alter table "public"."project_sections" add constraint "project_sections_kind_fkey" FOREIGN KEY (kind) REFERENCES project_section_kinds(id) ON UPDATE CASCADE not valid;

alter table "public"."project_sections" validate constraint "project_sections_kind_fkey";

alter table "public"."project_sections" add constraint "project_sections_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_sections" validate constraint "project_sections_project_id_fkey";

set check_function_bodies = off;

create or replace view "public"."project_sections_latest" as  SELECT DISTINCT ON (project_id, kind) id,
    project_id,
    kind,
    content_md,
    meta,
    "position",
    content_tsv,
    created_at,
    updated_at
   FROM project_sections
  ORDER BY project_id, kind, created_at DESC;


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end; $function$
;

grant delete on table "public"."project_section_kinds" to "anon";

grant insert on table "public"."project_section_kinds" to "anon";

grant references on table "public"."project_section_kinds" to "anon";

grant select on table "public"."project_section_kinds" to "anon";

grant trigger on table "public"."project_section_kinds" to "anon";

grant truncate on table "public"."project_section_kinds" to "anon";

grant update on table "public"."project_section_kinds" to "anon";

grant delete on table "public"."project_section_kinds" to "authenticated";

grant insert on table "public"."project_section_kinds" to "authenticated";

grant references on table "public"."project_section_kinds" to "authenticated";

grant select on table "public"."project_section_kinds" to "authenticated";

grant trigger on table "public"."project_section_kinds" to "authenticated";

grant truncate on table "public"."project_section_kinds" to "authenticated";

grant update on table "public"."project_section_kinds" to "authenticated";

grant delete on table "public"."project_section_kinds" to "service_role";

grant insert on table "public"."project_section_kinds" to "service_role";

grant references on table "public"."project_section_kinds" to "service_role";

grant select on table "public"."project_section_kinds" to "service_role";

grant trigger on table "public"."project_section_kinds" to "service_role";

grant truncate on table "public"."project_section_kinds" to "service_role";

grant update on table "public"."project_section_kinds" to "service_role";

grant delete on table "public"."project_sections" to "anon";

grant insert on table "public"."project_sections" to "anon";

grant references on table "public"."project_sections" to "anon";

grant select on table "public"."project_sections" to "anon";

grant trigger on table "public"."project_sections" to "anon";

grant truncate on table "public"."project_sections" to "anon";

grant update on table "public"."project_sections" to "anon";

grant delete on table "public"."project_sections" to "authenticated";

grant insert on table "public"."project_sections" to "authenticated";

grant references on table "public"."project_sections" to "authenticated";

grant select on table "public"."project_sections" to "authenticated";

grant trigger on table "public"."project_sections" to "authenticated";

grant truncate on table "public"."project_sections" to "authenticated";

grant update on table "public"."project_sections" to "authenticated";

grant delete on table "public"."project_sections" to "service_role";

grant insert on table "public"."project_sections" to "service_role";

grant references on table "public"."project_sections" to "service_role";

grant select on table "public"."project_sections" to "service_role";

grant trigger on table "public"."project_sections" to "service_role";

grant truncate on table "public"."project_sections" to "service_role";

grant update on table "public"."project_sections" to "service_role";

create policy "Admin write kinds"
on "public"."project_section_kinds"
as permissive
for all
to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));


create policy "Read kinds"
on "public"."project_section_kinds"
as permissive
for select
to public
using (true);


create policy "Account members can delete sections"
on "public"."project_sections"
as permissive
for delete
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_sections.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can insert sections"
on "public"."project_sections"
as permissive
for insert
to public
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_sections.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read sections"
on "public"."project_sections"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_sections.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can update sections"
on "public"."project_sections"
as permissive
for update
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_sections.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_sections.project_id) AND (au.user_id = auth.uid()))))));


CREATE TRIGGER trg_project_sections_updated_at BEFORE UPDATE ON public.project_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();


