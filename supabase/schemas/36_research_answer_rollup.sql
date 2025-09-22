-- Research answer rollups ---------------------------------------------------
-- Views providing aggregated coverage from answers/evidence up to research and decision questions.

set search_path = public;

create or replace view public.project_answer_metrics with (security_invoker = on) as
select
  pa.project_id,
  pa.id as project_answer_id,
  pa.prompt_id,
  pa.research_question_id,
  pa.decision_question_id,
  pa.interview_id,
  pa.respondent_person_id,
  pa.status,
  pa.answered_at,
  coalesce(count(e.id), 0) as evidence_count,
  coalesce(count(distinct coalesce(e.interview_id, pa.interview_id)), 0) as interview_count,
  coalesce(count(distinct pp.persona_id), 0) as persona_count
from public.project_answers pa
left join public.evidence e on e.project_answer_id = pa.id
left join public.people_personas pp
  on pp.person_id = pa.respondent_person_id
 and pp.project_id = pa.project_id
group by
  pa.project_id,
  pa.id,
  pa.prompt_id,
  pa.research_question_id,
  pa.decision_question_id,
  pa.interview_id,
  pa.respondent_person_id,
  pa.status,
  pa.answered_at;

create or replace view public.research_question_summary with (security_invoker = on) as
select
  rq.project_id,
  rq.id as research_question_id,
  rq.decision_question_id,
  rq.text as research_question_text,
  coalesce(count(distinct pa.id) filter (where pa.status in ('answered','ad_hoc')), 0) as answered_answer_count,
  coalesce(count(distinct pa.id) filter (where pa.status in ('planned','asked')), 0) as open_answer_count,
  coalesce(sum(m.evidence_count), 0) as evidence_count,
  coalesce(count(distinct pa.interview_id), 0) as interview_count,
  coalesce(count(distinct pp.persona_id), 0) as persona_count
from public.research_questions rq
left join public.project_answers pa on pa.research_question_id = rq.id
left join public.project_answer_metrics m on m.project_answer_id = pa.id
left join public.people_personas pp
  on pp.person_id = pa.respondent_person_id
 and pp.project_id = rq.project_id
group by
  rq.project_id,
  rq.id,
  rq.decision_question_id,
  rq.text;

create or replace view public.decision_question_summary with (security_invoker = on) as
select
  dq.project_id,
  dq.id as decision_question_id,
  dq.text as decision_question_text,
  coalesce(count(distinct rq.id), 0) as research_question_count,
  coalesce(count(distinct pa.id) filter (where pa.status in ('answered','ad_hoc')), 0) as answered_answer_count,
  coalesce(count(distinct pa.id) filter (where pa.status in ('planned','asked')), 0) as open_answer_count,
  coalesce(sum(m.evidence_count), 0) as evidence_count,
  coalesce(count(distinct pa.interview_id), 0) as interview_count,
  coalesce(count(distinct pp.persona_id), 0) as persona_count
from public.decision_questions dq
left join public.research_questions rq on rq.decision_question_id = dq.id
left join public.project_answers pa on pa.decision_question_id = dq.id
left join public.project_answer_metrics m on m.project_answer_id = pa.id
left join public.people_personas pp
  on pp.person_id = pa.respondent_person_id
 and pp.project_id = dq.project_id
group by
  dq.project_id,
  dq.id,
  dq.text;

grant select on public.project_answer_metrics to authenticated;
grant select on public.research_question_summary to authenticated;
grant select on public.decision_question_summary to authenticated;
