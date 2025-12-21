-- Update enqueue_facet_embedding to include quote for richer embeddings
-- This enables semantic search on survey responses (question + answer)
create or replace function public.enqueue_facet_embedding()
returns trigger language plpgsql as $$
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

comment on function public.enqueue_facet_embedding() is 'Queue evidence facet for embedding generation. For survey_response facets, embeds both question (label) and answer (quote) together for semantic search.';
