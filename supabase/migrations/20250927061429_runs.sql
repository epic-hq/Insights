set search_path = public;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'research_analysis_question_kind'
      and n.nspname = 'public'
  ) then
    create type public.research_analysis_question_kind as enum ('decision', 'research');
  end if;
end
$$;

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."project_answer_metrics";

create table if not exists "public"."project_question_analysis" (
    "id" uuid not null default gen_random_uuid(),
    "run_id" uuid not null,
    "project_id" uuid not null,
    "question_type" research_analysis_question_kind not null,
    "question_id" uuid not null,
    "summary" text,
    "confidence" numeric,
    "next_steps" text,
    "goal_achievement_summary" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."project_question_analysis" enable row level security;

create table if not exists "public"."project_research_analysis_runs" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "triggered_by" uuid,
    "custom_instructions" text,
    "min_confidence" numeric default 0.6,
    "run_summary" text,
    "recommended_actions" jsonb default '[]'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."project_research_analysis_runs" enable row level security;

alter table "public"."project_answers" add column "analysis_next_steps" text;

alter table "public"."project_answers" add column "analysis_rationale" text;

alter table "public"."project_answers" add column "analysis_run_metadata" jsonb;

alter table "public"."project_answers" add column "analysis_summary" text;

CREATE UNIQUE INDEX idx_pae_unique_answer_evidence ON public.project_answer_evidence USING btree (project_id, answer_id);

CREATE INDEX idx_project_analysis_runs_project ON public.project_research_analysis_runs USING btree (project_id, created_at DESC);

CREATE INDEX idx_project_question_analysis_project ON public.project_question_analysis USING btree (project_id);

CREATE INDEX idx_project_question_analysis_question ON public.project_question_analysis USING btree (question_id, question_type);

CREATE INDEX idx_project_question_analysis_run ON public.project_question_analysis USING btree (run_id);

CREATE UNIQUE INDEX project_question_analysis_pkey ON public.project_question_analysis USING btree (id);

CREATE UNIQUE INDEX project_question_analysis_run_id_question_type_question_id_key ON public.project_question_analysis USING btree (run_id, question_type, question_id);

CREATE UNIQUE INDEX project_research_analysis_runs_pkey ON public.project_research_analysis_runs USING btree (id);

alter table "public"."project_question_analysis" add constraint "project_question_analysis_pkey" PRIMARY KEY using index "project_question_analysis_pkey";

alter table "public"."project_research_analysis_runs" add constraint "project_research_analysis_runs_pkey" PRIMARY KEY using index "project_research_analysis_runs_pkey";

alter table "public"."project_question_analysis" add constraint "project_question_analysis_confidence_check" CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))) not valid;

alter table "public"."project_question_analysis" validate constraint "project_question_analysis_confidence_check";

alter table "public"."project_question_analysis" add constraint "project_question_analysis_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_question_analysis" validate constraint "project_question_analysis_project_id_fkey";

alter table "public"."project_question_analysis" add constraint "project_question_analysis_run_id_fkey" FOREIGN KEY (run_id) REFERENCES project_research_analysis_runs(id) ON DELETE CASCADE not valid;

alter table "public"."project_question_analysis" validate constraint "project_question_analysis_run_id_fkey";

alter table "public"."project_question_analysis" add constraint "project_question_analysis_run_id_question_type_question_id_key" UNIQUE using index "project_question_analysis_run_id_question_type_question_id_key";

alter table "public"."project_research_analysis_runs" add constraint "project_research_analysis_runs_min_confidence_check" CHECK (((min_confidence >= (0)::numeric) AND (min_confidence <= (1)::numeric))) not valid;

alter table "public"."project_research_analysis_runs" validate constraint "project_research_analysis_runs_min_confidence_check";

alter table "public"."project_research_analysis_runs" add constraint "project_research_analysis_runs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_research_analysis_runs" validate constraint "project_research_analysis_runs_project_id_fkey";

alter table "public"."project_research_analysis_runs" add constraint "project_research_analysis_runs_triggered_by_fkey" FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."project_research_analysis_runs" validate constraint "project_research_analysis_runs_triggered_by_fkey";

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


grant delete on table "public"."project_question_analysis" to "anon";

grant insert on table "public"."project_question_analysis" to "anon";

grant references on table "public"."project_question_analysis" to "anon";

grant select on table "public"."project_question_analysis" to "anon";

grant trigger on table "public"."project_question_analysis" to "anon";

grant truncate on table "public"."project_question_analysis" to "anon";

grant update on table "public"."project_question_analysis" to "anon";

grant delete on table "public"."project_question_analysis" to "authenticated";

grant insert on table "public"."project_question_analysis" to "authenticated";

grant references on table "public"."project_question_analysis" to "authenticated";

grant select on table "public"."project_question_analysis" to "authenticated";

grant trigger on table "public"."project_question_analysis" to "authenticated";

grant truncate on table "public"."project_question_analysis" to "authenticated";

grant update on table "public"."project_question_analysis" to "authenticated";

grant delete on table "public"."project_question_analysis" to "service_role";

grant insert on table "public"."project_question_analysis" to "service_role";

grant references on table "public"."project_question_analysis" to "service_role";

grant select on table "public"."project_question_analysis" to "service_role";

grant trigger on table "public"."project_question_analysis" to "service_role";

grant truncate on table "public"."project_question_analysis" to "service_role";

grant update on table "public"."project_question_analysis" to "service_role";

grant delete on table "public"."project_research_analysis_runs" to "anon";

grant insert on table "public"."project_research_analysis_runs" to "anon";

grant references on table "public"."project_research_analysis_runs" to "anon";

grant select on table "public"."project_research_analysis_runs" to "anon";

grant trigger on table "public"."project_research_analysis_runs" to "anon";

grant truncate on table "public"."project_research_analysis_runs" to "anon";

grant update on table "public"."project_research_analysis_runs" to "anon";

grant delete on table "public"."project_research_analysis_runs" to "authenticated";

grant insert on table "public"."project_research_analysis_runs" to "authenticated";

grant references on table "public"."project_research_analysis_runs" to "authenticated";

grant select on table "public"."project_research_analysis_runs" to "authenticated";

grant trigger on table "public"."project_research_analysis_runs" to "authenticated";

grant truncate on table "public"."project_research_analysis_runs" to "authenticated";

grant update on table "public"."project_research_analysis_runs" to "authenticated";

grant delete on table "public"."project_research_analysis_runs" to "service_role";

grant insert on table "public"."project_research_analysis_runs" to "service_role";

grant references on table "public"."project_research_analysis_runs" to "service_role";

grant select on table "public"."project_research_analysis_runs" to "service_role";

grant trigger on table "public"."project_research_analysis_runs" to "service_role";

grant truncate on table "public"."project_research_analysis_runs" to "service_role";

grant update on table "public"."project_research_analysis_runs" to "service_role";

create policy "Account members can insert project question analysis"
on "public"."project_question_analysis"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_question_analysis.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can select project question analysis"
on "public"."project_question_analysis"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_question_analysis.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can update project question analysis"
on "public"."project_question_analysis"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_question_analysis.project_id) AND accounts.has_role_on_account(p.account_id)))))
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_question_analysis.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account owners can delete project question analysis"
on "public"."project_question_analysis"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_question_analysis.project_id) AND accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)))));


create policy "Account members can insert project analysis runs"
on "public"."project_research_analysis_runs"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_research_analysis_runs.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can select project analysis runs"
on "public"."project_research_analysis_runs"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_research_analysis_runs.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can update project analysis runs"
on "public"."project_research_analysis_runs"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_research_analysis_runs.project_id) AND accounts.has_role_on_account(p.account_id)))))
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_research_analysis_runs.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account owners can delete project analysis runs"
on "public"."project_research_analysis_runs"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_research_analysis_runs.project_id) AND accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)))));


CREATE TRIGGER set_project_question_analysis_timestamp BEFORE INSERT OR UPDATE ON public.project_question_analysis FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_project_question_analysis_user_tracking BEFORE INSERT OR UPDATE ON public.project_question_analysis FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_project_analysis_runs_timestamp BEFORE INSERT OR UPDATE ON public.project_research_analysis_runs FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_project_analysis_runs_user_tracking BEFORE INSERT OR UPDATE ON public.project_research_analysis_runs FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();
