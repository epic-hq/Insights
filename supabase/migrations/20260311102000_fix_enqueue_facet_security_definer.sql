-- Fix: enqueue_facet_embedding must run as SECURITY DEFINER so it executes
-- as the function owner (postgres) rather than the calling role (service_role).
-- Without this, service_role gets "permission denied for table q_facet_embedding_queue"
-- when the trigger fires on evidence_facet insert.
create or replace function public.enqueue_facet_embedding()
returns trigger language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and (old.label is distinct from new.label or old.quote is distinct from new.quote))) then
    perform pgmq.send(
      'facet_embedding_queue',
      json_build_object(
        'facet_id', new.id::text,
        'label', new.label,
        'quote', new.quote,
        'kind_slug', new.kind_slug
      )::jsonb
    );
  end if;
  return new;
end;
$$;
