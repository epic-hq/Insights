-- Interview System Schema Update
-- Declarative schema for proper separation of concerns
set search_path = public;

-- ============================================================================
-- 1. INTERVIEW PROMPTS (Question Templates)
-- ============================================================================
-- Extend existing interview_prompts table with proper status values
alter table if exists public.interview_prompts
  add column if not exists category text,
  add column if not exists estimated_time_minutes int,
  add column if not exists is_must_have boolean default false,
  add column if not exists status text default 'proposed',
  add column if not exists order_index int,
  add column if not exists scores jsonb,
  add column if not exists source text default 'ai',
  add column if not exists rationale text,
  add column if not exists is_selected boolean default false,
  add column if not exists selected_order int;

-- Drop existing constraint if it exists and add new one with extended values
alter table public.interview_prompts 
  drop constraint if exists interview_prompts_status_check;

alter table public.interview_prompts 
  add constraint interview_prompts_status_check 
  check (status in ('proposed', 'rejected', 'selected', 'backup', 'deleted'));

-- Add source constraint
alter table public.interview_prompts 
  drop constraint if exists interview_prompts_source_check;

alter table public.interview_prompts 
  add constraint interview_prompts_source_check 
  check (source in ('ai', 'user'));

-- Indexes for performance
create index if not exists idx_prompts_project_status 
  on public.interview_prompts(project_id, status);
create index if not exists idx_prompts_project_order 
  on public.interview_prompts(project_id, order_index);
create index if not exists idx_prompts_must_have 
  on public.interview_prompts(project_id, is_must_have) where is_must_have = true;

-- ============================================================================
-- 2. PROJECT ANSWERS (Interview Responses) - Extend existing table
-- ============================================================================
-- The project_answers table already exists, just ensure proper constraints

-- Update status constraint to include 'derived' for AI-generated responses
alter table public.project_answers 
  drop constraint if exists project_answers_status_check;

alter table public.project_answers 
  add constraint project_answers_status_check 
  check (status in ('planned', 'asked', 'answered', 'skipped', 'derived', 'ad_hoc'));

-- Ensure prompt_id foreign key exists (links to interview_prompts)
alter table public.project_answers 
  drop constraint if exists project_answers_prompt_id_fkey;

alter table public.project_answers 
  add constraint project_answers_prompt_id_fkey 
  foreign key (prompt_id) references interview_prompts(id) on delete set null;

-- ============================================================================
-- 3. HELPER VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for active question templates (not deleted/rejected)
create or replace view interview_prompts_active as
select *
from interview_prompts
where status not in ('deleted', 'rejected')
order by project_id, order_index nulls last, created_at;

-- View for selected questions ready for interviews
create or replace view interview_prompts_selected as
select *
from interview_prompts
where status = 'selected' and is_selected = true
order by project_id, selected_order nulls last, order_index nulls last;

-- View for must-have questions
create or replace view interview_prompts_must_have as
select *
from interview_prompts
where is_must_have = true and status not in ('deleted', 'rejected')
order by project_id, order_index nulls last;

-- View linking prompts to their answers across interviews
create or replace view prompt_answer_summary as
select 
  p.id as prompt_id,
  p.project_id,
  p.text as prompt_text,
  p.category,
  p.is_must_have,
  p.status as prompt_status,
  count(pa.id) as total_answers,
  count(case when pa.status = 'answered' then 1 end) as answered_count,
  count(case when pa.status = 'skipped' then 1 end) as skipped_count,
  count(distinct pa.interview_id) as interview_count,
  max(pa.answered_at) as last_answered_at
from interview_prompts p
left join project_answers pa on pa.prompt_id = p.id
group by p.id, p.project_id, p.text, p.category, p.is_must_have, p.status;

-- ============================================================================
-- 4. RLS POLICIES (if not already exist)
-- ============================================================================

-- Ensure RLS is enabled
alter table interview_prompts enable row level security;
alter table project_answers enable row level security;

-- Note: Specific RLS policies should already exist from migrations
-- This is just to ensure the tables have RLS enabled

comment on table interview_prompts is 'Question templates for interviews. Status tracks lifecycle: proposed -> selected/backup/rejected/deleted';
comment on table project_answers is 'Actual responses to questions in specific interviews. Links to prompts via prompt_id';
comment on view interview_prompts_active is 'Active question templates (excludes deleted/rejected)';
comment on view interview_prompts_selected is 'Questions selected for interviews, ordered by selection';
comment on view prompt_answer_summary is 'Summary of how often each prompt has been used across interviews';
