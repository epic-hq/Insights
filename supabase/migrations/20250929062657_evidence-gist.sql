-- 20250929062657_evidence-gist.sql
BEGIN;

-- Be explicit
SET search_path = public;

-- 1) Drop dependent summary views first
DROP VIEW IF EXISTS public.decision_question_summary CASCADE;
DROP VIEW IF EXISTS public.research_question_summary CASCADE;

-- 2) Drop metrics view used by the summaries
DROP VIEW IF EXISTS public.project_answer_metrics;

-- 3) Schema changes (safe to re-run)
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS chunk text;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS gist  text;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS topic text;

-- 4) Recreate metrics view (base for summaries)
CREATE OR REPLACE VIEW public.project_answer_metrics AS
SELECT
  pa.project_id,
  pa.id AS project_answer_id,
  pa.prompt_id,
  pa.research_question_id,
  pa.decision_question_id,
  pa.interview_id,
  pa.respondent_person_id,
  pa.status,
  pa.answered_at,
  COALESCE(COUNT(e.id), 0)::bigint                                           AS evidence_count,
  COALESCE(COUNT(DISTINCT COALESCE(e.interview_id, pa.interview_id)), 0)::bigint AS interview_count,
  COALESCE(COUNT(DISTINCT pp.persona_id), 0)::bigint                          AS persona_count
FROM public.project_answers pa
LEFT JOIN public.evidence e
  ON e.project_answer_id = pa.id
LEFT JOIN public.people_personas pp
  ON pp.person_id = pa.respondent_person_id
 AND pp.project_id = pa.project_id
GROUP BY
  pa.project_id, pa.id, pa.prompt_id, pa.research_question_id,
  pa.decision_question_id, pa.interview_id, pa.respondent_person_id,
  pa.status, pa.answered_at;

-- 5) Recreate research_question_summary
CREATE OR REPLACE VIEW public.research_question_summary AS
SELECT
  rq.project_id,
  rq.id  AS research_question_id,
  rq.decision_question_id,
  rq.text AS research_question_text,
  COALESCE(COUNT(DISTINCT pa.id)
           FILTER (WHERE pa.status = ANY (ARRAY['answered','ad_hoc'])), 0)::bigint AS answered_answer_count,
  COALESCE(COUNT(DISTINCT pa.id)
           FILTER (WHERE pa.status = ANY (ARRAY['planned','asked'])), 0)::bigint     AS open_answer_count,
  COALESCE(SUM(m.evidence_count), 0)::numeric                                       AS evidence_count,
  COALESCE(COUNT(DISTINCT pa.interview_id), 0)::bigint                               AS interview_count,
  COALESCE(COUNT(DISTINCT pp.persona_id), 0)::bigint                                 AS persona_count
FROM public.research_questions rq
LEFT JOIN public.project_answers pa
  ON pa.research_question_id = rq.id
LEFT JOIN public.project_answer_metrics m
  ON m.project_answer_id = pa.id
LEFT JOIN public.people_personas pp
  ON pp.person_id = pa.respondent_person_id
 AND pp.project_id = rq.project_id
GROUP BY
  rq.project_id, rq.id, rq.decision_question_id, rq.text;

-- 6) Recreate decision_question_summary
CREATE OR REPLACE VIEW public.decision_question_summary AS
SELECT
  dq.project_id,
  dq.id  AS decision_question_id,
  dq.text AS decision_question_text,
  COALESCE(COUNT(DISTINCT rq.id), 0)::bigint                                        AS research_question_count,
  COALESCE(COUNT(DISTINCT pa.id)
           FILTER (WHERE pa.status = ANY (ARRAY['answered','ad_hoc'])), 0)::bigint  AS answered_answer_count,
  COALESCE(COUNT(DISTINCT pa.id)
           FILTER (WHERE pa.status = ANY (ARRAY['planned','asked'])), 0)::bigint    AS open_answer_count,
  COALESCE(SUM(m.evidence_count), 0)::numeric                                       AS evidence_count,
  COALESCE(COUNT(DISTINCT pa.interview_id), 0)::bigint                               AS interview_count,
  COALESCE(COUNT(DISTINCT pp.persona_id), 0)::bigint                                 AS persona_count
FROM public.decision_questions dq
LEFT JOIN public.research_questions rq
  ON rq.decision_question_id = dq.id
LEFT JOIN public.project_answers pa
  ON pa.decision_question_id = dq.id
LEFT JOIN public.project_answer_metrics m
  ON m.project_answer_id = pa.id
LEFT JOIN public.people_personas pp
  ON pp.person_id = pa.respondent_person_id
 AND pp.project_id = dq.project_id
GROUP BY
  dq.project_id, dq.id, dq.text;

COMMIT;
