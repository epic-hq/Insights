alter table "public"."project_answers" drop constraint "project_answers_status_check";

alter table "public"."evidence" add column "project_answer_id" uuid;

alter table "public"."project_answers" add column "answered_at" timestamp with time zone;

alter table "public"."project_answers" add column "asked_at" timestamp with time zone;

alter table "public"."project_answers" add column "decision_question_id" uuid;

alter table "public"."project_answers" add column "detected_question_text" text;

alter table "public"."project_answers" add column "estimated_time_minutes" integer;

alter table "public"."project_answers" add column "followup_of_answer_id" uuid;

alter table "public"."project_answers" add column "order_index" integer;

alter table "public"."project_answers" add column "origin" text default 'scripted'::text;

alter table "public"."project_answers" add column "prompt_id" uuid;

alter table "public"."project_answers" add column "question_category" text;

alter table "public"."project_answers" add column "research_question_id" uuid;

alter table "public"."project_answers" add column "skipped_at" timestamp with time zone;

alter table "public"."project_answers" alter column "status" set default 'planned'::text;

CREATE INDEX idx_evidence_project_answer ON public.evidence USING btree (project_answer_id);

CREATE INDEX idx_project_answers_decision_question ON public.project_answers USING btree (project_id, decision_question_id);

CREATE INDEX idx_project_answers_followup ON public.project_answers USING btree (followup_of_answer_id);

CREATE INDEX idx_project_answers_order ON public.project_answers USING btree (interview_id, order_index);

CREATE INDEX idx_project_answers_origin ON public.project_answers USING btree (origin);

CREATE INDEX idx_project_answers_prompt_id ON public.project_answers USING btree (prompt_id);

CREATE INDEX idx_project_answers_research_question ON public.project_answers USING btree (project_id, research_question_id);

alter table "public"."evidence" add constraint "evidence_project_answer_id_fkey" FOREIGN KEY (project_answer_id) REFERENCES project_answers(id) ON DELETE SET NULL not valid;

alter table "public"."evidence" validate constraint "evidence_project_answer_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_decision_question_id_fkey" FOREIGN KEY (decision_question_id) REFERENCES decision_questions(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_decision_question_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_followup_of_answer_id_fkey" FOREIGN KEY (followup_of_answer_id) REFERENCES project_answers(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_followup_of_answer_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_origin_check" CHECK ((origin = ANY (ARRAY['scripted'::text, 'ad_hoc'::text, 'retro'::text]))) not valid;

alter table "public"."project_answers" validate constraint "project_answers_origin_check";

alter table "public"."project_answers" add constraint "project_answers_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES interview_prompts(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_prompt_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_research_question_id_fkey" FOREIGN KEY (research_question_id) REFERENCES research_questions(id) ON DELETE SET NULL not valid;

alter table "public"."project_answers" validate constraint "project_answers_research_question_id_fkey";

alter table "public"."project_answers" add constraint "project_answers_status_check" CHECK ((status = ANY (ARRAY['planned'::text, 'asked'::text, 'answered'::text, 'skipped'::text, 'ad_hoc'::text]))) not valid;

alter table "public"."project_answers" validate constraint "project_answers_status_check";

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



