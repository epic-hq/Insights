-- Add 'deleted' and 'backup' and 'selected' to interview_prompts status check constraint
-- This allows soft-deletion of questions while keeping them for negative training

set search_path = public;

-- Drop existing constraint
alter table public.interview_prompts
  drop constraint if exists interview_prompts_status_check;

-- Add new constraint with extended status values
alter table public.interview_prompts
  add constraint interview_prompts_status_check
  check (status in ('proposed', 'asked', 'answered', 'skipped', 'rejected', 'selected', 'backup', 'deleted'));

-- Add comment explaining the status values
comment on column public.interview_prompts.status is 
  'Question status: proposed (AI-generated), asked (in interview), answered (completed), skipped (not asked), rejected (user rejected), selected (user selected for interview), backup (reserve question), deleted (soft-deleted but kept for training)';
