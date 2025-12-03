drop trigger if exists "set_conversation_lens_analyses_timestamp" on "public"."conversation_lens_analyses";

drop trigger if exists "set_conversation_lens_templates_timestamp" on "public"."conversation_lens_templates";

drop policy "Account members can delete lens analyses" on "public"."conversation_lens_analyses";

drop policy "Account members can insert lens analyses" on "public"."conversation_lens_analyses";

drop policy "Account members can read lens analyses" on "public"."conversation_lens_analyses";

drop policy "Account members can update lens analyses" on "public"."conversation_lens_analyses";

drop policy "Anyone can read active lens templates" on "public"."conversation_lens_templates";

drop policy "Service role can manage lens templates" on "public"."conversation_lens_templates";

drop policy "insights_read_only" on "public"."insights";

revoke delete on table "public"."conversation_lens_analyses" from "anon";

revoke insert on table "public"."conversation_lens_analyses" from "anon";

revoke references on table "public"."conversation_lens_analyses" from "anon";

revoke select on table "public"."conversation_lens_analyses" from "anon";

revoke trigger on table "public"."conversation_lens_analyses" from "anon";

revoke truncate on table "public"."conversation_lens_analyses" from "anon";

revoke update on table "public"."conversation_lens_analyses" from "anon";

revoke delete on table "public"."conversation_lens_analyses" from "authenticated";

revoke insert on table "public"."conversation_lens_analyses" from "authenticated";

revoke references on table "public"."conversation_lens_analyses" from "authenticated";

revoke select on table "public"."conversation_lens_analyses" from "authenticated";

revoke trigger on table "public"."conversation_lens_analyses" from "authenticated";

revoke truncate on table "public"."conversation_lens_analyses" from "authenticated";

revoke update on table "public"."conversation_lens_analyses" from "authenticated";

revoke delete on table "public"."conversation_lens_analyses" from "service_role";

revoke insert on table "public"."conversation_lens_analyses" from "service_role";

revoke references on table "public"."conversation_lens_analyses" from "service_role";

revoke select on table "public"."conversation_lens_analyses" from "service_role";

revoke trigger on table "public"."conversation_lens_analyses" from "service_role";

revoke truncate on table "public"."conversation_lens_analyses" from "service_role";

revoke update on table "public"."conversation_lens_analyses" from "service_role";

revoke delete on table "public"."conversation_lens_templates" from "anon";

revoke insert on table "public"."conversation_lens_templates" from "anon";

revoke references on table "public"."conversation_lens_templates" from "anon";

revoke select on table "public"."conversation_lens_templates" from "anon";

revoke trigger on table "public"."conversation_lens_templates" from "anon";

revoke truncate on table "public"."conversation_lens_templates" from "anon";

revoke update on table "public"."conversation_lens_templates" from "anon";

revoke delete on table "public"."conversation_lens_templates" from "authenticated";

revoke insert on table "public"."conversation_lens_templates" from "authenticated";

revoke references on table "public"."conversation_lens_templates" from "authenticated";

revoke select on table "public"."conversation_lens_templates" from "authenticated";

revoke trigger on table "public"."conversation_lens_templates" from "authenticated";

revoke truncate on table "public"."conversation_lens_templates" from "authenticated";

revoke update on table "public"."conversation_lens_templates" from "authenticated";

revoke delete on table "public"."conversation_lens_templates" from "service_role";

revoke insert on table "public"."conversation_lens_templates" from "service_role";

revoke references on table "public"."conversation_lens_templates" from "service_role";

revoke select on table "public"."conversation_lens_templates" from "service_role";

revoke trigger on table "public"."conversation_lens_templates" from "service_role";

revoke truncate on table "public"."conversation_lens_templates" from "service_role";

revoke update on table "public"."conversation_lens_templates" from "service_role";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_account_id_fkey";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_confidence_score_check";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_interview_id_fkey";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_processed_by_fkey";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_project_id_fkey";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_status_check";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_template_key_fkey";

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

alter table "public"."conversation_lens_analyses" drop constraint "conversation_lens_analyses_pkey";

alter table "public"."conversation_lens_templates" drop constraint "conversation_lens_templates_pkey";

drop index if exists "public"."conversation_lens_analyses_account_idx";

drop index if exists "public"."conversation_lens_analyses_interview_idx";

drop index if exists "public"."conversation_lens_analyses_interview_template_unique";

drop index if exists "public"."conversation_lens_analyses_pkey";

drop index if exists "public"."conversation_lens_analyses_project_idx";

drop index if exists "public"."conversation_lens_analyses_status_idx";

drop index if exists "public"."conversation_lens_analyses_template_idx";

drop index if exists "public"."conversation_lens_templates_active_idx";

drop index if exists "public"."conversation_lens_templates_category_idx";

drop index if exists "public"."conversation_lens_templates_pkey";

drop table "public"."conversation_lens_analyses";

drop table "public"."conversation_lens_templates";

alter table "public"."interviews" add column "original_filename" text;

alter table "public"."interviews" add column "processing_metadata" jsonb default '{}'::jsonb;

CREATE INDEX idx_interviews_status_processing ON public.interviews USING btree (status) WHERE (status = 'processing'::public.interview_status);

alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) not valid;

alter table "public"."insights" validate constraint "insights_interview_id_fkey";

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

CREATE OR REPLACE FUNCTION public.auto_mark_jobs_error()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'error' AND (OLD.status IS NULL OR OLD.status != 'error') THEN
    -- Ensure conversation_analysis reflects error state
    NEW.conversation_analysis = jsonb_set(COALESCE(NEW.conversation_analysis, '{}'::jsonb), '{status_detail}', '"Interview processing failed"');
    NEW.conversation_analysis = jsonb_set(NEW.conversation_analysis, '{failed_at}', to_jsonb(NOW()::text));
  END IF;
  RETURN NEW;
END;
$function$
;

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
    media_type,
    transcript,
    transcript_formatted,
    conversation_analysis,
    high_impact_themes,
    relevant_answers,
    open_questions_and_next_steps,
    observations_and_notes,
    source_type,
    file_extension,
    original_filename,
    person_id,
    duration_sec,
    status,
    processing_metadata,
    created_at,
    updated_at,
    created_by,
    updated_by
   FROM public.interviews;


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


CREATE TRIGGER trigger_mark_jobs_error BEFORE UPDATE ON public.interviews FOR EACH ROW WHEN ((new.status = 'error'::public.interview_status)) EXECUTE FUNCTION public.auto_mark_jobs_error();

CREATE TRIGGER set_sales_lens_hygiene_events_timestamp BEFORE INSERT OR UPDATE ON public.sales_lens_hygiene_events FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();


