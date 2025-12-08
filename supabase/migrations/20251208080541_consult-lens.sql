drop policy if exists "Anyone can read active lens templates" on "public"."conversation_lens_templates";

drop policy if exists "insights_read_only" on "public"."insights";

drop policy if exists "Account members can delete lens analyses" on "public"."conversation_lens_analyses";

drop policy if exists "Account members can update lens analyses" on "public"."conversation_lens_analyses";

alter table "public"."actions" drop constraint if exists "actions_insight_id_fkey";

alter table "public"."comments" drop constraint if exists "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint if exists "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint if exists "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint if exists "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

drop index if exists "public"."conversation_lens_analyses_trigger_run_idx";

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_lens_templates' AND column_name = 'account_id') THEN
    ALTER TABLE "public"."conversation_lens_templates" ADD COLUMN "account_id" uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_lens_templates' AND column_name = 'created_by') THEN
    ALTER TABLE "public"."conversation_lens_templates" ADD COLUMN "created_by" uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_lens_templates' AND column_name = 'is_public') THEN
    ALTER TABLE "public"."conversation_lens_templates" ADD COLUMN "is_public" boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_lens_templates' AND column_name = 'is_system') THEN
    ALTER TABLE "public"."conversation_lens_templates" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_lens_templates' AND column_name = 'nlp_source') THEN
    ALTER TABLE "public"."conversation_lens_templates" ADD COLUMN "nlp_source" text;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS conversation_lens_templates_account_idx ON public.conversation_lens_templates USING btree (account_id) WHERE (account_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS conversation_lens_templates_created_by_idx ON public.conversation_lens_templates USING btree (created_by) WHERE (created_by IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_lens_templates_scoped_key_unique ON public.conversation_lens_templates USING btree (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), template_key);

-- Add constraints idempotently (drop first if exists, then add)
DO $$
BEGIN
  -- conversation_lens_analyses constraints
  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_account_id_fkey";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE;

  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_confidence_score_check";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_confidence_score_check" CHECK (((confidence_score >= (0)::double precision) AND (confidence_score <= (1)::double precision)));

  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_interview_id_fkey";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;

  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_processed_by_fkey";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_processed_by_fkey" FOREIGN KEY (processed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_project_id_fkey";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_status_check";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));

  ALTER TABLE "public"."conversation_lens_analyses" DROP CONSTRAINT IF EXISTS "conversation_lens_analyses_template_key_fkey";
  ALTER TABLE "public"."conversation_lens_analyses" ADD CONSTRAINT "conversation_lens_analyses_template_key_fkey" FOREIGN KEY (template_key) REFERENCES public.conversation_lens_templates(template_key) ON DELETE RESTRICT;

  -- conversation_lens_templates constraints
  ALTER TABLE "public"."conversation_lens_templates" DROP CONSTRAINT IF EXISTS "conversation_lens_templates_account_id_fkey";
  ALTER TABLE "public"."conversation_lens_templates" ADD CONSTRAINT "conversation_lens_templates_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE;

  ALTER TABLE "public"."conversation_lens_templates" DROP CONSTRAINT IF EXISTS "conversation_lens_templates_created_by_fkey";
  ALTER TABLE "public"."conversation_lens_templates" ADD CONSTRAINT "conversation_lens_templates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- Other table constraints
  ALTER TABLE "public"."actions" DROP CONSTRAINT IF EXISTS "actions_insight_id_fkey";
  ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE SET NULL;

  ALTER TABLE "public"."comments" DROP CONSTRAINT IF EXISTS "comments_insight_id_fkey";
  ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.insights(id) ON DELETE CASCADE;

  ALTER TABLE "public"."insight_tags" DROP CONSTRAINT IF EXISTS "insight_tags_insight_id_fkey";
  ALTER TABLE "public"."insight_tags" ADD CONSTRAINT "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE;

  ALTER TABLE "public"."opportunity_insights" DROP CONSTRAINT IF EXISTS "opportunity_insights_insight_id_fkey";
  ALTER TABLE "public"."opportunity_insights" ADD CONSTRAINT "opportunity_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE;

  ALTER TABLE "public"."persona_insights" DROP CONSTRAINT IF EXISTS "persona_insights_insight_id_fkey";
  ALTER TABLE "public"."persona_insights" ADD CONSTRAINT "persona_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE;
END $$;

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


grant delete on table "public"."conversation_lens_analyses" to "anon";

grant insert on table "public"."conversation_lens_analyses" to "anon";

grant references on table "public"."conversation_lens_analyses" to "anon";

grant select on table "public"."conversation_lens_analyses" to "anon";

grant trigger on table "public"."conversation_lens_analyses" to "anon";

grant truncate on table "public"."conversation_lens_analyses" to "anon";

grant update on table "public"."conversation_lens_analyses" to "anon";

grant references on table "public"."conversation_lens_analyses" to "authenticated";

grant trigger on table "public"."conversation_lens_analyses" to "authenticated";

grant truncate on table "public"."conversation_lens_analyses" to "authenticated";

grant delete on table "public"."conversation_lens_templates" to "anon";

grant insert on table "public"."conversation_lens_templates" to "anon";

grant references on table "public"."conversation_lens_templates" to "anon";

grant select on table "public"."conversation_lens_templates" to "anon";

grant trigger on table "public"."conversation_lens_templates" to "anon";

grant truncate on table "public"."conversation_lens_templates" to "anon";

grant update on table "public"."conversation_lens_templates" to "anon";

grant delete on table "public"."conversation_lens_templates" to "authenticated";

grant insert on table "public"."conversation_lens_templates" to "authenticated";

grant references on table "public"."conversation_lens_templates" to "authenticated";

grant trigger on table "public"."conversation_lens_templates" to "authenticated";

grant truncate on table "public"."conversation_lens_templates" to "authenticated";

grant update on table "public"."conversation_lens_templates" to "authenticated";


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_lens_templates' AND policyname = 'Users can create templates in their account') THEN
    CREATE POLICY "Users can create templates in their account"
    ON "public"."conversation_lens_templates"
    AS permissive
    FOR insert
    TO authenticated
    WITH CHECK (((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)) AND (is_system = false)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_lens_templates' AND policyname = 'Users can delete their own templates') THEN
    CREATE POLICY "Users can delete their own templates"
    ON "public"."conversation_lens_templates"
    AS permissive
    FOR delete
    TO authenticated
    USING (((created_by = auth.uid()) AND (is_system = false)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_lens_templates' AND policyname = 'Users can read accessible templates') THEN
    CREATE POLICY "Users can read accessible templates"
    ON "public"."conversation_lens_templates"
    AS permissive
    FOR select
    TO authenticated
    USING (((is_active = true) AND ((is_system = true) OR ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)) AND ((is_public = true) OR (created_by = auth.uid()))))));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_lens_templates' AND policyname = 'Users can update their own templates') THEN
    CREATE POLICY "Users can update their own templates"
    ON "public"."conversation_lens_templates"
    AS permissive
    FOR update
    TO authenticated
    USING (((created_by = auth.uid()) AND (is_system = false)))
    WITH CHECK (((created_by = auth.uid()) AND (is_system = false)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_lens_analyses' AND policyname = 'Account members can delete lens analyses') THEN
    CREATE POLICY "Account members can delete lens analyses"
    ON "public"."conversation_lens_analyses"
    AS permissive
    FOR delete
    TO authenticated
    USING ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_lens_analyses' AND policyname = 'Account members can update lens analyses') THEN
    CREATE POLICY "Account members can update lens analyses"
    ON "public"."conversation_lens_analyses"
    AS permissive
    FOR update
    TO authenticated
    USING ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))
    WITH CHECK ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_conversation_lens_analyses_timestamp ON public.conversation_lens_analyses;
CREATE TRIGGER set_conversation_lens_analyses_timestamp BEFORE INSERT OR UPDATE ON public.conversation_lens_analyses FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_conversation_lens_templates_timestamp ON public.conversation_lens_templates;
CREATE TRIGGER set_conversation_lens_templates_timestamp BEFORE INSERT OR UPDATE ON public.conversation_lens_templates FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();
