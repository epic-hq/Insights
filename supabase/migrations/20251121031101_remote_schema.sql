drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

do $$
begin
  if exists (
    select 1
    from pg_policies p
    join pg_class c on p.tablename = c.relname
    join pg_namespace n on c.relnamespace = n.oid
    where p.policyname = 'insights_read_only'
      and n.nspname = 'public'
      and c.relname = 'insights'
  ) then
    drop policy "insights_read_only" on "public"."insights";
  end if;
end $$;

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";


  create table "public"."mastra_ai_spans" (
    "traceId" text not null,
    "spanId" text not null,
    "parentSpanId" text,
    "name" text not null,
    "scope" jsonb,
    "spanType" text not null,
    "attributes" jsonb,
    "metadata" jsonb,
    "links" jsonb,
    "input" jsonb,
    "output" jsonb,
    "error" jsonb,
    "startedAt" timestamp without time zone not null,
    "endedAt" timestamp without time zone,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone,
    "isEvent" boolean not null,
    "startedAtZ" timestamp with time zone default now(),
    "endedAtZ" timestamp with time zone default now(),
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_evals" (
    "input" text not null,
    "output" text not null,
    "result" jsonb not null,
    "agent_name" text not null,
    "metric_name" text not null,
    "instructions" text not null,
    "test_info" jsonb,
    "global_run_id" text not null,
    "run_id" text not null,
    "created_at" timestamp without time zone not null,
    "createdAt" timestamp without time zone,
    "created_atZ" timestamp with time zone default now(),
    "createdAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_messages" (
    "id" text not null,
    "thread_id" text not null,
    "content" text not null,
    "role" text not null,
    "type" text not null,
    "createdAt" timestamp without time zone not null,
    "resourceId" text,
    "createdAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_resources" (
    "id" text not null,
    "workingMemory" text,
    "metadata" jsonb,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_scorers" (
    "id" text not null,
    "scorerId" text not null,
    "traceId" text,
    "runId" text not null,
    "scorer" jsonb not null,
    "preprocessStepResult" jsonb,
    "extractStepResult" jsonb,
    "analyzeStepResult" jsonb,
    "score" double precision not null,
    "reason" text,
    "metadata" jsonb,
    "preprocessPrompt" text,
    "extractPrompt" text,
    "generateScorePrompt" text,
    "generateReasonPrompt" text,
    "analyzePrompt" text,
    "reasonPrompt" text,
    "input" jsonb not null,
    "output" jsonb not null,
    "additionalContext" jsonb,
    "runtimeContext" jsonb,
    "entityType" text,
    "entity" jsonb,
    "entityId" text,
    "source" text not null,
    "resourceId" text,
    "threadId" text,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now(),
    "spanId" text
      );



  create table "public"."mastra_threads" (
    "id" text not null,
    "resourceId" text not null,
    "title" text not null,
    "metadata" text,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_traces" (
    "id" text not null,
    "parentSpanId" text,
    "name" text not null,
    "traceId" text not null,
    "scope" text not null,
    "kind" integer not null,
    "attributes" jsonb,
    "status" jsonb,
    "events" jsonb,
    "links" jsonb,
    "other" text,
    "startTime" bigint not null,
    "endTime" bigint not null,
    "createdAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_workflow_snapshot" (
    "workflow_name" text not null,
    "run_id" text not null,
    "resourceId" text,
    "snapshot" text not null,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
      );


do $$
begin
  -- Drop legacy columns only if they exist to avoid failures on re-apply
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='category') then
    alter table public.themes drop column category;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='confidence') then
    alter table public.themes drop column confidence;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='contradictions') then
    alter table public.themes drop column contradictions;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='desired_outcome') then
    alter table public.themes drop column desired_outcome;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='details') then
    alter table public.themes drop column details;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='emotional_response') then
    alter table public.themes drop column emotional_response;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='evidence') then
    alter table public.themes drop column evidence;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='impact') then
    alter table public.themes drop column impact;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='interview_id') then
    alter table public.themes drop column interview_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='journey_stage') then
    alter table public.themes drop column journey_stage;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='jtbd') then
    alter table public.themes drop column jtbd;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='motivation') then
    alter table public.themes drop column motivation;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='novelty') then
    alter table public.themes drop column novelty;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='opportunity_ideas') then
    alter table public.themes drop column opportunity_ideas;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='pain') then
    alter table public.themes drop column pain;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='themes' and column_name='related_tags') then
    alter table public.themes drop column related_tags;
  end if;
end $$;

CREATE UNIQUE INDEX mastra_messages_pkey ON public.mastra_messages USING btree (id);

CREATE UNIQUE INDEX mastra_resources_pkey ON public.mastra_resources USING btree (id);

CREATE UNIQUE INDEX mastra_scorers_pkey ON public.mastra_scorers USING btree (id);

CREATE UNIQUE INDEX mastra_threads_pkey ON public.mastra_threads USING btree (id);

CREATE UNIQUE INDEX mastra_traces_pkey ON public.mastra_traces USING btree (id);

CREATE INDEX public_mastra_ai_spans_name_idx ON public.mastra_ai_spans USING btree (name);

CREATE INDEX public_mastra_ai_spans_parentspanid_startedat_idx ON public.mastra_ai_spans USING btree ("parentSpanId", "startedAt" DESC);

CREATE INDEX public_mastra_ai_spans_spantype_startedat_idx ON public.mastra_ai_spans USING btree ("spanType", "startedAt" DESC);

CREATE INDEX public_mastra_ai_spans_traceid_startedat_idx ON public.mastra_ai_spans USING btree ("traceId", "startedAt" DESC);

CREATE INDEX public_mastra_evals_agent_name_created_at_idx ON public.mastra_evals USING btree (agent_name, created_at DESC);

CREATE INDEX public_mastra_messages_thread_id_createdat_idx ON public.mastra_messages USING btree (thread_id, "createdAt" DESC);

CREATE INDEX public_mastra_scores_trace_id_span_id_created_at_idx ON public.mastra_scorers USING btree ("traceId", "spanId", "createdAt" DESC);

CREATE INDEX public_mastra_threads_resourceid_createdat_idx ON public.mastra_threads USING btree ("resourceId", "createdAt" DESC);

CREATE INDEX public_mastra_traces_name_starttime_idx ON public.mastra_traces USING btree (name, "startTime" DESC);

CREATE UNIQUE INDEX public_mastra_workflow_snapshot_workflow_name_run_id_key ON public.mastra_workflow_snapshot USING btree (workflow_name, run_id);

alter table "public"."mastra_messages" add constraint "mastra_messages_pkey" PRIMARY KEY using index "mastra_messages_pkey";

alter table "public"."mastra_resources" add constraint "mastra_resources_pkey" PRIMARY KEY using index "mastra_resources_pkey";

alter table "public"."mastra_scorers" add constraint "mastra_scorers_pkey" PRIMARY KEY using index "mastra_scorers_pkey";

alter table "public"."mastra_threads" add constraint "mastra_threads_pkey" PRIMARY KEY using index "mastra_threads_pkey";

alter table "public"."mastra_traces" add constraint "mastra_traces_pkey" PRIMARY KEY using index "mastra_traces_pkey";

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'insights_interview_id_fkey'
      and conrelid = 'public.insights'::regclass
  ) then
    alter table public.insights
      add constraint insights_interview_id_fkey foreign key (interview_id) references public.interviews(id) not valid;
    alter table public.insights validate constraint insights_interview_id_fkey;
  end if;
end $$;

alter table "public"."mastra_workflow_snapshot" add constraint "public_mastra_workflow_snapshot_workflow_name_run_id_key" UNIQUE using index "public_mastra_workflow_snapshot_workflow_name_run_id_key";

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'actions_insight_id_fkey'
      and conrelid = 'public.actions'::regclass
  ) then
    alter table public.actions
      add constraint actions_insight_id_fkey foreign key (insight_id) references public.themes(id) on delete set null not valid;
    alter table public.actions validate constraint actions_insight_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_insight_id_fkey'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_insight_id_fkey foreign key (insight_id) references public.insights(id) on delete cascade not valid;
    alter table public.comments validate constraint comments_insight_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'insight_tags_insight_id_fkey'
      and conrelid = 'public.insight_tags'::regclass
  ) then
    alter table public.insight_tags
      add constraint insight_tags_insight_id_fkey foreign key (insight_id) references public.themes(id) on delete cascade not valid;
    alter table public.insight_tags validate constraint insight_tags_insight_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'opportunity_insights_insight_id_fkey'
      and conrelid = 'public.opportunity_insights'::regclass
  ) then
    alter table public.opportunity_insights
      add constraint opportunity_insights_insight_id_fkey foreign key (insight_id) references public.themes(id) on delete cascade not valid;
    alter table public.opportunity_insights validate constraint opportunity_insights_insight_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'persona_insights_insight_id_fkey'
      and conrelid = 'public.persona_insights'::regclass
  ) then
    alter table public.persona_insights
      add constraint persona_insights_insight_id_fkey foreign key (insight_id) references public.themes(id) on delete cascade not valid;
    alter table public.persona_insights validate constraint persona_insights_insight_id_fkey;
  end if;
end $$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                NEW."createdAt" = NOW();
                NEW."updatedAt" = NOW();
                NEW."createdAtZ" = NOW();
                NEW."updatedAtZ" = NOW();
            ELSIF TG_OP = 'UPDATE' THEN
                NEW."updatedAt" = NOW();
                NEW."updatedAtZ" = NOW();
                -- Prevent createdAt from being changed
                NEW."createdAt" = OLD."createdAt";
                NEW."createdAtZ" = OLD."createdAtZ";
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

CREATE OR REPLACE FUNCTION public.get_account_invitations(account_id uuid, results_limit integer DEFAULT 25, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
AS $function$BEGIN
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
END;$function$
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


grant delete on table "public"."mastra_ai_spans" to "anon";

grant insert on table "public"."mastra_ai_spans" to "anon";

grant references on table "public"."mastra_ai_spans" to "anon";

grant select on table "public"."mastra_ai_spans" to "anon";

grant trigger on table "public"."mastra_ai_spans" to "anon";

grant truncate on table "public"."mastra_ai_spans" to "anon";

grant update on table "public"."mastra_ai_spans" to "anon";

grant delete on table "public"."mastra_ai_spans" to "authenticated";

grant insert on table "public"."mastra_ai_spans" to "authenticated";

grant references on table "public"."mastra_ai_spans" to "authenticated";

grant select on table "public"."mastra_ai_spans" to "authenticated";

grant trigger on table "public"."mastra_ai_spans" to "authenticated";

grant truncate on table "public"."mastra_ai_spans" to "authenticated";

grant update on table "public"."mastra_ai_spans" to "authenticated";

grant delete on table "public"."mastra_ai_spans" to "service_role";

grant insert on table "public"."mastra_ai_spans" to "service_role";

grant references on table "public"."mastra_ai_spans" to "service_role";

grant select on table "public"."mastra_ai_spans" to "service_role";

grant trigger on table "public"."mastra_ai_spans" to "service_role";

grant truncate on table "public"."mastra_ai_spans" to "service_role";

grant update on table "public"."mastra_ai_spans" to "service_role";

grant delete on table "public"."mastra_evals" to "anon";

grant insert on table "public"."mastra_evals" to "anon";

grant references on table "public"."mastra_evals" to "anon";

grant select on table "public"."mastra_evals" to "anon";

grant trigger on table "public"."mastra_evals" to "anon";

grant truncate on table "public"."mastra_evals" to "anon";

grant update on table "public"."mastra_evals" to "anon";

grant delete on table "public"."mastra_evals" to "authenticated";

grant insert on table "public"."mastra_evals" to "authenticated";

grant references on table "public"."mastra_evals" to "authenticated";

grant select on table "public"."mastra_evals" to "authenticated";

grant trigger on table "public"."mastra_evals" to "authenticated";

grant truncate on table "public"."mastra_evals" to "authenticated";

grant update on table "public"."mastra_evals" to "authenticated";

grant delete on table "public"."mastra_evals" to "service_role";

grant insert on table "public"."mastra_evals" to "service_role";

grant references on table "public"."mastra_evals" to "service_role";

grant select on table "public"."mastra_evals" to "service_role";

grant trigger on table "public"."mastra_evals" to "service_role";

grant truncate on table "public"."mastra_evals" to "service_role";

grant update on table "public"."mastra_evals" to "service_role";

grant delete on table "public"."mastra_messages" to "anon";

grant insert on table "public"."mastra_messages" to "anon";

grant references on table "public"."mastra_messages" to "anon";

grant select on table "public"."mastra_messages" to "anon";

grant trigger on table "public"."mastra_messages" to "anon";

grant truncate on table "public"."mastra_messages" to "anon";

grant update on table "public"."mastra_messages" to "anon";

grant delete on table "public"."mastra_messages" to "authenticated";

grant insert on table "public"."mastra_messages" to "authenticated";

grant references on table "public"."mastra_messages" to "authenticated";

grant select on table "public"."mastra_messages" to "authenticated";

grant trigger on table "public"."mastra_messages" to "authenticated";

grant truncate on table "public"."mastra_messages" to "authenticated";

grant update on table "public"."mastra_messages" to "authenticated";

grant delete on table "public"."mastra_messages" to "service_role";

grant insert on table "public"."mastra_messages" to "service_role";

grant references on table "public"."mastra_messages" to "service_role";

grant select on table "public"."mastra_messages" to "service_role";

grant trigger on table "public"."mastra_messages" to "service_role";

grant truncate on table "public"."mastra_messages" to "service_role";

grant update on table "public"."mastra_messages" to "service_role";

grant delete on table "public"."mastra_resources" to "anon";

grant insert on table "public"."mastra_resources" to "anon";

grant references on table "public"."mastra_resources" to "anon";

grant select on table "public"."mastra_resources" to "anon";

grant trigger on table "public"."mastra_resources" to "anon";

grant truncate on table "public"."mastra_resources" to "anon";

grant update on table "public"."mastra_resources" to "anon";

grant delete on table "public"."mastra_resources" to "authenticated";

grant insert on table "public"."mastra_resources" to "authenticated";

grant references on table "public"."mastra_resources" to "authenticated";

grant select on table "public"."mastra_resources" to "authenticated";

grant trigger on table "public"."mastra_resources" to "authenticated";

grant truncate on table "public"."mastra_resources" to "authenticated";

grant update on table "public"."mastra_resources" to "authenticated";

grant delete on table "public"."mastra_resources" to "service_role";

grant insert on table "public"."mastra_resources" to "service_role";

grant references on table "public"."mastra_resources" to "service_role";

grant select on table "public"."mastra_resources" to "service_role";

grant trigger on table "public"."mastra_resources" to "service_role";

grant truncate on table "public"."mastra_resources" to "service_role";

grant update on table "public"."mastra_resources" to "service_role";

grant delete on table "public"."mastra_scorers" to "anon";

grant insert on table "public"."mastra_scorers" to "anon";

grant references on table "public"."mastra_scorers" to "anon";

grant select on table "public"."mastra_scorers" to "anon";

grant trigger on table "public"."mastra_scorers" to "anon";

grant truncate on table "public"."mastra_scorers" to "anon";

grant update on table "public"."mastra_scorers" to "anon";

grant delete on table "public"."mastra_scorers" to "authenticated";

grant insert on table "public"."mastra_scorers" to "authenticated";

grant references on table "public"."mastra_scorers" to "authenticated";

grant select on table "public"."mastra_scorers" to "authenticated";

grant trigger on table "public"."mastra_scorers" to "authenticated";

grant truncate on table "public"."mastra_scorers" to "authenticated";

grant update on table "public"."mastra_scorers" to "authenticated";

grant delete on table "public"."mastra_scorers" to "service_role";

grant insert on table "public"."mastra_scorers" to "service_role";

grant references on table "public"."mastra_scorers" to "service_role";

grant select on table "public"."mastra_scorers" to "service_role";

grant trigger on table "public"."mastra_scorers" to "service_role";

grant truncate on table "public"."mastra_scorers" to "service_role";

grant update on table "public"."mastra_scorers" to "service_role";

grant delete on table "public"."mastra_threads" to "anon";

grant insert on table "public"."mastra_threads" to "anon";

grant references on table "public"."mastra_threads" to "anon";

grant select on table "public"."mastra_threads" to "anon";

grant trigger on table "public"."mastra_threads" to "anon";

grant truncate on table "public"."mastra_threads" to "anon";

grant update on table "public"."mastra_threads" to "anon";

grant delete on table "public"."mastra_threads" to "authenticated";

grant insert on table "public"."mastra_threads" to "authenticated";

grant references on table "public"."mastra_threads" to "authenticated";

grant select on table "public"."mastra_threads" to "authenticated";

grant trigger on table "public"."mastra_threads" to "authenticated";

grant truncate on table "public"."mastra_threads" to "authenticated";

grant update on table "public"."mastra_threads" to "authenticated";

grant delete on table "public"."mastra_threads" to "service_role";

grant insert on table "public"."mastra_threads" to "service_role";

grant references on table "public"."mastra_threads" to "service_role";

grant select on table "public"."mastra_threads" to "service_role";

grant trigger on table "public"."mastra_threads" to "service_role";

grant truncate on table "public"."mastra_threads" to "service_role";

grant update on table "public"."mastra_threads" to "service_role";

grant delete on table "public"."mastra_traces" to "anon";

grant insert on table "public"."mastra_traces" to "anon";

grant references on table "public"."mastra_traces" to "anon";

grant select on table "public"."mastra_traces" to "anon";

grant trigger on table "public"."mastra_traces" to "anon";

grant truncate on table "public"."mastra_traces" to "anon";

grant update on table "public"."mastra_traces" to "anon";

grant delete on table "public"."mastra_traces" to "authenticated";

grant insert on table "public"."mastra_traces" to "authenticated";

grant references on table "public"."mastra_traces" to "authenticated";

grant select on table "public"."mastra_traces" to "authenticated";

grant trigger on table "public"."mastra_traces" to "authenticated";

grant truncate on table "public"."mastra_traces" to "authenticated";

grant update on table "public"."mastra_traces" to "authenticated";

grant delete on table "public"."mastra_traces" to "service_role";

grant insert on table "public"."mastra_traces" to "service_role";

grant references on table "public"."mastra_traces" to "service_role";

grant select on table "public"."mastra_traces" to "service_role";

grant trigger on table "public"."mastra_traces" to "service_role";

grant truncate on table "public"."mastra_traces" to "service_role";

grant update on table "public"."mastra_traces" to "service_role";

grant delete on table "public"."mastra_workflow_snapshot" to "anon";

grant insert on table "public"."mastra_workflow_snapshot" to "anon";

grant references on table "public"."mastra_workflow_snapshot" to "anon";

grant select on table "public"."mastra_workflow_snapshot" to "anon";

grant trigger on table "public"."mastra_workflow_snapshot" to "anon";

grant truncate on table "public"."mastra_workflow_snapshot" to "anon";

grant update on table "public"."mastra_workflow_snapshot" to "anon";

grant delete on table "public"."mastra_workflow_snapshot" to "authenticated";

grant insert on table "public"."mastra_workflow_snapshot" to "authenticated";

grant references on table "public"."mastra_workflow_snapshot" to "authenticated";

grant select on table "public"."mastra_workflow_snapshot" to "authenticated";

grant trigger on table "public"."mastra_workflow_snapshot" to "authenticated";

grant truncate on table "public"."mastra_workflow_snapshot" to "authenticated";

grant update on table "public"."mastra_workflow_snapshot" to "authenticated";

grant delete on table "public"."mastra_workflow_snapshot" to "service_role";

grant insert on table "public"."mastra_workflow_snapshot" to "service_role";

grant references on table "public"."mastra_workflow_snapshot" to "service_role";

grant select on table "public"."mastra_workflow_snapshot" to "service_role";

grant trigger on table "public"."mastra_workflow_snapshot" to "service_role";

grant truncate on table "public"."mastra_workflow_snapshot" to "service_role";

grant update on table "public"."mastra_workflow_snapshot" to "service_role";

CREATE TRIGGER mastra_ai_spans_timestamps BEFORE INSERT OR UPDATE ON public.mastra_ai_spans FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- Ensure the helper function and trigger exist without failing if already present; skip entirely if storage schema is unavailable or lacks usage privileges (e.g., local dev without storage)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and has_schema_privilege('storage', 'usage') then
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on p.pronamespace = n.oid
      where n.nspname = 'storage'
        and p.proname = 'enforce_bucket_name_length'
    ) then
      create function storage.enforce_bucket_name_length() returns trigger
      language plpgsql as $fn$
      begin
        if char_length(new.name) > 63 then
          raise exception 'Bucket name too long (max 63 characters)';
        end if;
        return new;
      end;
      $fn$;
    end if;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and has_schema_privilege('storage', 'usage') then
    if not exists (
      select 1
      from pg_trigger t
      join pg_class c on t.tgrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      where t.tgname = 'enforce_bucket_name_length_trigger'
        and n.nspname = 'storage'
        and c.relname = 'buckets'
    ) then
      create trigger enforce_bucket_name_length_trigger
      before insert or update of name on storage.buckets
      for each row execute function storage.enforce_bucket_name_length();
    end if;
  end if;
end $$;

-- Storage triggers (skipped in local dev where storage is disabled)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'CREATE TRIGGER IF NOT EXISTS objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger()';
    execute 'CREATE TRIGGER IF NOT EXISTS objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger()';
    execute 'CREATE TRIGGER IF NOT EXISTS objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger()';
    execute 'CREATE TRIGGER IF NOT EXISTS update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column()';
    execute 'CREATE TRIGGER IF NOT EXISTS prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger()';
    execute 'CREATE TRIGGER IF NOT EXISTS prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger()';
  end if;
end $$;
