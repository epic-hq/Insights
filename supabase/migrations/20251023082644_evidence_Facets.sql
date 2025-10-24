drop view if exists "public"."decision_question_summary";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."project_answer_metrics";

drop index if exists "public"."idx_evidence_kind_tags";

create table "public"."evidence_facet" (
    "id" uuid not null default gen_random_uuid(),
    "evidence_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid,
    "kind_slug" text not null,
    "facet_ref" text,
    "label" text not null,
    "source" text not null default 'interview'::text,
    "quote" text,
    "confidence" numeric default 0.8,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
);


alter table "public"."evidence_facet" enable row level security;

alter table "public"."evidence" drop column "kind_tags";

CREATE UNIQUE INDEX evidence_facet_pkey ON public.evidence_facet USING btree (id);

CREATE INDEX idx_evidence_facet_account_id ON public.evidence_facet USING btree (account_id);

CREATE INDEX idx_evidence_facet_evidence_id ON public.evidence_facet USING btree (evidence_id);

CREATE INDEX idx_evidence_facet_kind_slug ON public.evidence_facet USING btree (kind_slug);

CREATE INDEX idx_evidence_facet_project_id ON public.evidence_facet USING btree (project_id);

alter table "public"."evidence_facet" add constraint "evidence_facet_pkey" PRIMARY KEY using index "evidence_facet_pkey";

alter table "public"."evidence_facet" add constraint "evidence_facet_confidence_check" CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))) not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_confidence_check";

alter table "public"."evidence_facet" add constraint "evidence_facet_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_created_by_fkey";

alter table "public"."evidence_facet" add constraint "evidence_facet_evidence_id_fkey" FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_evidence_id_fkey";

alter table "public"."evidence_facet" add constraint "evidence_facet_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_project_id_fkey";

alter table "public"."evidence_facet" add constraint "evidence_facet_ref_pattern" CHECK (((facet_ref IS NULL) OR (facet_ref ~ '^(g|a|p):[0-9a-zA-Z-]+$'::text))) not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_ref_pattern";

alter table "public"."evidence_facet" add constraint "evidence_facet_source_check" CHECK ((source = ANY (ARRAY['interview'::text, 'survey'::text, 'telemetry'::text, 'inferred'::text, 'manual'::text, 'document'::text]))) not valid;

alter table "public"."evidence_facet" validate constraint "evidence_facet_source_check";

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


grant delete on table "public"."evidence_facet" to "anon";

grant insert on table "public"."evidence_facet" to "anon";

grant references on table "public"."evidence_facet" to "anon";

grant select on table "public"."evidence_facet" to "anon";

grant trigger on table "public"."evidence_facet" to "anon";

grant truncate on table "public"."evidence_facet" to "anon";

grant update on table "public"."evidence_facet" to "anon";

grant delete on table "public"."evidence_facet" to "authenticated";

grant insert on table "public"."evidence_facet" to "authenticated";

grant references on table "public"."evidence_facet" to "authenticated";

grant select on table "public"."evidence_facet" to "authenticated";

grant trigger on table "public"."evidence_facet" to "authenticated";

grant truncate on table "public"."evidence_facet" to "authenticated";

grant update on table "public"."evidence_facet" to "authenticated";

grant delete on table "public"."evidence_facet" to "service_role";

grant insert on table "public"."evidence_facet" to "service_role";

grant references on table "public"."evidence_facet" to "service_role";

grant select on table "public"."evidence_facet" to "service_role";

grant trigger on table "public"."evidence_facet" to "service_role";

grant truncate on table "public"."evidence_facet" to "service_role";

grant update on table "public"."evidence_facet" to "service_role";

create policy "Account members can insert"
on "public"."evidence_facet"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."evidence_facet"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."evidence_facet"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."evidence_facet"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


CREATE TRIGGER set_evidence_facet_timestamp BEFORE INSERT OR UPDATE ON public.evidence_facet FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_evidence_facet_user_tracking BEFORE INSERT OR UPDATE ON public.evidence_facet FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


