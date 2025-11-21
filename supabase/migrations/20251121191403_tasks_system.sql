create extension if not exists "pg_net" with schema "extensions";

drop trigger if exists "mastra_ai_spans_timestamps" on "public"."mastra_ai_spans";

drop policy if exists "insights_read_only" on "public"."insights";

revoke delete on table "public"."mastra_ai_spans" from "anon";

revoke insert on table "public"."mastra_ai_spans" from "anon";

revoke references on table "public"."mastra_ai_spans" from "anon";

revoke select on table "public"."mastra_ai_spans" from "anon";

revoke trigger on table "public"."mastra_ai_spans" from "anon";

revoke truncate on table "public"."mastra_ai_spans" from "anon";

revoke update on table "public"."mastra_ai_spans" from "anon";

revoke delete on table "public"."mastra_ai_spans" from "authenticated";

revoke insert on table "public"."mastra_ai_spans" from "authenticated";

revoke references on table "public"."mastra_ai_spans" from "authenticated";

revoke select on table "public"."mastra_ai_spans" from "authenticated";

revoke trigger on table "public"."mastra_ai_spans" from "authenticated";

revoke truncate on table "public"."mastra_ai_spans" from "authenticated";

revoke update on table "public"."mastra_ai_spans" from "authenticated";

revoke delete on table "public"."mastra_ai_spans" from "service_role";

revoke insert on table "public"."mastra_ai_spans" from "service_role";

revoke references on table "public"."mastra_ai_spans" from "service_role";

revoke select on table "public"."mastra_ai_spans" from "service_role";

revoke trigger on table "public"."mastra_ai_spans" from "service_role";

revoke truncate on table "public"."mastra_ai_spans" from "service_role";

revoke update on table "public"."mastra_ai_spans" from "service_role";

revoke delete on table "public"."mastra_evals" from "anon";

revoke insert on table "public"."mastra_evals" from "anon";

revoke references on table "public"."mastra_evals" from "anon";

revoke select on table "public"."mastra_evals" from "anon";

revoke trigger on table "public"."mastra_evals" from "anon";

revoke truncate on table "public"."mastra_evals" from "anon";

revoke update on table "public"."mastra_evals" from "anon";

revoke delete on table "public"."mastra_evals" from "authenticated";

revoke insert on table "public"."mastra_evals" from "authenticated";

revoke references on table "public"."mastra_evals" from "authenticated";

revoke select on table "public"."mastra_evals" from "authenticated";

revoke trigger on table "public"."mastra_evals" from "authenticated";

revoke truncate on table "public"."mastra_evals" from "authenticated";

revoke update on table "public"."mastra_evals" from "authenticated";

revoke delete on table "public"."mastra_evals" from "service_role";

revoke insert on table "public"."mastra_evals" from "service_role";

revoke references on table "public"."mastra_evals" from "service_role";

revoke select on table "public"."mastra_evals" from "service_role";

revoke trigger on table "public"."mastra_evals" from "service_role";

revoke truncate on table "public"."mastra_evals" from "service_role";

revoke update on table "public"."mastra_evals" from "service_role";

revoke delete on table "public"."mastra_messages" from "anon";

revoke insert on table "public"."mastra_messages" from "anon";

revoke references on table "public"."mastra_messages" from "anon";

revoke select on table "public"."mastra_messages" from "anon";

revoke trigger on table "public"."mastra_messages" from "anon";

revoke truncate on table "public"."mastra_messages" from "anon";

revoke update on table "public"."mastra_messages" from "anon";

revoke delete on table "public"."mastra_messages" from "authenticated";

revoke insert on table "public"."mastra_messages" from "authenticated";

revoke references on table "public"."mastra_messages" from "authenticated";

revoke select on table "public"."mastra_messages" from "authenticated";

revoke trigger on table "public"."mastra_messages" from "authenticated";

revoke truncate on table "public"."mastra_messages" from "authenticated";

revoke update on table "public"."mastra_messages" from "authenticated";

revoke delete on table "public"."mastra_messages" from "service_role";

revoke insert on table "public"."mastra_messages" from "service_role";

revoke references on table "public"."mastra_messages" from "service_role";

revoke select on table "public"."mastra_messages" from "service_role";

revoke trigger on table "public"."mastra_messages" from "service_role";

revoke truncate on table "public"."mastra_messages" from "service_role";

revoke update on table "public"."mastra_messages" from "service_role";

revoke delete on table "public"."mastra_resources" from "anon";

revoke insert on table "public"."mastra_resources" from "anon";

revoke references on table "public"."mastra_resources" from "anon";

revoke select on table "public"."mastra_resources" from "anon";

revoke trigger on table "public"."mastra_resources" from "anon";

revoke truncate on table "public"."mastra_resources" from "anon";

revoke update on table "public"."mastra_resources" from "anon";

revoke delete on table "public"."mastra_resources" from "authenticated";

revoke insert on table "public"."mastra_resources" from "authenticated";

revoke references on table "public"."mastra_resources" from "authenticated";

revoke select on table "public"."mastra_resources" from "authenticated";

revoke trigger on table "public"."mastra_resources" from "authenticated";

revoke truncate on table "public"."mastra_resources" from "authenticated";

revoke update on table "public"."mastra_resources" from "authenticated";

revoke delete on table "public"."mastra_resources" from "service_role";

revoke insert on table "public"."mastra_resources" from "service_role";

revoke references on table "public"."mastra_resources" from "service_role";

revoke select on table "public"."mastra_resources" from "service_role";

revoke trigger on table "public"."mastra_resources" from "service_role";

revoke truncate on table "public"."mastra_resources" from "service_role";

revoke update on table "public"."mastra_resources" from "service_role";

revoke delete on table "public"."mastra_scorers" from "anon";

revoke insert on table "public"."mastra_scorers" from "anon";

revoke references on table "public"."mastra_scorers" from "anon";

revoke select on table "public"."mastra_scorers" from "anon";

revoke trigger on table "public"."mastra_scorers" from "anon";

revoke truncate on table "public"."mastra_scorers" from "anon";

revoke update on table "public"."mastra_scorers" from "anon";

revoke delete on table "public"."mastra_scorers" from "authenticated";

revoke insert on table "public"."mastra_scorers" from "authenticated";

revoke references on table "public"."mastra_scorers" from "authenticated";

revoke select on table "public"."mastra_scorers" from "authenticated";

revoke trigger on table "public"."mastra_scorers" from "authenticated";

revoke truncate on table "public"."mastra_scorers" from "authenticated";

revoke update on table "public"."mastra_scorers" from "authenticated";

revoke delete on table "public"."mastra_scorers" from "service_role";

revoke insert on table "public"."mastra_scorers" from "service_role";

revoke references on table "public"."mastra_scorers" from "service_role";

revoke select on table "public"."mastra_scorers" from "service_role";

revoke trigger on table "public"."mastra_scorers" from "service_role";

revoke truncate on table "public"."mastra_scorers" from "service_role";

revoke update on table "public"."mastra_scorers" from "service_role";

revoke delete on table "public"."mastra_threads" from "anon";

revoke insert on table "public"."mastra_threads" from "anon";

revoke references on table "public"."mastra_threads" from "anon";

revoke select on table "public"."mastra_threads" from "anon";

revoke trigger on table "public"."mastra_threads" from "anon";

revoke truncate on table "public"."mastra_threads" from "anon";

revoke update on table "public"."mastra_threads" from "anon";

revoke delete on table "public"."mastra_threads" from "authenticated";

revoke insert on table "public"."mastra_threads" from "authenticated";

revoke references on table "public"."mastra_threads" from "authenticated";

revoke select on table "public"."mastra_threads" from "authenticated";

revoke trigger on table "public"."mastra_threads" from "authenticated";

revoke truncate on table "public"."mastra_threads" from "authenticated";

revoke update on table "public"."mastra_threads" from "authenticated";

revoke delete on table "public"."mastra_threads" from "service_role";

revoke insert on table "public"."mastra_threads" from "service_role";

revoke references on table "public"."mastra_threads" from "service_role";

revoke select on table "public"."mastra_threads" from "service_role";

revoke trigger on table "public"."mastra_threads" from "service_role";

revoke truncate on table "public"."mastra_threads" from "service_role";

revoke update on table "public"."mastra_threads" from "service_role";

revoke delete on table "public"."mastra_traces" from "anon";

revoke insert on table "public"."mastra_traces" from "anon";

revoke references on table "public"."mastra_traces" from "anon";

revoke select on table "public"."mastra_traces" from "anon";

revoke trigger on table "public"."mastra_traces" from "anon";

revoke truncate on table "public"."mastra_traces" from "anon";

revoke update on table "public"."mastra_traces" from "anon";

revoke delete on table "public"."mastra_traces" from "authenticated";

revoke insert on table "public"."mastra_traces" from "authenticated";

revoke references on table "public"."mastra_traces" from "authenticated";

revoke select on table "public"."mastra_traces" from "authenticated";

revoke trigger on table "public"."mastra_traces" from "authenticated";

revoke truncate on table "public"."mastra_traces" from "authenticated";

revoke update on table "public"."mastra_traces" from "authenticated";

revoke delete on table "public"."mastra_traces" from "service_role";

revoke insert on table "public"."mastra_traces" from "service_role";

revoke references on table "public"."mastra_traces" from "service_role";

revoke select on table "public"."mastra_traces" from "service_role";

revoke trigger on table "public"."mastra_traces" from "service_role";

revoke truncate on table "public"."mastra_traces" from "service_role";

revoke update on table "public"."mastra_traces" from "service_role";

revoke delete on table "public"."mastra_workflow_snapshot" from "anon";

revoke insert on table "public"."mastra_workflow_snapshot" from "anon";

revoke references on table "public"."mastra_workflow_snapshot" from "anon";

revoke select on table "public"."mastra_workflow_snapshot" from "anon";

revoke trigger on table "public"."mastra_workflow_snapshot" from "anon";

revoke truncate on table "public"."mastra_workflow_snapshot" from "anon";

revoke update on table "public"."mastra_workflow_snapshot" from "anon";

revoke delete on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke insert on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke references on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke select on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke trigger on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke truncate on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke update on table "public"."mastra_workflow_snapshot" from "authenticated";

revoke delete on table "public"."mastra_workflow_snapshot" from "service_role";

revoke insert on table "public"."mastra_workflow_snapshot" from "service_role";

revoke references on table "public"."mastra_workflow_snapshot" from "service_role";

revoke select on table "public"."mastra_workflow_snapshot" from "service_role";

revoke trigger on table "public"."mastra_workflow_snapshot" from "service_role";

revoke truncate on table "public"."mastra_workflow_snapshot" from "service_role";

revoke update on table "public"."mastra_workflow_snapshot" from "service_role";

alter table "public"."mastra_workflow_snapshot" drop constraint "public_mastra_workflow_snapshot_workflow_name_run_id_key";

alter table "public"."project_sections" drop constraint "project_sections_kind_fkey";

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."annotations" drop constraint "annotations_entity_type_check";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."entity_flags" drop constraint "entity_flags_entity_type_check";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

alter table "public"."votes" drop constraint "votes_entity_type_check";

drop view if exists "public"."insights_with_priority";

drop function if exists "public"."trigger_set_timestamps"();

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

alter table "public"."mastra_messages" drop constraint "mastra_messages_pkey";

alter table "public"."mastra_resources" drop constraint "mastra_resources_pkey";

alter table "public"."mastra_scorers" drop constraint "mastra_scorers_pkey";

alter table "public"."mastra_threads" drop constraint "mastra_threads_pkey";

alter table "public"."mastra_traces" drop constraint "mastra_traces_pkey";

drop index if exists "public"."mastra_messages_pkey";

drop index if exists "public"."mastra_resources_pkey";

drop index if exists "public"."mastra_scorers_pkey";

drop index if exists "public"."mastra_threads_pkey";

drop index if exists "public"."mastra_traces_pkey";

drop index if exists "public"."public_mastra_ai_spans_name_idx";

drop index if exists "public"."public_mastra_ai_spans_parentspanid_startedat_idx";

drop index if exists "public"."public_mastra_ai_spans_spantype_startedat_idx";

drop index if exists "public"."public_mastra_ai_spans_traceid_startedat_idx";

drop index if exists "public"."public_mastra_evals_agent_name_created_at_idx";

drop index if exists "public"."public_mastra_messages_thread_id_createdat_idx";

drop index if exists "public"."public_mastra_scores_trace_id_span_id_created_at_idx";

drop index if exists "public"."public_mastra_threads_resourceid_createdat_idx";

drop index if exists "public"."public_mastra_traces_name_starttime_idx";

drop index if exists "public"."public_mastra_workflow_snapshot_workflow_name_run_id_key";

drop table "public"."mastra_ai_spans";

drop table "public"."mastra_evals";

drop table "public"."mastra_messages";

drop table "public"."mastra_resources";

drop table "public"."mastra_scorers";

drop table "public"."mastra_threads";

drop table "public"."mastra_traces";

drop table "public"."mastra_workflow_snapshot";


  create table "public"."agent_task_runs" (
    "id" uuid not null default gen_random_uuid(),
    "task_id" uuid not null,
    "agent_type" text not null,
    "status" text not null default 'queued'::text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "output" text,
    "error" text,
    "logs" jsonb default '[]'::jsonb,
    "triggered_by" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."agent_task_runs" enable row level security;


  create table "public"."task_activity" (
    "id" uuid not null default gen_random_uuid(),
    "task_id" uuid not null,
    "activity_type" text not null,
    "field_name" text,
    "old_value" jsonb,
    "new_value" jsonb,
    "content" text,
    "user_id" uuid,
    "source" text default 'web'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."task_activity" enable row level security;


  create table "public"."tasks" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "cluster" text not null,
    "parent_task_id" uuid,
    "status" text not null default 'backlog'::text,
    "priority" integer not null default 3,
    "benefit" text,
    "segments" text,
    "impact" integer,
    "stage" text,
    "reason" text,
    "assigned_to" jsonb default '[]'::jsonb,
    "due_date" timestamp with time zone,
    "estimated_effort" text,
    "actual_hours" numeric(8,2),
    "tags" text[] default ARRAY[]::text[],
    "depends_on_task_ids" uuid[] default ARRAY[]::uuid[],
    "blocks_task_ids" uuid[] default ARRAY[]::uuid[],
    "account_id" uuid not null,
    "project_id" uuid not null,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone
      );


alter table "public"."tasks" enable row level security;

alter table "public"."annotations" add column "task_id" uuid;

-- alter table "public"."themes" drop column "category";

-- alter table "public"."themes" drop column "confidence";

-- alter table "public"."themes" drop column "contradictions";

-- alter table "public"."themes" drop column "desired_outcome";

-- alter table "public"."themes" drop column "details";

-- alter table "public"."themes" drop column "emotional_response";

-- alter table "public"."themes" drop column "evidence";

-- alter table "public"."themes" drop column "impact";

-- alter table "public"."themes" drop column "interview_id";

-- alter table "public"."themes" drop column "journey_stage";

-- alter table "public"."themes" drop column "jtbd";

-- alter table "public"."themes" drop column "motivation";

-- alter table "public"."themes" drop column "novelty";

-- alter table "public"."themes" drop column "opportunity_ideas";

-- alter table "public"."themes" drop column "pain";

-- alter table "public"."themes" drop column "related_tags";

drop extension if exists "pg_net";

CREATE UNIQUE INDEX agent_task_runs_pkey ON public.agent_task_runs USING btree (id);

CREATE INDEX idx_agent_runs_created ON public.agent_task_runs USING btree (created_at DESC);

CREATE INDEX idx_agent_runs_status ON public.agent_task_runs USING btree (status);

CREATE INDEX idx_agent_runs_task ON public.agent_task_runs USING btree (task_id);

CREATE INDEX idx_annotations_task ON public.annotations USING btree (task_id) WHERE (task_id IS NOT NULL);

CREATE INDEX idx_task_activity_created ON public.task_activity USING btree (created_at DESC);

CREATE INDEX idx_task_activity_task ON public.task_activity USING btree (task_id);

CREATE INDEX idx_task_activity_type ON public.task_activity USING btree (task_id, activity_type);

CREATE INDEX idx_tasks_account ON public.tasks USING btree (account_id);

CREATE INDEX idx_tasks_assigned_to ON public.tasks USING gin (assigned_to);

CREATE INDEX idx_tasks_cluster ON public.tasks USING btree (cluster);

CREATE INDEX idx_tasks_parent ON public.tasks USING btree (parent_task_id) WHERE (parent_task_id IS NOT NULL);

CREATE INDEX idx_tasks_priority_status ON public.tasks USING btree (project_id, priority, status);

CREATE INDEX idx_tasks_project ON public.tasks USING btree (project_id);

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);

CREATE INDEX idx_tasks_tags ON public.tasks USING gin (tags);

CREATE UNIQUE INDEX task_activity_pkey ON public.task_activity USING btree (id);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

alter table "public"."agent_task_runs" add constraint "agent_task_runs_pkey" PRIMARY KEY using index "agent_task_runs_pkey";

alter table "public"."task_activity" add constraint "task_activity_pkey" PRIMARY KEY using index "task_activity_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."agent_task_runs" add constraint "agent_task_runs_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE not valid;

alter table "public"."agent_task_runs" validate constraint "agent_task_runs_task_id_fkey";

alter table "public"."agent_task_runs" add constraint "agent_task_runs_triggered_by_fkey" FOREIGN KEY (triggered_by) REFERENCES auth.users(id) not valid;

alter table "public"."agent_task_runs" validate constraint "agent_task_runs_triggered_by_fkey";

alter table "public"."annotations" add constraint "annotations_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE not valid;

alter table "public"."annotations" validate constraint "annotations_task_id_fkey";

-- alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) not valid;

alter table "public"."insights" validate constraint "insights_interview_id_fkey";

alter table "public"."task_activity" add constraint "task_activity_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE not valid;

alter table "public"."task_activity" validate constraint "task_activity_task_id_fkey";

alter table "public"."task_activity" add constraint "task_activity_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."task_activity" validate constraint "task_activity_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_account_id_fkey";

alter table "public"."tasks" add constraint "tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."tasks" validate constraint "tasks_created_by_fkey";

alter table "public"."tasks" add constraint "tasks_estimated_effort_check" CHECK ((estimated_effort = ANY (ARRAY['S'::text, 'M'::text, 'L'::text, 'XL'::text]))) not valid;

alter table "public"."tasks" validate constraint "tasks_estimated_effort_check";

alter table "public"."tasks" add constraint "tasks_impact_check" CHECK (((impact >= 1) AND (impact <= 3))) not valid;

alter table "public"."tasks" validate constraint "tasks_impact_check";

alter table "public"."tasks" add constraint "tasks_parent_task_id_fkey" FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_parent_task_id_fkey";

alter table "public"."tasks" add constraint "tasks_priority_check" CHECK (((priority >= 1) AND (priority <= 3))) not valid;

alter table "public"."tasks" validate constraint "tasks_priority_check";

alter table "public"."tasks" add constraint "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_project_id_fkey";

alter table "public"."tasks" add constraint "tasks_stage_check" CHECK ((stage = ANY (ARRAY['activation'::text, 'onboarding'::text, 'retention'::text]))) not valid;

alter table "public"."tasks" validate constraint "tasks_stage_check";

alter table "public"."actions" add constraint "actions_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_insight_id_fkey";

alter table "public"."annotations" add constraint "annotations_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text, 'project'::text, 'organization'::text]))) not valid;

alter table "public"."annotations" validate constraint "annotations_entity_type_check";

alter table "public"."comments" add constraint "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.insights(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_insight_id_fkey";

alter table "public"."entity_flags" add constraint "entity_flags_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text, 'project'::text, 'organization'::text]))) not valid;

alter table "public"."entity_flags" validate constraint "entity_flags_entity_type_check";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" add constraint "opportunity_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_insights" validate constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" add constraint "persona_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."persona_insights" validate constraint "persona_insights_insight_id_fkey";

alter table "public"."votes" add constraint "votes_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text, 'project'::text, 'organization'::text]))) not valid;

alter table "public"."votes" validate constraint "votes_entity_type_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.register_project_section_kind()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Automatically add new kinds to the reference table for tracking
  INSERT INTO public.project_section_kinds (id)
  VALUES (NEW.kind)
  ON CONFLICT (id) DO NOTHING;
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
    duration_sec,
    status,
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
                                   'invitation_id', i.id
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '24 hours'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
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


grant delete on table "public"."agent_task_runs" to "anon";

grant insert on table "public"."agent_task_runs" to "anon";

grant references on table "public"."agent_task_runs" to "anon";

grant select on table "public"."agent_task_runs" to "anon";

grant trigger on table "public"."agent_task_runs" to "anon";

grant truncate on table "public"."agent_task_runs" to "anon";

grant update on table "public"."agent_task_runs" to "anon";

grant delete on table "public"."agent_task_runs" to "authenticated";

grant insert on table "public"."agent_task_runs" to "authenticated";

grant references on table "public"."agent_task_runs" to "authenticated";

grant select on table "public"."agent_task_runs" to "authenticated";

grant trigger on table "public"."agent_task_runs" to "authenticated";

grant truncate on table "public"."agent_task_runs" to "authenticated";

grant update on table "public"."agent_task_runs" to "authenticated";

grant delete on table "public"."agent_task_runs" to "service_role";

grant insert on table "public"."agent_task_runs" to "service_role";

grant references on table "public"."agent_task_runs" to "service_role";

grant select on table "public"."agent_task_runs" to "service_role";

grant trigger on table "public"."agent_task_runs" to "service_role";

grant truncate on table "public"."agent_task_runs" to "service_role";

grant update on table "public"."agent_task_runs" to "service_role";

grant delete on table "public"."task_activity" to "anon";

grant insert on table "public"."task_activity" to "anon";

grant references on table "public"."task_activity" to "anon";

grant select on table "public"."task_activity" to "anon";

grant trigger on table "public"."task_activity" to "anon";

grant truncate on table "public"."task_activity" to "anon";

grant update on table "public"."task_activity" to "anon";

grant delete on table "public"."task_activity" to "authenticated";

grant insert on table "public"."task_activity" to "authenticated";

grant references on table "public"."task_activity" to "authenticated";

grant select on table "public"."task_activity" to "authenticated";

grant trigger on table "public"."task_activity" to "authenticated";

grant truncate on table "public"."task_activity" to "authenticated";

grant update on table "public"."task_activity" to "authenticated";

grant delete on table "public"."task_activity" to "service_role";

grant insert on table "public"."task_activity" to "service_role";

grant references on table "public"."task_activity" to "service_role";

grant select on table "public"."task_activity" to "service_role";

grant trigger on table "public"."task_activity" to "service_role";

grant truncate on table "public"."task_activity" to "service_role";

grant update on table "public"."task_activity" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";


  create policy "Users can create runs for accessible tasks"
  on "public"."agent_task_runs"
  as permissive
  for insert
  to authenticated
with check ((task_id IN ( SELECT tasks.id
   FROM public.tasks
  WHERE (tasks.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));



  create policy "Users can view runs for accessible tasks"
  on "public"."agent_task_runs"
  as permissive
  for select
  to authenticated
using ((task_id IN ( SELECT tasks.id
   FROM public.tasks
  WHERE (tasks.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));



  create policy "Users can create activity for accessible tasks"
  on "public"."task_activity"
  as permissive
  for insert
  to authenticated
with check ((task_id IN ( SELECT tasks.id
   FROM public.tasks
  WHERE (tasks.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));



  create policy "Users can view activity for accessible tasks"
  on "public"."task_activity"
  as permissive
  for select
  to authenticated
using ((task_id IN ( SELECT tasks.id
   FROM public.tasks
  WHERE (tasks.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));



  create policy "Account members can insert"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
with check (((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)) AND (project_id IN ( SELECT p.id
   FROM public.projects p
  WHERE (p.account_id = p.account_id)))));



  create policy "Account members can select"
  on "public"."tasks"
  as permissive
  for select
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can update"
  on "public"."tasks"
  as permissive
  for update
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))
with check (((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)) AND (project_id IN ( SELECT p.id
   FROM public.projects p
  WHERE (p.account_id = p.account_id)))));



  create policy "Account owners can delete"
  on "public"."tasks"
  as permissive
  for delete
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


CREATE TRIGGER trg_register_section_kind AFTER INSERT ON public.project_sections FOR EACH ROW EXECUTE FUNCTION public.register_project_section_kind();

CREATE TRIGGER set_tasks_timestamp BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_tasks_user_tracking BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();
