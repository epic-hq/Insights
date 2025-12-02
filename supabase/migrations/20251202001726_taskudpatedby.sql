drop policy if exists "insights_read_only" on "public"."insights";

alter table "public"."actions" drop constraint if exists "actions_insight_id_fkey";

alter table "public"."comments" drop constraint if exists "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint if exists "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint if exists "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint if exists "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

drop function if exists "public"."invoke_edge_function_async"(func_name text, payload jsonb);

drop function if exists "public"."invoke_edge_function_with_retry"(func_name text, payload jsonb);

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

-- alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) not valid;

-- alter table "public"."insights" validate constraint "insights_interview_id_fkey";

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

CREATE OR REPLACE FUNCTION accounts.trigger_set_user_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    has_created_by boolean;
    has_updated_by boolean;
BEGIN
    -- Skip auth.users table entirely
    IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
        RETURN NEW;
    END IF;

    -- Check if the table has the required columns
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
        AND table_name = TG_TABLE_NAME
        AND column_name = 'created_by'
    ) INTO has_created_by;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
        AND table_name = TG_TABLE_NAME
        AND column_name = 'updated_by'
    ) INTO has_updated_by;

    -- Only set the fields if they exist
    IF TG_OP = 'INSERT' THEN
        IF has_created_by THEN
            -- Only set created_by if not already set (allows service role to set it explicitly)
            IF NEW.created_by IS NULL THEN
                NEW.created_by = auth.uid();
            END IF;
        END IF;
        IF has_updated_by THEN
            -- Only set updated_by if not already set
            IF NEW.updated_by IS NULL THEN
                NEW.updated_by = auth.uid();
            END IF;
        END IF;
    ELSE
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
        IF has_created_by THEN
            NEW.created_by = OLD.created_by;
        END IF;
    END IF;
    RETURN NEW;
END
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
    person_id,
    duration_sec,
    status,
    created_at,
    updated_at,
    created_by,
    updated_by
   FROM public.interviews;


CREATE OR REPLACE FUNCTION public.enqueue_person_facet_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  facet_label text;
  kind_slug text;
begin
  -- Only enqueue if embedding is NULL (prevents infinite loop)
  if (TG_OP = 'INSERT' and new.embedding is null) or
     (TG_OP = 'UPDATE' and new.embedding is null and old.embedding is null) then
    -- Fetch label and kind_slug from facet_account via join
    select fa.label, fkg.slug
    into facet_label, kind_slug
    from facet_account fa
    join facet_kind_global fkg on fkg.id = fa.kind_id
    where fa.id = new.facet_account_id;

    if facet_label is not null then
      perform pgmq.send(
        'person_facet_embedding_queue',
        json_build_object(
          'person_id', new.person_id::text,
          'facet_account_id', new.facet_account_id,
          'label', facet_label,
          'kind_slug', kind_slug
        )::jsonb
      );
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_themes_by_person_facet(facet_label_query text, project_id_param uuid, match_threshold double precision DEFAULT 0.6, match_count integer DEFAULT 20)
 RETURNS TABLE(theme_id uuid, theme_name text, theme_pain text, similarity double precision, person_count bigint)
 LANGUAGE plpgsql
AS $function$
declare
  query_embedding vector(1536);
begin
  -- Get embedding for the facet label query
  select embedding into query_embedding
  from person_facet pf
  join facet_account fa on fa.id = pf.facet_account_id
  where fa.label ilike facet_label_query
  and pf.project_id = project_id_param
  and pf.embedding is not null
  limit 1;

  -- If no exact match, use semantic search on all person facets
  if query_embedding is null then
    -- TODO: Create embedding from query text via OpenAI
    -- For now, return empty result
    return;
  end if;

  -- Find themes linked to evidence from people with similar facets
  return query
    with similar_people as (
      select distinct pf.person_id,
             1 - (pf.embedding <=> query_embedding) as facet_similarity
      from person_facet pf
      where pf.project_id = project_id_param
        and pf.embedding is not null
        and 1 - (pf.embedding <=> query_embedding) > match_threshold
    )
    select
      t.id as theme_id,
      t.name as theme_name,
      t.pain as theme_pain,
      avg(1 - (t.embedding <=> query_embedding)) as similarity,
      count(distinct ep.person_id) as person_count
    from themes t
    join theme_evidence te on te.theme_id = t.id
    join evidence e on e.id = te.evidence_id
    join evidence_people ep on ep.evidence_id = e.id
    join similar_people sp on sp.person_id = ep.person_id
    where t.project_id = project_id_param
      and t.embedding is not null
    group by t.id, t.name, t.pain
    having avg(1 - (t.embedding <=> query_embedding)) > match_threshold
    order by similarity desc, person_count desc
    limit match_count;
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


CREATE OR REPLACE FUNCTION public.process_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'insights_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed', job.message::jsonb);
    perform pgmq.delete(
      'insights_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from embedding queue.', count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_facet_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'facet_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed-facet', job.message::jsonb);
    perform pgmq.delete(
      'facet_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s facet message(s) from embedding queue.', count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_person_facet_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'person_facet_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed-person-facet', job.message::jsonb);
    perform pgmq.delete(
      'person_facet_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s person facet message(s) from embedding queue.', count);
end;
$function$
;

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


CREATE OR REPLACE FUNCTION public.search_themes_semantic(query_text text, project_id_param uuid, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, pain text, statement text, category text, journey_stage text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  -- TODO: Get embedding for query_text from OpenAI
  -- For now, use ILIKE as fallback until we implement text-to-embedding API
  return query
    select
      themes.id,
      themes.name,
      themes.pain,
      themes.statement,
      themes.category,
      themes.journey_stage,
      0.9::float as similarity -- Placeholder
    from public.themes
    where themes.project_id = project_id_param
      and (
        themes.name ilike '%' || query_text || '%'
        or themes.pain ilike '%' || query_text || '%'
        or themes.statement ilike '%' || query_text || '%'
      )
    limit match_count;
end;
$function$
;

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
