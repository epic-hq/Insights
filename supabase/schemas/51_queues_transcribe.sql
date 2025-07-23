-- Transcribe Queue
-- docs: https://supabase.com/blog/supabase-queues

set search_path to public;
create extension if not exists vector;
create extension if not exists pg_net;
create extension if not exists pg_cron;
DROP EXTENSION IF EXISTS pgmq CASCADE;
CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

-- a) create the queue for embeddings
select pgmq.create('transcribe_interview_queue');
-- grant access to the queue table
grant insert, select, delete on table pgmq.q_transcribe_interview_queue to authenticated;

-- (optional) enable RLS and define policies
-- Enable RLS
alter table pgmq.q_transcribe_interview_queue enable row level security;

-- Allow insert
create policy "authenticated can enqueue"
on pgmq.q_transcribe_interview_queue
for insert
to authenticated
with check (true);

-- Allow select
create policy "authenticated can read"
on pgmq.q_transcribe_interview_queue
for select
to authenticated
USING (true);

-- Allow delete
create policy "authenticated can delete"
on pgmq.q_transcribe_interview_queue
for delete
to authenticated
USING (true);


-- b) trigger fn to enqueue transcription job
-- Update functions to use extensions schema for pgmq and cron
create or replace function public.enqueue_transcribe_interview()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.media_url is distinct from new.media_url)) then
    perform pgmq.send(
      'transcribe_interview_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'media_url',  new.media_url
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_enqueue_transcribe_interview
  after insert or update on public.interviews
  for each row execute function public.enqueue_transcribe_interview();

-- c) helper to invoke your Edge Function:: Generic. dont' need to replicate. already setup in 50_queues
-- create or replace function public.invoke_edge_function(func_name text, payload jsonb)
-- returns void


-- d) processor that drains the queue and processes the job

create or replace function public.process_transcribe_queue()
returns text
language plpgsql
as $$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'transcribe_interview_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('transcribe', job.message::jsonb);
    perform pgmq.delete(
      'transcribe_interview_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from transcribe queue.', count);
end;
$$;




-- e) cron-job to run every minute
-- select cron.schedule(
--   '*/1 * * * *',
--   'select public.process_transcribe_queue()'
-- );


-- TODO: create edge function 'transcribe' to call AssemblyAI