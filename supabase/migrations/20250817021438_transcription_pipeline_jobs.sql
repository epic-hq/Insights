create type "public"."job_status" as enum ('pending', 'in_progress', 'done', 'error', 'retry');

drop view if exists "public"."persona_distribution";


  create table "public"."analysis_jobs" (
    "id" uuid not null default gen_random_uuid(),
    "interview_id" uuid not null,
    "transcript_data" jsonb not null,
    "custom_instructions" text,
    "progress" integer default 0,
    "attempts" integer default 0,
    "last_error" text,
    "status" job_status not null default 'pending'::job_status,
    "status_detail" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."analysis_jobs" enable row level security;


  create table "public"."upload_jobs" (
    "id" uuid not null default gen_random_uuid(),
    "interview_id" uuid not null,
    "file_name" text,
    "file_type" text,
    "external_url" text,
    "assemblyai_id" text,
    "attempts" integer default 0,
    "last_error" text,
    "status" job_status not null default 'pending'::job_status,
    "status_detail" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."upload_jobs" enable row level security;

CREATE UNIQUE INDEX analysis_jobs_pkey ON public.analysis_jobs USING btree (id);

CREATE INDEX idx_analysis_jobs_status_created ON public.analysis_jobs USING btree (status, created_at);

CREATE INDEX idx_upload_jobs_assemblyai_id ON public.upload_jobs USING btree (assemblyai_id);

CREATE INDEX idx_upload_jobs_status_created ON public.upload_jobs USING btree (status, created_at);

CREATE UNIQUE INDEX upload_jobs_pkey ON public.upload_jobs USING btree (id);

alter table "public"."analysis_jobs" add constraint "analysis_jobs_pkey" PRIMARY KEY using index "analysis_jobs_pkey";

alter table "public"."upload_jobs" add constraint "upload_jobs_pkey" PRIMARY KEY using index "upload_jobs_pkey";

alter table "public"."analysis_jobs" add constraint "analysis_jobs_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE not valid;

alter table "public"."analysis_jobs" validate constraint "analysis_jobs_interview_id_fkey";

alter table "public"."upload_jobs" add constraint "upload_jobs_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE not valid;

alter table "public"."upload_jobs" validate constraint "upload_jobs_interview_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.notify_analysis_job()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform pg_notify('analysis_jobs_channel', new.id::text);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_upload_job()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform pg_notify('upload_jobs_channel', new.id::text);
  return new;
end;
$function$
;

create or replace view "public"."persona_distribution" as  WITH persona_interview_counts AS (
         SELECT p.id AS persona_id,
            p.account_id,
            p.name AS persona_name,
            p.color_hex,
            p.description,
            p.created_at,
            p.updated_at,
            count(DISTINCT i.id) AS interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM (interviews i_total
                     JOIN interview_people ip_total ON ((ip_total.interview_id = i_total.id)))
                  WHERE (i_total.account_id = p.account_id)) AS total_interviews_with_participants
           FROM (((personas p
             LEFT JOIN people_personas pp ON ((pp.persona_id = p.id)))
             LEFT JOIN interview_people ip ON ((ip.person_id = pp.person_id)))
             LEFT JOIN interviews i ON (((i.id = ip.interview_id) AND (i.account_id = p.account_id))))
          GROUP BY p.id, p.account_id, p.name, p.color_hex, p.description, p.created_at, p.updated_at
        ), legacy_fallback_counts AS (
         SELECT p.id AS persona_id,
            count(DISTINCT i_legacy.id) AS legacy_interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM interviews i_total
                  WHERE ((i_total.account_id = p.account_id) AND ((i_total.participant_pseudonym IS NOT NULL) OR (i_total.segment IS NOT NULL)) AND (NOT (EXISTS ( SELECT 1
                           FROM interview_people ip_check
                          WHERE (ip_check.interview_id = i_total.id)))))) AS total_legacy_interviews
           FROM (personas p
             LEFT JOIN interviews i_legacy ON (((i_legacy.account_id = p.account_id) AND ((i_legacy.participant_pseudonym = p.name) OR (i_legacy.segment = p.name)) AND (NOT (EXISTS ( SELECT 1
                   FROM interview_people ip_check
                  WHERE (ip_check.interview_id = i_legacy.id)))))))
          GROUP BY p.id, p.account_id
        )
 SELECT pic.persona_id,
    pic.account_id,
    pic.persona_name,
    pic.color_hex,
    pic.description,
    pic.created_at,
    pic.updated_at,
    pic.interview_count,
    pic.total_interviews_with_participants,
        CASE
            WHEN (pic.total_interviews_with_participants > 0) THEN round((((pic.interview_count)::numeric / (pic.total_interviews_with_participants)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS interview_percentage,
    lfc.legacy_interview_count,
    lfc.total_legacy_interviews,
        CASE
            WHEN (lfc.total_legacy_interviews > 0) THEN round((((lfc.legacy_interview_count)::numeric / (lfc.total_legacy_interviews)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS legacy_percentage,
    (pic.interview_count + lfc.legacy_interview_count) AS total_interview_count,
    (pic.total_interviews_with_participants + lfc.total_legacy_interviews) AS total_interviews,
        CASE
            WHEN ((pic.total_interviews_with_participants + lfc.total_legacy_interviews) > 0) THEN round(((((pic.interview_count + lfc.legacy_interview_count))::numeric / ((pic.total_interviews_with_participants + lfc.total_legacy_interviews))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS combined_percentage
   FROM (persona_interview_counts pic
     JOIN legacy_fallback_counts lfc ON ((pic.persona_id = lfc.persona_id)))
  ORDER BY pic.account_id, (pic.interview_count + lfc.legacy_interview_count) DESC;


CREATE OR REPLACE FUNCTION public.upsert_signup_data(p_user_id uuid, p_signup_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
    -- Insert or update user_settings with signup_data
    insert into user_settings (user_id, signup_data)
    values (p_user_id, p_signup_data)
    on conflict (user_id) 
    do update set 
        signup_data = coalesce(user_settings.signup_data, '{}'::jsonb) || excluded.signup_data,
        updated_at = now();
end;
$function$
;

grant delete on table "public"."analysis_jobs" to "anon";

grant insert on table "public"."analysis_jobs" to "anon";

grant references on table "public"."analysis_jobs" to "anon";

grant select on table "public"."analysis_jobs" to "anon";

grant trigger on table "public"."analysis_jobs" to "anon";

grant truncate on table "public"."analysis_jobs" to "anon";

grant update on table "public"."analysis_jobs" to "anon";

grant delete on table "public"."analysis_jobs" to "authenticated";

grant insert on table "public"."analysis_jobs" to "authenticated";

grant references on table "public"."analysis_jobs" to "authenticated";

grant select on table "public"."analysis_jobs" to "authenticated";

grant trigger on table "public"."analysis_jobs" to "authenticated";

grant truncate on table "public"."analysis_jobs" to "authenticated";

grant update on table "public"."analysis_jobs" to "authenticated";

grant delete on table "public"."analysis_jobs" to "service_role";

grant insert on table "public"."analysis_jobs" to "service_role";

grant references on table "public"."analysis_jobs" to "service_role";

grant select on table "public"."analysis_jobs" to "service_role";

grant trigger on table "public"."analysis_jobs" to "service_role";

grant truncate on table "public"."analysis_jobs" to "service_role";

grant update on table "public"."analysis_jobs" to "service_role";

grant delete on table "public"."upload_jobs" to "anon";

grant insert on table "public"."upload_jobs" to "anon";

grant references on table "public"."upload_jobs" to "anon";

grant select on table "public"."upload_jobs" to "anon";

grant trigger on table "public"."upload_jobs" to "anon";

grant truncate on table "public"."upload_jobs" to "anon";

grant update on table "public"."upload_jobs" to "anon";

grant delete on table "public"."upload_jobs" to "authenticated";

grant insert on table "public"."upload_jobs" to "authenticated";

grant references on table "public"."upload_jobs" to "authenticated";

grant select on table "public"."upload_jobs" to "authenticated";

grant trigger on table "public"."upload_jobs" to "authenticated";

grant truncate on table "public"."upload_jobs" to "authenticated";

grant update on table "public"."upload_jobs" to "authenticated";

grant delete on table "public"."upload_jobs" to "service_role";

grant insert on table "public"."upload_jobs" to "service_role";

grant references on table "public"."upload_jobs" to "service_role";

grant select on table "public"."upload_jobs" to "service_role";

grant trigger on table "public"."upload_jobs" to "service_role";

grant truncate on table "public"."upload_jobs" to "service_role";

grant update on table "public"."upload_jobs" to "service_role";


  create policy "Users can insert analysis jobs for their interviews"
  on "public"."analysis_jobs"
  as permissive
  for insert
  to public
with check ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id = auth.uid()))));



  create policy "Users can update analysis jobs for their interviews"
  on "public"."analysis_jobs"
  as permissive
  for update
  to public
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id = auth.uid()))));



  create policy "Users can view analysis jobs for their interviews"
  on "public"."analysis_jobs"
  as permissive
  for select
  to public
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id = auth.uid()))));



  create policy "Users can insert upload jobs for their interviews"
  on "public"."upload_jobs"
  as permissive
  for insert
  to public
with check ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id = auth.uid()))));



  create policy "Users can update upload jobs for their interviews"
  on "public"."upload_jobs"
  as permissive
  for update
  to public
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id = auth.uid()))));



  create policy "Users can view upload jobs for their interviews"
  on "public"."upload_jobs"
  as permissive
  for select
  to public
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id = auth.uid()))));


CREATE TRIGGER analysis_job_notify AFTER INSERT ON public.analysis_jobs FOR EACH ROW EXECUTE FUNCTION notify_analysis_job();

CREATE TRIGGER set_analysis_jobs_timestamp BEFORE INSERT OR UPDATE ON public.analysis_jobs FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_upload_jobs_timestamp BEFORE INSERT OR UPDATE ON public.upload_jobs FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER upload_job_notify AFTER INSERT ON public.upload_jobs FOR EACH ROW EXECUTE FUNCTION notify_upload_job();


