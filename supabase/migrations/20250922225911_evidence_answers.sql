alter table "public"."project_answers" drop constraint if exists "project_answers_status_check";

alter table "public"."evidence" add column if not exists "project_answer_id" uuid;

alter table "public"."project_answers" add column if not exists "answered_at" timestamp with time zone;

alter table "public"."project_answers" add column if not exists "asked_at" timestamp with time zone;

alter table "public"."project_answers" add column if not exists "decision_question_id" uuid;

alter table "public"."project_answers" add column if not exists "detected_question_text" text;

alter table "public"."project_answers" add column if not exists "estimated_time_minutes" integer;

alter table "public"."project_answers" add column if not exists "followup_of_answer_id" uuid;

alter table "public"."project_answers" add column if not exists "order_index" integer;

alter table "public"."project_answers" add column if not exists "origin" text;

alter table "public"."project_answers" alter column "origin" set default 'scripted'::text;

alter table "public"."project_answers" add column if not exists "prompt_id" uuid;

alter table "public"."project_answers" add column if not exists "question_category" text;

alter table "public"."project_answers" add column if not exists "research_question_id" uuid;

alter table "public"."project_answers" add column if not exists "skipped_at" timestamp with time zone;

alter table "public"."project_answers" alter column "status" set default 'planned'::text;

CREATE INDEX IF NOT EXISTS idx_evidence_project_answer ON public.evidence USING btree (project_answer_id);

CREATE INDEX IF NOT EXISTS idx_project_answers_decision_question ON public.project_answers USING btree (project_id, decision_question_id);

CREATE INDEX IF NOT EXISTS idx_project_answers_followup ON public.project_answers USING btree (followup_of_answer_id);

CREATE INDEX IF NOT EXISTS idx_project_answers_order ON public.project_answers USING btree (interview_id, order_index);

CREATE INDEX IF NOT EXISTS idx_project_answers_origin ON public.project_answers USING btree (origin);

CREATE INDEX IF NOT EXISTS idx_project_answers_prompt_id ON public.project_answers USING btree (prompt_id);

CREATE INDEX IF NOT EXISTS idx_project_answers_research_question ON public.project_answers USING btree (project_id, research_question_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evidence_project_answer_id_fkey') then
    execute 'alter table public.evidence add constraint evidence_project_answer_id_fkey foreign key (project_answer_id) references project_answers(id) on delete set null not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'evidence_project_answer_id_fkey') then
    execute 'alter table public.evidence validate constraint evidence_project_answer_id_fkey';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_answers_decision_question_id_fkey') then
    execute 'alter table public.project_answers add constraint project_answers_decision_question_id_fkey foreign key (decision_question_id) references decision_questions(id) on delete set null not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_answers_decision_question_id_fkey') then
    execute 'alter table public.project_answers validate constraint project_answers_decision_question_id_fkey';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_answers_followup_of_answer_id_fkey') then
    execute 'alter table public.project_answers add constraint project_answers_followup_of_answer_id_fkey foreign key (followup_of_answer_id) references project_answers(id) on delete set null not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_answers_followup_of_answer_id_fkey') then
    execute 'alter table public.project_answers validate constraint project_answers_followup_of_answer_id_fkey';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_answers_origin_check') then
    execute 'alter table public.project_answers add constraint project_answers_origin_check check ((origin = ANY (ARRAY[''scripted''::text, ''ad_hoc''::text, ''retro''::text]))) not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_answers_origin_check') then
    execute 'alter table public.project_answers validate constraint project_answers_origin_check';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_answers_prompt_id_fkey') then
    execute 'alter table public.project_answers add constraint project_answers_prompt_id_fkey foreign key (prompt_id) references interview_prompts(id) on delete set null not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_answers_prompt_id_fkey') then
    execute 'alter table public.project_answers validate constraint project_answers_prompt_id_fkey';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_answers_research_question_id_fkey') then
    execute 'alter table public.project_answers add constraint project_answers_research_question_id_fkey foreign key (research_question_id) references research_questions(id) on delete set null not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_answers_research_question_id_fkey') then
    execute 'alter table public.project_answers validate constraint project_answers_research_question_id_fkey';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_answers_status_check') then
    execute 'alter table public.project_answers add constraint project_answers_status_check check ((status = ANY (ARRAY[''planned''::text, ''asked''::text, ''answered''::text, ''skipped''::text, ''ad_hoc''::text]))) not valid';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_answers_status_check') then
    execute 'alter table public.project_answers validate constraint project_answers_status_check';
  end if;
end $$;

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
