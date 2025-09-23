set search_path = public;

alter table if exists public.interview_prompts
  add column if not exists category text,
  add column if not exists estimated_time_minutes int,
  add column if not exists is_must_have boolean default false,
  add column if not exists status text check (status in ('proposed','asked','answered','skipped','rejected')) default 'proposed',
  add column if not exists order_index int,
  add column if not exists scores jsonb,
  add column if not exists source text default 'ai',
  add column if not exists rationale text,
  add column if not exists is_selected boolean default false,
  add column if not exists selected_order int;

create index if not exists idx_prompts_project_order on public.interview_prompts(project_id, order_index);
