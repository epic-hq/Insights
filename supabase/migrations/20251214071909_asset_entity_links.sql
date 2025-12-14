drop trigger if exists "update_lens_summaries_updated_at" on "public"."conversation_lens_summaries";

drop policy if exists "insights_read_only" on "public"."insights";

-- Safe constraint drops with IF EXISTS logic
DO $$
BEGIN
    ALTER TABLE IF EXISTS "public"."actions" DROP CONSTRAINT IF EXISTS "actions_insight_id_fkey";
    ALTER TABLE IF EXISTS "public"."comments" DROP CONSTRAINT IF EXISTS "comments_insight_id_fkey";
    ALTER TABLE IF EXISTS "public"."insight_tags" DROP CONSTRAINT IF EXISTS "insight_tags_insight_id_fkey";
    ALTER TABLE IF EXISTS "public"."opportunity_insights" DROP CONSTRAINT IF EXISTS "opportunity_insights_insight_id_fkey";
    ALTER TABLE IF EXISTS "public"."persona_insights" DROP CONSTRAINT IF EXISTS "persona_insights_insight_id_fkey";
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

drop function if exists "public"."enqueue_missing_evidence_embeddings"(project_id_param uuid);

drop view if exists "public"."insights_with_priority";

drop function if exists "public"."update_lens_summaries_timestamp"();

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";


  create table "public"."asset_opportunities" (
    "id" uuid not null default gen_random_uuid(),
    "asset_id" uuid not null,
    "opportunity_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid not null,
    "relationship_type" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."asset_opportunities" enable row level security;


  create table "public"."asset_organizations" (
    "id" uuid not null default gen_random_uuid(),
    "asset_id" uuid not null,
    "organization_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid not null,
    "relationship_type" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."asset_organizations" enable row level security;


  create table "public"."asset_people" (
    "id" uuid not null default gen_random_uuid(),
    "asset_id" uuid not null,
    "person_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid not null,
    "relationship_type" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."asset_people" enable row level security;


  create table "public"."interview_opportunities" (
    "id" uuid not null default gen_random_uuid(),
    "interview_id" uuid not null,
    "opportunity_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid not null,
    "relationship_type" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."interview_opportunities" enable row level security;


  create table "public"."interview_organizations" (
    "id" uuid not null default gen_random_uuid(),
    "interview_id" uuid not null,
    "organization_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid not null,
    "relationship_type" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."interview_organizations" enable row level security;

CREATE UNIQUE INDEX asset_opportunities_asset_id_opportunity_id_key ON public.asset_opportunities USING btree (asset_id, opportunity_id);

CREATE UNIQUE INDEX asset_opportunities_pkey ON public.asset_opportunities USING btree (id);

CREATE UNIQUE INDEX asset_organizations_asset_id_organization_id_key ON public.asset_organizations USING btree (asset_id, organization_id);

CREATE UNIQUE INDEX asset_organizations_pkey ON public.asset_organizations USING btree (id);

CREATE UNIQUE INDEX asset_people_asset_id_person_id_key ON public.asset_people USING btree (asset_id, person_id);

CREATE UNIQUE INDEX asset_people_pkey ON public.asset_people USING btree (id);

CREATE INDEX idx_asset_opportunities_asset_id ON public.asset_opportunities USING btree (asset_id);

CREATE INDEX idx_asset_opportunities_opportunity_id ON public.asset_opportunities USING btree (opportunity_id);

CREATE INDEX idx_asset_opportunities_project_id ON public.asset_opportunities USING btree (project_id);

CREATE INDEX idx_asset_organizations_asset_id ON public.asset_organizations USING btree (asset_id);

CREATE INDEX idx_asset_organizations_organization_id ON public.asset_organizations USING btree (organization_id);

CREATE INDEX idx_asset_organizations_project_id ON public.asset_organizations USING btree (project_id);

CREATE INDEX idx_asset_people_asset_id ON public.asset_people USING btree (asset_id);

CREATE INDEX idx_asset_people_person_id ON public.asset_people USING btree (person_id);

CREATE INDEX idx_asset_people_project_id ON public.asset_people USING btree (project_id);

CREATE INDEX idx_interview_opportunities_interview_id ON public.interview_opportunities USING btree (interview_id);

CREATE INDEX idx_interview_opportunities_opportunity_id ON public.interview_opportunities USING btree (opportunity_id);

CREATE INDEX idx_interview_opportunities_project_id ON public.interview_opportunities USING btree (project_id);

CREATE INDEX idx_interview_organizations_interview_id ON public.interview_organizations USING btree (interview_id);

CREATE INDEX idx_interview_organizations_organization_id ON public.interview_organizations USING btree (organization_id);

CREATE INDEX idx_interview_organizations_project_id ON public.interview_organizations USING btree (project_id);

CREATE UNIQUE INDEX interview_opportunities_interview_id_opportunity_id_key ON public.interview_opportunities USING btree (interview_id, opportunity_id);

CREATE UNIQUE INDEX interview_opportunities_pkey ON public.interview_opportunities USING btree (id);

CREATE UNIQUE INDEX interview_organizations_interview_id_organization_id_key ON public.interview_organizations USING btree (interview_id, organization_id);

CREATE UNIQUE INDEX interview_organizations_pkey ON public.interview_organizations USING btree (id);

alter table "public"."asset_opportunities" add constraint "asset_opportunities_pkey" PRIMARY KEY using index "asset_opportunities_pkey";

alter table "public"."asset_organizations" add constraint "asset_organizations_pkey" PRIMARY KEY using index "asset_organizations_pkey";

alter table "public"."asset_people" add constraint "asset_people_pkey" PRIMARY KEY using index "asset_people_pkey";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_pkey" PRIMARY KEY using index "interview_opportunities_pkey";

alter table "public"."interview_organizations" add constraint "interview_organizations_pkey" PRIMARY KEY using index "interview_organizations_pkey";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."asset_opportunities" validate constraint "asset_opportunities_account_id_fkey";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.project_assets(id) ON DELETE CASCADE not valid;

alter table "public"."asset_opportunities" validate constraint "asset_opportunities_asset_id_fkey";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_asset_id_opportunity_id_key" UNIQUE using index "asset_opportunities_asset_id_opportunity_id_key";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."asset_opportunities" validate constraint "asset_opportunities_created_by_fkey";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE not valid;

alter table "public"."asset_opportunities" validate constraint "asset_opportunities_opportunity_id_fkey";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."asset_opportunities" validate constraint "asset_opportunities_project_id_fkey";

alter table "public"."asset_opportunities" add constraint "asset_opportunities_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['supporting'::text, 'about'::text, 'related'::text]))) not valid;

alter table "public"."asset_opportunities" validate constraint "asset_opportunities_relationship_type_check";

alter table "public"."asset_organizations" add constraint "asset_organizations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."asset_organizations" validate constraint "asset_organizations_account_id_fkey";

alter table "public"."asset_organizations" add constraint "asset_organizations_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.project_assets(id) ON DELETE CASCADE not valid;

alter table "public"."asset_organizations" validate constraint "asset_organizations_asset_id_fkey";

alter table "public"."asset_organizations" add constraint "asset_organizations_asset_id_organization_id_key" UNIQUE using index "asset_organizations_asset_id_organization_id_key";

alter table "public"."asset_organizations" add constraint "asset_organizations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."asset_organizations" validate constraint "asset_organizations_created_by_fkey";

alter table "public"."asset_organizations" add constraint "asset_organizations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."asset_organizations" validate constraint "asset_organizations_organization_id_fkey";

alter table "public"."asset_organizations" add constraint "asset_organizations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."asset_organizations" validate constraint "asset_organizations_project_id_fkey";

alter table "public"."asset_organizations" add constraint "asset_organizations_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['mentioned'::text, 'about'::text, 'source'::text, 'related'::text]))) not valid;

alter table "public"."asset_organizations" validate constraint "asset_organizations_relationship_type_check";

alter table "public"."asset_people" add constraint "asset_people_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."asset_people" validate constraint "asset_people_account_id_fkey";

alter table "public"."asset_people" add constraint "asset_people_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.project_assets(id) ON DELETE CASCADE not valid;

alter table "public"."asset_people" validate constraint "asset_people_asset_id_fkey";

alter table "public"."asset_people" add constraint "asset_people_asset_id_person_id_key" UNIQUE using index "asset_people_asset_id_person_id_key";

alter table "public"."asset_people" add constraint "asset_people_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."asset_people" validate constraint "asset_people_created_by_fkey";

alter table "public"."asset_people" add constraint "asset_people_person_id_fkey" FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE not valid;

alter table "public"."asset_people" validate constraint "asset_people_person_id_fkey";

alter table "public"."asset_people" add constraint "asset_people_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."asset_people" validate constraint "asset_people_project_id_fkey";

alter table "public"."asset_people" add constraint "asset_people_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['mentioned'::text, 'about'::text, 'created_by'::text, 'related'::text]))) not valid;

alter table "public"."asset_people" validate constraint "asset_people_relationship_type_check";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."interview_opportunities" validate constraint "interview_opportunities_account_id_fkey";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."interview_opportunities" validate constraint "interview_opportunities_created_by_fkey";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE not valid;

alter table "public"."interview_opportunities" validate constraint "interview_opportunities_interview_id_fkey";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_interview_id_opportunity_id_key" UNIQUE using index "interview_opportunities_interview_id_opportunity_id_key";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE not valid;

alter table "public"."interview_opportunities" validate constraint "interview_opportunities_opportunity_id_fkey";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_opportunities" validate constraint "interview_opportunities_project_id_fkey";

alter table "public"."interview_opportunities" add constraint "interview_opportunities_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['discovery'::text, 'demo'::text, 'negotiation'::text, 'related'::text]))) not valid;

alter table "public"."interview_opportunities" validate constraint "interview_opportunities_relationship_type_check";

alter table "public"."interview_organizations" add constraint "interview_organizations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."interview_organizations" validate constraint "interview_organizations_account_id_fkey";

alter table "public"."interview_organizations" add constraint "interview_organizations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."interview_organizations" validate constraint "interview_organizations_created_by_fkey";

alter table "public"."interview_organizations" add constraint "interview_organizations_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE not valid;

alter table "public"."interview_organizations" validate constraint "interview_organizations_interview_id_fkey";

alter table "public"."interview_organizations" add constraint "interview_organizations_interview_id_organization_id_key" UNIQUE using index "interview_organizations_interview_id_organization_id_key";

alter table "public"."interview_organizations" add constraint "interview_organizations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."interview_organizations" validate constraint "interview_organizations_organization_id_fkey";

alter table "public"."interview_organizations" add constraint "interview_organizations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_organizations" validate constraint "interview_organizations_project_id_fkey";

alter table "public"."interview_organizations" add constraint "interview_organizations_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['mentioned'::text, 'about'::text, 'with'::text, 'related'::text]))) not valid;

alter table "public"."interview_organizations" validate constraint "interview_organizations_relationship_type_check";

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


grant delete on table "public"."asset_opportunities" to "anon";

grant insert on table "public"."asset_opportunities" to "anon";

grant references on table "public"."asset_opportunities" to "anon";

grant select on table "public"."asset_opportunities" to "anon";

grant trigger on table "public"."asset_opportunities" to "anon";

grant truncate on table "public"."asset_opportunities" to "anon";

grant update on table "public"."asset_opportunities" to "anon";

grant delete on table "public"."asset_opportunities" to "authenticated";

grant insert on table "public"."asset_opportunities" to "authenticated";

grant references on table "public"."asset_opportunities" to "authenticated";

grant select on table "public"."asset_opportunities" to "authenticated";

grant trigger on table "public"."asset_opportunities" to "authenticated";

grant truncate on table "public"."asset_opportunities" to "authenticated";

grant update on table "public"."asset_opportunities" to "authenticated";

grant delete on table "public"."asset_opportunities" to "service_role";

grant insert on table "public"."asset_opportunities" to "service_role";

grant references on table "public"."asset_opportunities" to "service_role";

grant select on table "public"."asset_opportunities" to "service_role";

grant trigger on table "public"."asset_opportunities" to "service_role";

grant truncate on table "public"."asset_opportunities" to "service_role";

grant update on table "public"."asset_opportunities" to "service_role";

grant delete on table "public"."asset_organizations" to "anon";

grant insert on table "public"."asset_organizations" to "anon";

grant references on table "public"."asset_organizations" to "anon";

grant select on table "public"."asset_organizations" to "anon";

grant trigger on table "public"."asset_organizations" to "anon";

grant truncate on table "public"."asset_organizations" to "anon";

grant update on table "public"."asset_organizations" to "anon";

grant delete on table "public"."asset_organizations" to "authenticated";

grant insert on table "public"."asset_organizations" to "authenticated";

grant references on table "public"."asset_organizations" to "authenticated";

grant select on table "public"."asset_organizations" to "authenticated";

grant trigger on table "public"."asset_organizations" to "authenticated";

grant truncate on table "public"."asset_organizations" to "authenticated";

grant update on table "public"."asset_organizations" to "authenticated";

grant delete on table "public"."asset_organizations" to "service_role";

grant insert on table "public"."asset_organizations" to "service_role";

grant references on table "public"."asset_organizations" to "service_role";

grant select on table "public"."asset_organizations" to "service_role";

grant trigger on table "public"."asset_organizations" to "service_role";

grant truncate on table "public"."asset_organizations" to "service_role";

grant update on table "public"."asset_organizations" to "service_role";

grant delete on table "public"."asset_people" to "anon";

grant insert on table "public"."asset_people" to "anon";

grant references on table "public"."asset_people" to "anon";

grant select on table "public"."asset_people" to "anon";

grant trigger on table "public"."asset_people" to "anon";

grant truncate on table "public"."asset_people" to "anon";

grant update on table "public"."asset_people" to "anon";

grant delete on table "public"."asset_people" to "authenticated";

grant insert on table "public"."asset_people" to "authenticated";

grant references on table "public"."asset_people" to "authenticated";

grant select on table "public"."asset_people" to "authenticated";

grant trigger on table "public"."asset_people" to "authenticated";

grant truncate on table "public"."asset_people" to "authenticated";

grant update on table "public"."asset_people" to "authenticated";

grant delete on table "public"."asset_people" to "service_role";

grant insert on table "public"."asset_people" to "service_role";

grant references on table "public"."asset_people" to "service_role";

grant select on table "public"."asset_people" to "service_role";

grant trigger on table "public"."asset_people" to "service_role";

grant truncate on table "public"."asset_people" to "service_role";

grant update on table "public"."asset_people" to "service_role";

grant delete on table "public"."interview_opportunities" to "anon";

grant insert on table "public"."interview_opportunities" to "anon";

grant references on table "public"."interview_opportunities" to "anon";

grant select on table "public"."interview_opportunities" to "anon";

grant trigger on table "public"."interview_opportunities" to "anon";

grant truncate on table "public"."interview_opportunities" to "anon";

grant update on table "public"."interview_opportunities" to "anon";

grant delete on table "public"."interview_opportunities" to "authenticated";

grant insert on table "public"."interview_opportunities" to "authenticated";

grant references on table "public"."interview_opportunities" to "authenticated";

grant select on table "public"."interview_opportunities" to "authenticated";

grant trigger on table "public"."interview_opportunities" to "authenticated";

grant truncate on table "public"."interview_opportunities" to "authenticated";

grant update on table "public"."interview_opportunities" to "authenticated";

grant delete on table "public"."interview_opportunities" to "service_role";

grant insert on table "public"."interview_opportunities" to "service_role";

grant references on table "public"."interview_opportunities" to "service_role";

grant select on table "public"."interview_opportunities" to "service_role";

grant trigger on table "public"."interview_opportunities" to "service_role";

grant truncate on table "public"."interview_opportunities" to "service_role";

grant update on table "public"."interview_opportunities" to "service_role";

grant delete on table "public"."interview_organizations" to "anon";

grant insert on table "public"."interview_organizations" to "anon";

grant references on table "public"."interview_organizations" to "anon";

grant select on table "public"."interview_organizations" to "anon";

grant trigger on table "public"."interview_organizations" to "anon";

grant truncate on table "public"."interview_organizations" to "anon";

grant update on table "public"."interview_organizations" to "anon";

grant delete on table "public"."interview_organizations" to "authenticated";

grant insert on table "public"."interview_organizations" to "authenticated";

grant references on table "public"."interview_organizations" to "authenticated";

grant select on table "public"."interview_organizations" to "authenticated";

grant trigger on table "public"."interview_organizations" to "authenticated";

grant truncate on table "public"."interview_organizations" to "authenticated";

grant update on table "public"."interview_organizations" to "authenticated";

grant delete on table "public"."interview_organizations" to "service_role";

grant insert on table "public"."interview_organizations" to "service_role";

grant references on table "public"."interview_organizations" to "service_role";

grant select on table "public"."interview_organizations" to "service_role";

grant trigger on table "public"."interview_organizations" to "service_role";

grant truncate on table "public"."interview_organizations" to "service_role";

grant update on table "public"."interview_organizations" to "service_role";


  create policy "Users can delete asset_opportunities for their account"
  on "public"."asset_opportunities"
  as permissive
  for delete
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can insert asset_opportunities for their account"
  on "public"."asset_opportunities"
  as permissive
  for insert
  to public
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can update asset_opportunities for their account"
  on "public"."asset_opportunities"
  as permissive
  for update
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can view asset_opportunities for their account"
  on "public"."asset_opportunities"
  as permissive
  for select
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can delete asset_organizations for their account"
  on "public"."asset_organizations"
  as permissive
  for delete
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can insert asset_organizations for their account"
  on "public"."asset_organizations"
  as permissive
  for insert
  to public
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can update asset_organizations for their account"
  on "public"."asset_organizations"
  as permissive
  for update
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can view asset_organizations for their account"
  on "public"."asset_organizations"
  as permissive
  for select
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can delete asset_people for their account"
  on "public"."asset_people"
  as permissive
  for delete
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can insert asset_people for their account"
  on "public"."asset_people"
  as permissive
  for insert
  to public
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can update asset_people for their account"
  on "public"."asset_people"
  as permissive
  for update
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can view asset_people for their account"
  on "public"."asset_people"
  as permissive
  for select
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can delete interview_opportunities for their account"
  on "public"."interview_opportunities"
  as permissive
  for delete
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can insert interview_opportunities for their account"
  on "public"."interview_opportunities"
  as permissive
  for insert
  to public
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can update interview_opportunities for their account"
  on "public"."interview_opportunities"
  as permissive
  for update
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can view interview_opportunities for their account"
  on "public"."interview_opportunities"
  as permissive
  for select
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can delete interview_organizations for their account"
  on "public"."interview_organizations"
  as permissive
  for delete
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can insert interview_organizations for their account"
  on "public"."interview_organizations"
  as permissive
  for insert
  to public
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can update interview_organizations for their account"
  on "public"."interview_organizations"
  as permissive
  for update
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Users can view interview_organizations for their account"
  on "public"."interview_organizations"
  as permissive
  for select
  to public
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



-- project_assets policies already exist, skipping


CREATE TRIGGER set_conversation_lens_summaries_timestamp BEFORE INSERT OR UPDATE ON public.conversation_lens_summaries FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();


