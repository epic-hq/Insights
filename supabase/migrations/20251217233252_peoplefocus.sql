drop trigger if exists "update_lens_summaries_updated_at" on "public"."conversation_lens_summaries";

drop policy if exists "insights_read_only" on "public"."insights";

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

drop function if exists "public"."update_lens_summaries_timestamp"();

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

alter table "public"."people" add column "person_type" text;

alter table "public"."people" add column "user_id" uuid;

CREATE INDEX idx_people_user_id ON public.people USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE UNIQUE INDEX uniq_people_account_user ON public.people USING btree (account_id, user_id) WHERE (user_id IS NOT NULL);

alter table "public"."people" add constraint "people_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."people" validate constraint "people_user_id_fkey";

alter table "public"."actions" add constraint "actions_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_insight_id_fkey";

alter table "public"."comments" add constraint "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.insights(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" add constraint "opportunity_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_insights" validate constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" add constraint "persona_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."persona_insights" validate constraint "persona_insights_insight_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in interviews that have evidence linked to this theme
    -- Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
    FOR persona_record IN
        SELECT DISTINCT pp.persona_id, p.name as persona
        FROM themes t
        -- Link through theme_evidence junction to get to interviews
        JOIN theme_evidence te ON t.id = te.theme_id
        JOIN evidence e ON te.evidence_id = e.id
        JOIN interviews iv ON e.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN people_personas pp ON pe.id = pp.person_id
        JOIN personas p ON pp.persona_id = p.id AND pe.account_id = p.account_id
        WHERE t.id = p_insight_id
        AND pp.persona_id IS NOT NULL
    LOOP
        -- Calculate relevance score (simplified - could be more sophisticated)
        relevance_score_var := 1.0;

        -- Insert persona-insight link
        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW())
        ON CONFLICT (persona_id, insight_id) DO NOTHING;
    END LOOP;
END;
$function$
;

create or replace view "public"."conversations" as  SELECT id,
    account_id,
    project_id,
    title,
    interview_date,
    interviewer_id,
    key_takeaways,
    participant_pseudonym,
    segment,
    media_url,
    thumbnail_url,
    media_type,
    transcript,
    transcript_formatted,
    conversation_analysis,
    high_impact_themes,
    relevant_answers,
    open_questions_and_next_steps,
    observations_and_notes,
    source_type,
    interview_type,
    lens_visibility,
    file_extension,
    original_filename,
    person_id,
    duration_sec,
    status,
    interaction_context,
    context_confidence,
    context_reasoning,
    processing_metadata,
    created_at,
    updated_at,
    created_by,
    updated_by
   FROM public.interviews;


CREATE OR REPLACE FUNCTION public.get_account_invitations(account_id uuid, results_limit integer DEFAULT 25, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'account_role', i.account_role,
                                   'created_at', i.created_at,
                                   'invitation_type', i.invitation_type,
                                   'invitation_id', i.id,
                                   'email', i.invitee_email
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '24 hours'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_members(account_id uuid, results_limit integer DEFAULT 50, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts'
AS $function$
BEGIN

    -- any team member can view the member list
    if (select public.current_user_account_role(get_account_members.account_id) ->> 'account_role' IS NULL) then
        raise exception 'You must be a member of this account to view members';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'user_id', wu.user_id,
                                   'account_role', wu.account_role,
                                   'name', p.name,
                                   'email', u.email,
                                   'is_primary_owner', a.primary_owner_user_id = wu.user_id
                               )
                       )
            from accounts.account_user wu
                     join accounts.accounts a on a.id = wu.account_id
                     join accounts.accounts p on p.primary_owner_user_id = wu.user_id and p.personal_account = true
                     join auth.users u on u.id = wu.user_id
            where wu.account_id = get_account_members.account_id
            limit coalesce(get_account_members.results_limit, 50) offset coalesce(get_account_members.results_offset, 0));
END;
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
                   FROM (public.interviews i_total
                     JOIN public.interview_people ip_total ON ((ip_total.interview_id = i_total.id)))
                  WHERE (i_total.account_id = p.account_id)) AS total_interviews_with_participants
           FROM (((public.personas p
             LEFT JOIN public.people_personas pp ON ((pp.persona_id = p.id)))
             LEFT JOIN public.interview_people ip ON ((ip.person_id = pp.person_id)))
             LEFT JOIN public.interviews i ON (((i.id = ip.interview_id) AND (i.account_id = p.account_id))))
          GROUP BY p.id, p.account_id, p.name, p.color_hex, p.description, p.created_at, p.updated_at
        ), legacy_fallback_counts AS (
         SELECT p.id AS persona_id,
            count(DISTINCT i_legacy.id) AS legacy_interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM public.interviews i_total
                  WHERE ((i_total.account_id = p.account_id) AND ((i_total.participant_pseudonym IS NOT NULL) OR (i_total.segment IS NOT NULL)) AND (NOT (EXISTS ( SELECT 1
                           FROM public.interview_people ip_check
                          WHERE (ip_check.interview_id = i_total.id)))))) AS total_legacy_interviews
           FROM (public.personas p
             LEFT JOIN public.interviews i_legacy ON (((i_legacy.account_id = p.account_id) AND ((i_legacy.participant_pseudonym = p.name) OR (i_legacy.segment = p.name)) AND (NOT (EXISTS ( SELECT 1
                   FROM public.interview_people ip_check
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


create or replace view "public"."project_answer_metrics" as  SELECT pa.project_id,
    pa.id AS project_answer_id,
    pa.prompt_id,
    pa.research_question_id,
    pa.decision_question_id,
    pa.interview_id,
    pa.respondent_person_id,
    pa.status,
    pa.answered_at,
    COALESCE(count(e.id), (0)::bigint) AS evidence_count,
    COALESCE(count(DISTINCT COALESCE(e.interview_id, pa.interview_id)), (0)::bigint) AS interview_count,
    COALESCE(count(DISTINCT pp.persona_id), (0)::bigint) AS persona_count
   FROM ((public.project_answers pa
     LEFT JOIN public.evidence e ON ((e.project_answer_id = pa.id)))
     LEFT JOIN public.people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = pa.project_id))))
  GROUP BY pa.project_id, pa.id, pa.prompt_id, pa.research_question_id, pa.decision_question_id, pa.interview_id, pa.respondent_person_id, pa.status, pa.answered_at;


create or replace view "public"."research_question_summary" as  SELECT rq.project_id,
    rq.id AS research_question_id,
    rq.decision_question_id,
    rq.text AS research_question_text,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['answered'::text, 'ad_hoc'::text]))), (0)::bigint) AS answered_answer_count,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['planned'::text, 'asked'::text]))), (0)::bigint) AS open_answer_count,
    COALESCE(sum(m.evidence_count), (0)::numeric) AS evidence_count,
    COALESCE(count(DISTINCT pa.interview_id), (0)::bigint) AS interview_count,
    COALESCE(count(DISTINCT pp.persona_id), (0)::bigint) AS persona_count
   FROM (((public.research_questions rq
     LEFT JOIN public.project_answers pa ON ((pa.research_question_id = rq.id)))
     LEFT JOIN public.project_answer_metrics m ON ((m.project_answer_id = pa.id)))
     LEFT JOIN public.people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = rq.project_id))))
  GROUP BY rq.project_id, rq.id, rq.decision_question_id, rq.text;


create or replace view "public"."decision_question_summary" as  SELECT dq.project_id,
    dq.id AS decision_question_id,
    dq.text AS decision_question_text,
    COALESCE(count(DISTINCT rq.id), (0)::bigint) AS research_question_count,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['answered'::text, 'ad_hoc'::text]))), (0)::bigint) AS answered_answer_count,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['planned'::text, 'asked'::text]))), (0)::bigint) AS open_answer_count,
    COALESCE(sum(m.evidence_count), (0)::numeric) AS evidence_count,
    COALESCE(count(DISTINCT pa.interview_id), (0)::bigint) AS interview_count,
    COALESCE(count(DISTINCT pp.persona_id), (0)::bigint) AS persona_count
   FROM ((((public.decision_questions dq
     LEFT JOIN public.research_questions rq ON ((rq.decision_question_id = dq.id)))
     LEFT JOIN public.project_answers pa ON ((pa.decision_question_id = dq.id)))
     LEFT JOIN public.project_answer_metrics m ON ((m.project_answer_id = pa.id)))
     LEFT JOIN public.people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = dq.project_id))))
  GROUP BY dq.project_id, dq.id, dq.text;



  drop policy if exists "Users can create project assets for their accounts" on "public"."project_assets";
  create policy "Users can create project assets for their accounts"
  on "public"."project_assets"
  as permissive
  for insert
  to public
with check ((account_id IN ( SELECT account_user.account_id
   FROM accounts.account_user
  WHERE (account_user.user_id = auth.uid()))));



  drop policy if exists "Users can delete project assets for their accounts" on "public"."project_assets";
  create policy "Users can delete project assets for their accounts"
  on "public"."project_assets"
  as permissive
  for delete
  to public
using ((account_id IN ( SELECT account_user.account_id
   FROM accounts.account_user
  WHERE (account_user.user_id = auth.uid()))));



  drop policy if exists "Users can read project assets for their accounts" on "public"."project_assets";
  create policy "Users can read project assets for their accounts"
  on "public"."project_assets"
  as permissive
  for select
  to public
using ((account_id IN ( SELECT account_user.account_id
   FROM accounts.account_user
  WHERE (account_user.user_id = auth.uid()))));



  drop policy if exists "Users can update project assets for their accounts" on "public"."project_assets";
  create policy "Users can update project assets for their accounts"
  on "public"."project_assets"
  as permissive
  for update
  to public
using ((account_id IN ( SELECT account_user.account_id
   FROM accounts.account_user
  WHERE (account_user.user_id = auth.uid()))));

