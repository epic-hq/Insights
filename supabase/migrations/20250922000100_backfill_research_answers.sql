-- Backfill research answer metadata and evidence links
set search_path = public;

-- 1) Normalize legacy status values and origins
alter table public.project_answers
	add column if not exists origin text;

update public.project_answers
set status = 'ad_hoc'
where status not in ('planned','asked','answered','skipped','ad_hoc');

update public.project_answers
set origin = case
  when origin is null and question_id is null then 'ad_hoc'
  when origin is null then 'scripted'
  else origin
end,
    status = case when status = 'ad_hoc' and question_id is not null then 'answered' else status end;

-- 2) Hydrate metadata from latest saved question sets in project_sections
alter table public.project_answers
	add column if not exists question_category text,
	add column if not exists estimated_time_minutes int,
	add column if not exists order_index int;

with latest_sections as (
  select distinct on (project_id)
    project_id,
    meta
  from public.project_sections
  where kind = 'questions'
    and meta is not null
  order by project_id, created_at desc
),
question_meta as (
  select
    ls.project_id,
    (q.elem->>'id') as question_id,
    coalesce(q.elem->>'categoryId', q.elem->>'category', 'context') as category_id,
    nullif((q.elem->>'estimatedMinutes')::int, 0) as estimated_minutes,
    coalesce((q.elem->>'selectedOrder')::int,
             (q.elem->>'order_index')::int,
             q.ord::int) as order_index,
    coalesce(q.elem->>'text', q.elem->>'question') as question_text
  from latest_sections ls
  cross join lateral jsonb_array_elements(ls.meta->'questions') with ordinality as q(elem, ord)
)
update public.project_answers pa
set
  question_category = coalesce(pa.question_category, qm.category_id),
  estimated_time_minutes = coalesce(pa.estimated_time_minutes, qm.estimated_minutes),
  order_index = coalesce(pa.order_index, qm.order_index),
  question_text = coalesce(pa.question_text, qm.question_text)
from question_meta qm
where pa.project_id = qm.project_id
  and pa.question_id is not null
  and qm.question_id = pa.question_id;

-- 3) Default remaining planned answer ordering by interview time where missing
update public.project_answers pa
set order_index = sub.rn
from (
  select id,
         row_number() over (
           partition by project_id, interview_id
           order by coalesce(order_index, 1000), created_at
         ) as rn
  from public.project_answers
) sub
where pa.id = sub.id
  and pa.order_index is null;

-- 4) Ensure question_category has a fallback
update public.project_answers
set question_category = coalesce(question_category, 'context')
where question_category is null;

alter table public.evidence
	add column if not exists project_answer_id uuid;

do $$
begin
  if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'project_answer_evidence'
    ) then
    update public.evidence e
    set project_answer_id = pae.answer_id
    from public.project_answer_evidence pae
    where pae.payload ->> 'evidence_id' = e.id::text
      and (e.project_answer_id is distinct from pae.answer_id);
  end if;
end $$;
