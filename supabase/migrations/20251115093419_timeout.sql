drop trigger if exists "trigger_evidence_facet_embedding" on "public"."evidence_facet";

drop policy "insights_read_only" on "public"."insights";

drop policy "Users can delete insight_tags for their account" on "public"."insight_tags";

drop policy "Users can insert insight_tags for their account" on "public"."insight_tags";

drop policy "Users can update insight_tags for their account" on "public"."insight_tags";

drop policy "Users can view insight_tags for their account" on "public"."insight_tags";

alter table "public"."sales_lens_slots" drop constraint "sales_lens_slots_related_person_ids_project_check";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop function if exists "public"."find_facet_clusters"(project_id_param uuid, kind_slug_param text, similarity_threshold double precision);

drop function if exists "public"."find_similar_facets"(query_embedding vector, kind_slug_param text, project_id_param uuid, match_threshold double precision, match_count integer);

drop view if exists "public"."insights_with_priority";

drop function if exists "public"."trigger_generate_facet_embedding"();

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

create table "public"."actions" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "type" text not null,
    "title" text not null,
    "description" text,
    "priority" text,
    "impact_score" numeric,
    "status" text not null default 'proposed'::text,
    "evidence_ids" uuid[] default '{}'::uuid[],
    "insight_id" uuid,
    "theme_id" uuid,
    "lens_type" text,
    "metadata" jsonb default '{}'::jsonb,
    "owner_user_id" uuid,
    "assigned_to" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone
);


alter table "public"."actions" enable row level security;

alter table "public"."evidence" add column "embedding" vector(1536);

alter table "public"."evidence" add column "embedding_generated_at" timestamp with time zone;

alter table "public"."evidence" add column "embedding_model" text;

alter table "public"."insights" add column "embedding_generated_at" timestamp with time zone;

alter table "public"."insights" add column "embedding_model" text;

alter table "public"."themes" drop column "category";

alter table "public"."themes" drop column "confidence";

alter table "public"."themes" drop column "contradictions";

alter table "public"."themes" drop column "desired_outcome";

alter table "public"."themes" drop column "details";

alter table "public"."themes" drop column "emotional_response";

alter table "public"."themes" drop column "evidence";

alter table "public"."themes" drop column "impact";

alter table "public"."themes" drop column "interview_id";

alter table "public"."themes" drop column "journey_stage";

alter table "public"."themes" drop column "jtbd";

alter table "public"."themes" drop column "motivation";

alter table "public"."themes" drop column "novelty";

alter table "public"."themes" drop column "opportunity_ideas";

alter table "public"."themes" drop column "pain";

alter table "public"."themes" drop column "related_tags";

alter table "public"."themes" alter column "embedding" set data type vector(1536) using "embedding"::vector(1536);

CREATE UNIQUE INDEX actions_pkey ON public.actions USING btree (id);

CREATE INDEX evidence_embedding_idx ON public.evidence USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_actions_evidence_ids_gin ON public.actions USING gin (evidence_ids);

CREATE INDEX idx_actions_impact_score ON public.actions USING btree (impact_score DESC);

CREATE INDEX idx_actions_lens_type ON public.actions USING btree (lens_type);

CREATE INDEX idx_actions_metadata_gin ON public.actions USING gin (metadata);

CREATE INDEX idx_actions_priority ON public.actions USING btree (priority);

CREATE INDEX idx_actions_project_id ON public.actions USING btree (project_id);

CREATE INDEX idx_actions_status ON public.actions USING btree (status);

CREATE INDEX idx_actions_type ON public.actions USING btree (type);

CREATE INDEX insights_embedding_idx ON public.insights USING hnsw (embedding vector_cosine_ops);

CREATE INDEX themes_embedding_idx ON public.themes USING hnsw (embedding vector_cosine_ops);

alter table "public"."actions" add constraint "actions_pkey" PRIMARY KEY using index "actions_pkey";

alter table "public"."actions" add constraint "actions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."actions" validate constraint "actions_account_id_fkey";

alter table "public"."actions" add constraint "actions_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_assigned_to_fkey";

alter table "public"."actions" add constraint "actions_impact_score_check" CHECK (((impact_score >= (0)::numeric) AND (impact_score <= (1)::numeric))) not valid;

alter table "public"."actions" validate constraint "actions_impact_score_check";

alter table "public"."actions" add constraint "actions_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_insight_id_fkey";

alter table "public"."actions" add constraint "actions_lens_type_check" CHECK ((lens_type = ANY (ARRAY['product'::text, 'sales'::text, 'research'::text, 'support'::text, 'custom'::text]))) not valid;

alter table "public"."actions" validate constraint "actions_lens_type_check";

alter table "public"."actions" add constraint "actions_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_owner_user_id_fkey";

alter table "public"."actions" add constraint "actions_priority_check" CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))) not valid;

alter table "public"."actions" validate constraint "actions_priority_check";

alter table "public"."actions" add constraint "actions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."actions" validate constraint "actions_project_id_fkey";

alter table "public"."actions" add constraint "actions_status_check" CHECK ((status = ANY (ARRAY['proposed'::text, 'planned'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]))) not valid;

alter table "public"."actions" validate constraint "actions_status_check";

alter table "public"."actions" add constraint "actions_theme_id_fkey" FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_theme_id_fkey";

alter table "public"."actions" add constraint "actions_type_check" CHECK ((type = ANY (ARRAY['feature'::text, 'deal_task'::text, 'research_gap'::text, 'support_improvement'::text, 'other'::text]))) not valid;

alter table "public"."actions" validate constraint "actions_type_check";

alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) not valid;

alter table "public"."insights" validate constraint "insights_interview_id_fkey";

alter table "public"."comments" add constraint "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" add constraint "opportunity_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_insights" validate constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" add constraint "persona_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."persona_insights" validate constraint "persona_insights_insight_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_facet_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.label is distinct from new.label)) then
    perform pgmq.send(
      'facet_embedding_queue',
      json_build_object(
        'facet_id', new.id::text,
        'label', new.label,
        'kind_slug', new.kind_slug
      )::jsonb
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_duplicate_themes(project_id_param uuid, similarity_threshold double precision DEFAULT 0.85)
 RETURNS TABLE(theme_id_1 uuid, theme_id_2 uuid, theme_name_1 text, theme_name_2 text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      t1.id as theme_id_1,
      t2.id as theme_id_2,
      t1.name as theme_name_1,
      t2.name as theme_name_2,
      1 - (t1.embedding <=> t2.embedding) as similarity
    from public.themes t1
    cross join public.themes t2
    where t1.project_id = project_id_param
      and t2.project_id = project_id_param
      and t1.id < t2.id  -- Avoid duplicates and self-matches
      and t1.embedding is not null
      and t2.embedding is not null
      and 1 - (t1.embedding <=> t2.embedding) > similarity_threshold
    order by similarity desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_similar_evidence(query_embedding vector, project_id_param uuid, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, verbatim text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      evidence.id,
      evidence.verbatim,
      1 - (evidence.embedding <=> query_embedding) as similarity
    from public.evidence
    where evidence.project_id = project_id_param
      and evidence.embedding is not null
      and 1 - (evidence.embedding <=> query_embedding) > match_threshold
    order by evidence.embedding <=> query_embedding
    limit match_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_similar_themes(query_embedding vector, project_id_param uuid, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, statement text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      themes.id,
      themes.name,
      themes.statement,
      1 - (themes.embedding <=> query_embedding) as similarity
    from public.themes
    where themes.project_id = project_id_param
      and themes.embedding is not null
      and 1 - (themes.embedding <=> query_embedding) > match_threshold
    order by themes.embedding <=> query_embedding
    limit match_count;
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

CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in the interview that generated this insight
    FOR persona_record IN
        SELECT DISTINCT pp.persona_id, p.name as persona
        FROM themes i
        JOIN interviews iv ON i.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN people_personas pp ON pe.id = pp.person_id
        JOIN personas p ON pp.persona_id = p.id AND pe.account_id = p.account_id
        WHERE i.id = p_insight_id
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

CREATE OR REPLACE FUNCTION public.enqueue_person_facet_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  facet_label text;
  kind_slug text;
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
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

CREATE OR REPLACE FUNCTION public.find_person_facet_clusters(project_id_param uuid, kind_slug_param text, similarity_threshold double precision DEFAULT 0.75)
 RETURNS TABLE(person_facet_id_1 text, person_facet_id_2 text, facet_account_id_1 integer, facet_account_id_2 integer, label_1 text, label_2 text, similarity double precision, combined_person_count bigint)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      pf1.person_id::text || '|' || pf1.facet_account_id::text as person_facet_id_1,
      pf2.person_id::text || '|' || pf2.facet_account_id::text as person_facet_id_2,
      pf1.facet_account_id as facet_account_id_1,
      pf2.facet_account_id as facet_account_id_2,
      fa1.label as label_1,
      fa2.label as label_2,
      1 - (pf1.embedding <=> pf2.embedding) as similarity,
      (
        select count(distinct person_id)
        from public.person_facet pf_temp
        where pf_temp.facet_account_id in (pf1.facet_account_id, pf2.facet_account_id)
          and pf_temp.project_id = project_id_param
      ) as combined_person_count
    from public.person_facet pf1
    join public.facet_account fa1 on fa1.id = pf1.facet_account_id
    join public.facet_kind_global fkg1 on fkg1.id = fa1.kind_id
    cross join public.person_facet pf2
    join public.facet_account fa2 on fa2.id = pf2.facet_account_id
    join public.facet_kind_global fkg2 on fkg2.id = fa2.kind_id
    where pf1.project_id = project_id_param
      and pf2.project_id = project_id_param
      and fkg1.slug = kind_slug_param
      and fkg2.slug = kind_slug_param
      and pf1.facet_account_id < pf2.facet_account_id  -- Avoid duplicates and self-matches
      and pf1.embedding is not null
      and pf2.embedding is not null
      and 1 - (pf1.embedding <=> pf2.embedding) > similarity_threshold
    order by similarity desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.invoke_edge_function(func_name text, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  req_id bigint;
  supabase_anon_key text;
begin
  select decrypted_secret
  into supabase_anon_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_ANON_KEY'
  order by created_at desc
  limit 1;

  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    15000  -- timeout in milliseconds
  );
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
   FROM ((project_answers pa
     LEFT JOIN evidence e ON ((e.project_answer_id = pa.id)))
     LEFT JOIN people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = pa.project_id))))
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
   FROM (((research_questions rq
     LEFT JOIN project_answers pa ON ((pa.research_question_id = rq.id)))
     LEFT JOIN project_answer_metrics m ON ((m.project_answer_id = pa.id)))
     LEFT JOIN people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = rq.project_id))))
  GROUP BY rq.project_id, rq.id, rq.decision_question_id, rq.text;


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
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
   FROM ((((decision_questions dq
     LEFT JOIN research_questions rq ON ((rq.decision_question_id = dq.id)))
     LEFT JOIN project_answers pa ON ((pa.decision_question_id = dq.id)))
     LEFT JOIN project_answer_metrics m ON ((m.project_answer_id = pa.id)))
     LEFT JOIN people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = dq.project_id))))
  GROUP BY dq.project_id, dq.id, dq.text;


grant delete on table "public"."actions" to "anon";

grant insert on table "public"."actions" to "anon";

grant references on table "public"."actions" to "anon";

grant select on table "public"."actions" to "anon";

grant trigger on table "public"."actions" to "anon";

grant truncate on table "public"."actions" to "anon";

grant update on table "public"."actions" to "anon";

grant delete on table "public"."actions" to "authenticated";

grant insert on table "public"."actions" to "authenticated";

grant references on table "public"."actions" to "authenticated";

grant select on table "public"."actions" to "authenticated";

grant trigger on table "public"."actions" to "authenticated";

grant truncate on table "public"."actions" to "authenticated";

grant update on table "public"."actions" to "authenticated";

grant delete on table "public"."actions" to "service_role";

grant insert on table "public"."actions" to "service_role";

grant references on table "public"."actions" to "service_role";

grant select on table "public"."actions" to "service_role";

grant trigger on table "public"."actions" to "service_role";

grant truncate on table "public"."actions" to "service_role";

grant update on table "public"."actions" to "service_role";

create policy "Users can create actions for their projects"
on "public"."actions"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM accounts.account_user
  WHERE ((account_user.account_id = actions.account_id) AND (account_user.user_id = auth.uid())))));


create policy "Users can delete actions for their projects"
on "public"."actions"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM accounts.account_user
  WHERE ((account_user.account_id = actions.account_id) AND (account_user.user_id = auth.uid())))));


create policy "Users can update actions for their projects"
on "public"."actions"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM accounts.account_user
  WHERE ((account_user.account_id = actions.account_id) AND (account_user.user_id = auth.uid())))));


create policy "Users can view actions for their projects"
on "public"."actions"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM accounts.account_user
  WHERE ((account_user.account_id = actions.account_id) AND (account_user.user_id = auth.uid())))));


create policy "Users can delete insight_tags for their account"
on "public"."insight_tags"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM themes i
  WHERE ((i.id = insight_tags.insight_id) AND (i.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));


create policy "Users can insert insight_tags for their account"
on "public"."insight_tags"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM themes i
  WHERE ((i.id = insight_tags.insight_id) AND (i.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));


create policy "Users can update insight_tags for their account"
on "public"."insight_tags"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM themes i
  WHERE ((i.id = insight_tags.insight_id) AND (i.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));


create policy "Users can view insight_tags for their account"
on "public"."insight_tags"
as permissive
for select
to public
using (((EXISTS ( SELECT 1
   FROM themes i
  WHERE ((i.id = insight_tags.insight_id) AND (i.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM insights legacy_i
  WHERE ((legacy_i.id = insight_tags.insight_id) AND (legacy_i.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid()))))))));


CREATE TRIGGER set_actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enqueue_facet AFTER INSERT OR UPDATE ON public.evidence_facet FOR EACH ROW EXECUTE FUNCTION enqueue_facet_embedding();


