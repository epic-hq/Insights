-- Drop legacy FK so deleting interviews is not blocked by read-only insights table
alter table public.insights
  drop constraint if exists insights_interview_id_fkey;
