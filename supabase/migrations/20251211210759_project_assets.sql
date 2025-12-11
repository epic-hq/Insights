create type "public"."asset_type" as enum ('table', 'pdf', 'document', 'image', 'audio', 'video', 'link');

-- NOTE: Removed "drop trigger if exists update_lens_summaries_updated_at on conversation_lens_summaries"
-- because conversation_lens_summaries table doesn't exist yet at this migration point

-- NOTE: Removed "drop policy insights_read_only on insights"
-- because this policy is created in a LATER migration (20251222090000_readonly_legacy_insights.sql)

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

-- NOTE: Removed "drop function if exists update_lens_summaries_timestamp()"
-- because conversation_lens_summaries table doesn't exist yet at this migration point

-- NOTE: Removed "drop view if exists conversations" and its recreation
-- because the view references key_takeaways column which is added in a LATER migration

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";


  create table "public"."asset_evidence" (
    "id" uuid not null default gen_random_uuid(),
    "asset_id" uuid not null,
    "evidence_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid,
    "row_index" integer,
    "column_name" text,
    "extraction_type" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."asset_evidence" enable row level security;


  create table "public"."project_assets" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "asset_type" public.asset_type not null,
    "title" text not null,
    "description" text,
    "tags" text[] default '{}'::text[],
    "media_key" text,
    "thumbnail_key" text,
    "file_extension" text,
    "original_filename" text,
    "file_size_bytes" bigint,
    "mime_type" text,
    "duration_sec" integer,
    "content_md" text,
    "content_raw" text,
    "table_data" jsonb,
    "row_count" integer,
    "column_count" integer,
    "status" public.interview_status not null default 'ready'::public.interview_status,
    "processing_metadata" jsonb default '{}'::jsonb,
    "error_message" text,
    "source_type" text,
    "source_url" text,
    "embedding" public.vector(1536),
    "embedding_model" text default 'text-embedding-3-small'::text,
    "embedding_generated_at" timestamp with time zone,
    "content_tsv" tsvector generated always as (to_tsvector('english'::regconfig, ((((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(content_md, ''::text)))) stored,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
      );


alter table "public"."project_assets" enable row level security;

CREATE UNIQUE INDEX asset_evidence_asset_id_evidence_id_key ON public.asset_evidence USING btree (asset_id, evidence_id);

CREATE UNIQUE INDEX asset_evidence_pkey ON public.asset_evidence USING btree (id);

CREATE INDEX idx_asset_evidence_account_id ON public.asset_evidence USING btree (account_id);

CREATE INDEX idx_asset_evidence_asset_id ON public.asset_evidence USING btree (asset_id);

CREATE INDEX idx_asset_evidence_evidence_id ON public.asset_evidence USING btree (evidence_id);

CREATE INDEX idx_project_assets_account_id ON public.project_assets USING btree (account_id);

CREATE INDEX idx_project_assets_asset_type ON public.project_assets USING btree (asset_type);

CREATE INDEX idx_project_assets_content_tsv ON public.project_assets USING gin (content_tsv);

CREATE INDEX idx_project_assets_created_at ON public.project_assets USING btree (created_at DESC);

CREATE INDEX idx_project_assets_project_id ON public.project_assets USING btree (project_id);

CREATE INDEX idx_project_assets_status ON public.project_assets USING btree (status);

CREATE INDEX project_assets_embedding_idx ON public.project_assets USING hnsw (embedding public.vector_cosine_ops);

CREATE UNIQUE INDEX project_assets_pkey ON public.project_assets USING btree (id);

alter table "public"."asset_evidence" add constraint "asset_evidence_pkey" PRIMARY KEY using index "asset_evidence_pkey";

alter table "public"."project_assets" add constraint "project_assets_pkey" PRIMARY KEY using index "project_assets_pkey";

alter table "public"."asset_evidence" add constraint "asset_evidence_asset_id_evidence_id_key" UNIQUE using index "asset_evidence_asset_id_evidence_id_key";

alter table "public"."asset_evidence" add constraint "asset_evidence_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.project_assets(id) ON DELETE CASCADE not valid;

alter table "public"."asset_evidence" validate constraint "asset_evidence_asset_id_fkey";

alter table "public"."asset_evidence" add constraint "asset_evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."asset_evidence" validate constraint "asset_evidence_created_by_fkey";

alter table "public"."asset_evidence" add constraint "asset_evidence_evidence_id_fkey" FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON DELETE CASCADE not valid;

alter table "public"."asset_evidence" validate constraint "asset_evidence_evidence_id_fkey";

alter table "public"."asset_evidence" add constraint "asset_evidence_extraction_type_check" CHECK ((extraction_type = ANY (ARRAY['row'::text, 'column_summary'::text, 'document_summary'::text, 'manual'::text]))) not valid;

alter table "public"."asset_evidence" validate constraint "asset_evidence_extraction_type_check";

alter table "public"."asset_evidence" add constraint "asset_evidence_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."asset_evidence" validate constraint "asset_evidence_project_id_fkey";

alter table "public"."project_assets" add constraint "project_assets_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."project_assets" validate constraint "project_assets_account_id_fkey";

alter table "public"."project_assets" add constraint "project_assets_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."project_assets" validate constraint "project_assets_created_by_fkey";

alter table "public"."project_assets" add constraint "project_assets_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_assets" validate constraint "project_assets_project_id_fkey";

alter table "public"."project_assets" add constraint "project_assets_source_type_check" CHECK ((source_type = ANY (ARRAY['upload'::text, 'paste'::text, 'import'::text, 'link'::text]))) not valid;

alter table "public"."project_assets" validate constraint "project_assets_source_type_check";

alter table "public"."project_assets" add constraint "project_assets_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."project_assets" validate constraint "project_assets_updated_by_fkey";

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

-- NOTE: Removed conversations view recreation
-- because it references key_takeaways column which is added in a LATER migration (20251224000000)


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


grant delete on table "public"."asset_evidence" to "anon";

grant insert on table "public"."asset_evidence" to "anon";

grant references on table "public"."asset_evidence" to "anon";

grant select on table "public"."asset_evidence" to "anon";

grant trigger on table "public"."asset_evidence" to "anon";

grant truncate on table "public"."asset_evidence" to "anon";

grant update on table "public"."asset_evidence" to "anon";

grant delete on table "public"."asset_evidence" to "authenticated";

grant insert on table "public"."asset_evidence" to "authenticated";

grant references on table "public"."asset_evidence" to "authenticated";

grant select on table "public"."asset_evidence" to "authenticated";

grant trigger on table "public"."asset_evidence" to "authenticated";

grant truncate on table "public"."asset_evidence" to "authenticated";

grant update on table "public"."asset_evidence" to "authenticated";

grant delete on table "public"."asset_evidence" to "service_role";

grant insert on table "public"."asset_evidence" to "service_role";

grant references on table "public"."asset_evidence" to "service_role";

grant select on table "public"."asset_evidence" to "service_role";

grant trigger on table "public"."asset_evidence" to "service_role";

grant truncate on table "public"."asset_evidence" to "service_role";

grant update on table "public"."asset_evidence" to "service_role";

grant delete on table "public"."project_assets" to "anon";

grant insert on table "public"."project_assets" to "anon";

grant references on table "public"."project_assets" to "anon";

grant select on table "public"."project_assets" to "anon";

grant trigger on table "public"."project_assets" to "anon";

grant truncate on table "public"."project_assets" to "anon";

grant update on table "public"."project_assets" to "anon";

grant delete on table "public"."project_assets" to "authenticated";

grant insert on table "public"."project_assets" to "authenticated";

grant references on table "public"."project_assets" to "authenticated";

grant select on table "public"."project_assets" to "authenticated";

grant trigger on table "public"."project_assets" to "authenticated";

grant truncate on table "public"."project_assets" to "authenticated";

grant update on table "public"."project_assets" to "authenticated";

grant delete on table "public"."project_assets" to "service_role";

grant insert on table "public"."project_assets" to "service_role";

grant references on table "public"."project_assets" to "service_role";

grant select on table "public"."project_assets" to "service_role";

grant trigger on table "public"."project_assets" to "service_role";

grant truncate on table "public"."project_assets" to "service_role";

grant update on table "public"."project_assets" to "service_role";


  create policy "Account members can insert"
  on "public"."asset_evidence"
  as permissive
  for insert
  to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can select"
  on "public"."asset_evidence"
  as permissive
  for select
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can update"
  on "public"."asset_evidence"
  as permissive
  for update
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account owners can delete"
  on "public"."asset_evidence"
  as permissive
  for delete
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));



  create policy "Account members can insert"
  on "public"."project_assets"
  as permissive
  for insert
  to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can select"
  on "public"."project_assets"
  as permissive
  for select
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can update"
  on "public"."project_assets"
  as permissive
  for update
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account owners can delete"
  on "public"."project_assets"
  as permissive
  for delete
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


-- NOTE: Removed CREATE TRIGGER set_conversation_lens_summaries_timestamp
-- because conversation_lens_summaries table will be created in a later migration (20251229000001_lens_summaries.sql)

CREATE TRIGGER set_project_assets_timestamp BEFORE INSERT OR UPDATE ON public.project_assets FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_project_assets_user_tracking BEFORE INSERT OR UPDATE ON public.project_assets FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();
