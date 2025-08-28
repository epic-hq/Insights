create table "public"."project_answer_evidence" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "answer_id" uuid not null,
    "interview_id" uuid,
    "source" text not null,
    "text" text,
    "start_seconds" numeric,
    "end_seconds" numeric,
    "transcript_chunk_id" uuid,
    "payload" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."project_answer_evidence" enable row level security;

create table "public"."project_answers" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "interview_id" uuid,
    "interviewer_user_id" uuid,
    "respondent_person_id" uuid,
    "question_id" text,
    "question_text" text not null,
    "status" text default 'asked'::text,
    "answer_text" text,
    "confidence" numeric,
    "time_spent_seconds" integer,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."project_answers" enable row level security;

CREATE INDEX idx_pae_answer ON public.project_answer_evidence USING btree (answer_id);

CREATE INDEX idx_pae_interview ON public.project_answer_evidence USING btree (interview_id);

CREATE INDEX idx_pae_payload_gin ON public.project_answer_evidence USING gin (payload);

CREATE INDEX idx_pae_project ON public.project_answer_evidence USING btree (project_id);

CREATE INDEX idx_pae_source ON public.project_answer_evidence USING btree (source);

CREATE INDEX idx_pae_times ON public.project_answer_evidence USING btree (start_seconds, end_seconds);

CREATE INDEX idx_project_answers_created_at ON public.project_answers USING btree (created_at);

CREATE INDEX idx_project_answers_interview_id ON public.project_answers USING btree (interview_id);

CREATE INDEX idx_project_answers_project_id ON public.project_answers USING btree (project_id);

CREATE INDEX idx_project_answers_question_id ON public.project_answers USING btree (question_id);

CREATE INDEX idx_project_answers_respondent_id ON public.project_answers USING btree (respondent_person_id);

CREATE INDEX idx_project_answers_status ON public.project_answers USING btree (status);

CREATE UNIQUE INDEX project_answer_evidence_pkey ON public.project_answer_evidence USING btree (id);

CREATE UNIQUE INDEX project_answers_pkey ON public.project_answers USING btree (id);

alter table "public"."project_answer_evidence" add constraint "project_answer_evidence_pkey" PRIMARY KEY using index "project_answer_evidence_pkey";

alter table "public"."project_answers" add constraint "project_answers_pkey" PRIMARY KEY using index "project_answers_pkey";

alter table "public"."project_answer_evidence" add constraint "project_answer_evidence_answer_id_fkey" FOREIGN KEY (answer_id) REFERENCES project_answers(id) ON DELETE CASCADE not valid;

alter table "public"."project_answer_evidence" validate constraint "project_answer_evidence_answer_id_fkey";

alter table "public"."project_answer_evidence" add constraint "project_answer_evidence_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL not valid;

alter table "public"."project_answer_evidence" validate constraint "project_answer_evidence_interview_id_fkey";

alter table "public"."project_answer_evidence" add constraint "project_answer_evidence_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_answer_evidence" validate constraint "project_answer_evidence_project_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_confidence_check" CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))) not valid;

alter table "public"."project_answers" validate constraint "project_answers_confidence_check";

alter table "public"."project_answers" add constraint "project_answers_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_interview_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_interviewer_user_id_fkey" FOREIGN KEY (interviewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_interviewer_user_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_answers" validate constraint "project_answers_project_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_respondent_person_id_fkey" FOREIGN KEY (respondent_person_id) REFERENCES people(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_respondent_person_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_status_check" CHECK ((status = ANY (ARRAY['asked'::text, 'answered'::text, 'skipped'::text, 'followup'::text]))) not valid;

alter table "public"."project_answers" validate constraint "project_answers_status_check";

grant delete on table "public"."project_answer_evidence" to "anon";

grant insert on table "public"."project_answer_evidence" to "anon";

grant references on table "public"."project_answer_evidence" to "anon";

grant select on table "public"."project_answer_evidence" to "anon";

grant trigger on table "public"."project_answer_evidence" to "anon";

grant truncate on table "public"."project_answer_evidence" to "anon";

grant update on table "public"."project_answer_evidence" to "anon";

grant delete on table "public"."project_answer_evidence" to "authenticated";

grant insert on table "public"."project_answer_evidence" to "authenticated";

grant references on table "public"."project_answer_evidence" to "authenticated";

grant select on table "public"."project_answer_evidence" to "authenticated";

grant trigger on table "public"."project_answer_evidence" to "authenticated";

grant truncate on table "public"."project_answer_evidence" to "authenticated";

grant update on table "public"."project_answer_evidence" to "authenticated";

grant delete on table "public"."project_answer_evidence" to "service_role";

grant insert on table "public"."project_answer_evidence" to "service_role";

grant references on table "public"."project_answer_evidence" to "service_role";

grant select on table "public"."project_answer_evidence" to "service_role";

grant trigger on table "public"."project_answer_evidence" to "service_role";

grant truncate on table "public"."project_answer_evidence" to "service_role";

grant update on table "public"."project_answer_evidence" to "service_role";

grant delete on table "public"."project_answers" to "anon";

grant insert on table "public"."project_answers" to "anon";

grant references on table "public"."project_answers" to "anon";

grant select on table "public"."project_answers" to "anon";

grant trigger on table "public"."project_answers" to "anon";

grant truncate on table "public"."project_answers" to "anon";

grant update on table "public"."project_answers" to "anon";

grant delete on table "public"."project_answers" to "authenticated";

grant insert on table "public"."project_answers" to "authenticated";

grant references on table "public"."project_answers" to "authenticated";

grant select on table "public"."project_answers" to "authenticated";

grant trigger on table "public"."project_answers" to "authenticated";

grant truncate on table "public"."project_answers" to "authenticated";

grant update on table "public"."project_answers" to "authenticated";

grant delete on table "public"."project_answers" to "service_role";

grant insert on table "public"."project_answers" to "service_role";

grant references on table "public"."project_answers" to "service_role";

grant select on table "public"."project_answers" to "service_role";

grant trigger on table "public"."project_answers" to "service_role";

grant truncate on table "public"."project_answers" to "service_role";

grant update on table "public"."project_answers" to "service_role";

create policy "Account members can insert evidence"
on "public"."project_answer_evidence"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answer_evidence.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can select evidence"
on "public"."project_answer_evidence"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answer_evidence.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can update evidence"
on "public"."project_answer_evidence"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answer_evidence.project_id) AND accounts.has_role_on_account(p.account_id)))))
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answer_evidence.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account owners can delete evidence"
on "public"."project_answer_evidence"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answer_evidence.project_id) AND accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)))));


create policy "Account members can insert project_answers"
on "public"."project_answers"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answers.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can select project_answers"
on "public"."project_answers"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answers.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account members can update project_answers"
on "public"."project_answers"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answers.project_id) AND accounts.has_role_on_account(p.account_id)))))
with check ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answers.project_id) AND accounts.has_role_on_account(p.account_id)))));


create policy "Account owners can delete project_answers"
on "public"."project_answers"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_answers.project_id) AND accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)))));


CREATE TRIGGER set_project_answer_evidence_timestamp BEFORE INSERT OR UPDATE ON public.project_answer_evidence FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_project_answer_evidence_user_tracking BEFORE INSERT OR UPDATE ON public.project_answer_evidence FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_project_answers_timestamp BEFORE INSERT OR UPDATE ON public.project_answers FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_project_answers_user_tracking BEFORE INSERT OR UPDATE ON public.project_answers FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


