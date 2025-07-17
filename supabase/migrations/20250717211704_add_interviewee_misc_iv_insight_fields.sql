drop materialized view if exists "public"."theme_counts_mv";

create table "public"."interviewee" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "interview_id" uuid,
    "name" text,
    "persona" text,
    "participant_description" text,
    "segment" text,
    "contact_info" jsonb,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."insights" add column "details" text;

alter table "public"."insights" add column "related_tags" text[];

alter table "public"."interviews" add column "high_impact_themes" text[];

alter table "public"."interviews" add column "observations_and_notes" text;

alter table "public"."interviews" add column "open_questions_and_next_steps" text;

alter table "public"."interviews" add column "persona_snapshot" text;

alter table "public"."media_files" add column "url" text;

CREATE UNIQUE INDEX interviewee_pkey ON public.interviewee USING btree (id);

alter table "public"."interviewee" add constraint "interviewee_pkey" PRIMARY KEY using index "interviewee_pkey";

alter table "public"."interviewee" add constraint "interviewee_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL not valid;

alter table "public"."interviewee" validate constraint "interviewee_interview_id_fkey";

alter table "public"."interviewee" add constraint "interviewee_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."interviewee" validate constraint "interviewee_org_id_fkey";

create materialized view "public"."theme_counts_mv" as  SELECT t.id AS theme_id,
    t.name,
    count(*) AS insight_count
   FROM (themes t
     LEFT JOIN insights i ON (((i.category = t.name) AND (i.org_id = t.org_id))))
  GROUP BY t.id, t.name;


grant delete on table "public"."interviewee" to "anon";

grant insert on table "public"."interviewee" to "anon";

grant references on table "public"."interviewee" to "anon";

grant select on table "public"."interviewee" to "anon";

grant trigger on table "public"."interviewee" to "anon";

grant truncate on table "public"."interviewee" to "anon";

grant update on table "public"."interviewee" to "anon";

grant delete on table "public"."interviewee" to "authenticated";

grant insert on table "public"."interviewee" to "authenticated";

grant references on table "public"."interviewee" to "authenticated";

grant select on table "public"."interviewee" to "authenticated";

grant trigger on table "public"."interviewee" to "authenticated";

grant truncate on table "public"."interviewee" to "authenticated";

grant update on table "public"."interviewee" to "authenticated";

grant delete on table "public"."interviewee" to "service_role";

grant insert on table "public"."interviewee" to "service_role";

grant references on table "public"."interviewee" to "service_role";

grant select on table "public"."interviewee" to "service_role";

grant trigger on table "public"."interviewee" to "service_role";

grant truncate on table "public"."interviewee" to "service_role";

grant update on table "public"."interviewee" to "service_role";


