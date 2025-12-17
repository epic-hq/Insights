-- Evidence embedding trigger
-- Automatically enqueues evidence rows for embedding generation via pgmq

-- Create the enqueue function for evidence
create or replace function public.enqueue_evidence_embedding()
returns trigger language plpgsql as $$
begin
  -- Enqueue if embedding is NULL:
  -- - On INSERT: always enqueue if no embedding
  -- - On UPDATE: enqueue if embedding still null (for backfill) or content changed
  if new.embedding is null then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', 'evidence',
        'id', new.id::text,
        'name', coalesce(new.gist, substring(new.verbatim from 1 for 100)),
        'pain', new.verbatim
      )::jsonb
    );
  end if;
  return new;
end;
$$;

-- Create the trigger on evidence table
create or replace trigger trg_enqueue_evidence
  after insert or update on public.evidence
  for each row execute function public.enqueue_evidence_embedding();

comment on trigger trg_enqueue_evidence on public.evidence is 'Enqueue evidence for embedding generation when created or gist/verbatim updated';
