-- queues.sql
-- setup queue for embeddings and transcriptions separately
-- docs: https://supabase.com/blog/supabase-queues

set search_path to public;
create extension if not exists vector;
create extension if not exists pg_net;
create extension if not exists pg_cron;
DROP EXTENSION IF EXISTS pgmq CASCADE;
CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

-- a) create the queue for embeddings
select pgmq.create('insights_embedding_queue');
-- grant access to the queue table
grant insert, select, delete on table pgmq.q_insights_embedding_queue to authenticated;

-- (optional) enable RLS and define policies
-- Enable RLS
alter table pgmq.q_insights_embedding_queue enable row level security;

-- Allow insert
create policy "authenticated can enqueue"
on pgmq.q_insights_embedding_queue
for insert
to authenticated
with check (true);

-- Allow select
create policy "authenticated can read"
on pgmq.q_insights_embedding_queue
for select
to authenticated
USING (true);

-- Allow delete
create policy "authenticated can delete"
on pgmq.q_insights_embedding_queue
for delete
to authenticated
USING (true);

-- Evidence facets embedding queue setup (for pains, gains, jobs, etc.)
select pgmq.create('facet_embedding_queue');
grant insert, select, delete on table pgmq.q_facet_embedding_queue to authenticated;

alter table pgmq.q_facet_embedding_queue enable row level security;

create policy "authenticated can enqueue facets"
on pgmq.q_facet_embedding_queue
for insert
to authenticated
with check (true);

create policy "authenticated can read facets"
on pgmq.q_facet_embedding_queue
for select
to authenticated
USING (true);

create policy "authenticated can delete facets"
on pgmq.q_facet_embedding_queue
for delete
to authenticated
USING (true);

-- b) trigger fn to enqueue changed rows
-- Update functions to use extensions schema for pgmq and cron
create or replace function public.enqueue_insight_embedding()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.pain is distinct from new.pain)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'name',  new.name,
        'pain',  new.pain
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_enqueue_insight
  after insert or update on public.insights
  for each row execute function public.enqueue_insight_embedding();

-- Evidence facet enqueue function
create or replace function public.enqueue_facet_embedding()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.label is distinct from new.label)) then
    perform pgmq.send(
      'facet_embedding_queue',
      json_build_object(
        'facet_id', new.id::text,
        'label', new.label,
        'kind_slug', new.kind_slug
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_enqueue_facet
  after insert or update on public.evidence_facet
  for each row execute function public.enqueue_facet_embedding();

-- c) helper to invoke your Edge Function
create or replace function public.invoke_edge_function(func_name text, payload jsonb)
returns void
language plpgsql
as $$
declare
  req_id bigint;
  supabase_anon_key text;
begin
  select decrypted_secret
  into supabase_anon_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_ANON_KEY'
  order by created_at desc
  limit 1;

  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    2000  -- timeout in milliseconds
  );
end;
$$;



-- d) processor that drains the queue

create or replace function public.process_embedding_queue()
returns text
language plpgsql
as $$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'insights_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed', job.message::jsonb);
    perform pgmq.delete(
      'insights_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from embedding queue.', count);
end;
$$;

-- Processor for facet embedding queue
create or replace function public.process_facet_embedding_queue()
returns text
language plpgsql
as $$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'facet_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed-facet', job.message::jsonb);
    perform pgmq.delete(
      'facet_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s facet message(s) from embedding queue.', count);
end;
$$;




-- e) cron-job to run every minute
select cron.schedule(
  '*/1 * * * *',
  'select public.process_embedding_queue()'
);

-- f) cron-job for facet embeddings (every minute)
select cron.schedule(
  'process-facet-embeddings',
  '*/1 * * * *',
  'select public.process_facet_embedding_queue()'
);


-- Transcribe Queue

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