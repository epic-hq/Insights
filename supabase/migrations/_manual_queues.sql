-- queues.sql
-- setup queue for embeddings and transcriptions separately

set search_path to public;
create extension if not exists vector;
create extension if not exists pg_net;
create extension if not exists pg_cron;
DROP EXTENSION IF EXISTS pgmq CASCADE;
CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

-- a) create the queue if you can
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_queue' AND pronamespace = 'pgmq'::regnamespace
  ) THEN
    PERFORM pgmq.create_queue('insights_embedding_queue');
    -- ... other queue setup
		grant insert, select, update, delete on table q_insights_embedding_queue to authenticated, service_role;
		grant usage, select on sequence q_insights_embedding_queue_id_seq to authenticated, service_role;
		alter table q_insights_embedding_queue disable row level security;
  END IF;
END $$;

-- select * from pgmq.create_queue('insights_embedding_queue');


-- b) trigger fn to enqueue changed rows
-- Update functions to use extensions schema for pgmq and cron
create or replace function public.enqueue_insight_embedding()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.jtbd is distinct from new.jtbd)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'category',  new.category,
        'jtbd',  new.jtbd
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_enqueue_insight
  after insert or update on public.insights
  for each row execute function public.enqueue_insight_embedding();

-- c) helper to invoke your Edge Function
create or replace function public.invoke_edge_function(
  func_name text,
  payload jsonb
) returns void language plpgsql as $$
declare
  _ jsonb;
begin
  _ := (
    select data from net.http_post(
      format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
      payload::text,
      json_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || current_setting('edge_function_key')
      )
    )
  );
end;
$$;

-- d) processor that drains the queue
create or replace function public.process_embedding_queue() returns void language plpgsql as $$
declare
  job record;
begin
  for job in select * from pgmq.peek_queue('insights_embedding_queue', 25) loop
    perform public.invoke_edge_function('embed', job.payload::jsonb);
    perform pgmq.dequeue('insights_embedding_queue', job.id);
  end loop;
end;
$$;

-- e) cron-job to run every minute
select cron.schedule(
  '*/1 * * * *',
  'select public.process_embedding_queue()'
);
