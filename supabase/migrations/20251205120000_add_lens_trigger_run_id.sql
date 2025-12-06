-- Add trigger_run_id column to track Trigger.dev run for realtime progress
alter table public.conversation_lens_analyses
  add column if not exists trigger_run_id text;

-- Index for looking up analysis by run ID
create index if not exists conversation_lens_analyses_trigger_run_idx
  on public.conversation_lens_analyses(trigger_run_id)
  where trigger_run_id is not null;

comment on column public.conversation_lens_analyses.trigger_run_id is
  'Trigger.dev run ID for tracking analysis progress in realtime';
