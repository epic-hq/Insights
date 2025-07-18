-- 64_embedding_pipeline.sql

-- a) create the queue
select *
from pgmq.create_queue('insights_embedding_queue');

-- b) trigger fn to enqueue changed rows
create or replace function public.enqueue_insight_embedding()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.jtbd is distinct from new.jtbd)) then
    perform pgmq.enqueue(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'text',  new.jtbd
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_enqueue_insight
  after insert or update on public.insights
  for each row execute function public.enqueue_insight_embedding();

-- c) helper to invoke your Edge Function
create or replace function public.invoke_edge_function(
  func_name text,
  payload   jsonb
) returns void language plpgsql as $$
declare
  _ resp jsonb;
begin
  _ := (
    select data from net.http_post(
      format('https://<project>.functions.supabase.co/%s', func_name),
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
