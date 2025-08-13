drop extension if exists "http";

drop function if exists "pgmq_public"."archive"(queue_name text, message_id bigint);

drop function if exists "pgmq_public"."delete"(queue_name text, message_id bigint);

drop function if exists "pgmq_public"."send"(queue_name text, message jsonb, sleep_seconds integer);

drop function if exists "pgmq_public"."send_batch"(queue_name text, messages jsonb[], sleep_seconds integer);

drop view if exists "public"."persona_distribution";

alter table "public"."user_settings" add column "company_name" text;

alter table "public"."user_settings" add column "email" text;

alter table "public"."user_settings" add column "first_name" text;

alter table "public"."user_settings" add column "image_url" text;

alter table "public"."user_settings" add column "industry" text;

alter table "public"."user_settings" add column "last_name" text;

alter table "public"."user_settings" add column "metadata" jsonb;

alter table "public"."user_settings" add column "mobile_phone" text;

alter table "public"."user_settings" add column "referral_source" text;

alter table "public"."user_settings" add column "role" text;

alter table "public"."user_settings" add column "signup_data" jsonb;

alter table "public"."user_settings" add column "title" text;

alter table "public"."user_settings" add column "trial_goals" jsonb;

set check_function_bodies = off;

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

drop schema if exists "pgmq_public";


