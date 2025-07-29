set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_insight_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;


