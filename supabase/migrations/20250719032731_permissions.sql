set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_insight_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.invoke_edge_function(func_name text, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_embedding_queue()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  job record;
begin
  for job in select * from pgmq.peek_queue('insights_embedding_queue', 25) loop
    perform public.invoke_edge_function('embed', job.payload::jsonb);
    perform pgmq.dequeue('insights_embedding_queue', job.id);
  end loop;
end;
$function$
;

CREATE TRIGGER trg_enqueue_insight AFTER INSERT OR UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION enqueue_insight_embedding();


