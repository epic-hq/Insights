-- Create a function to enqueue evidence items missing embeddings
-- Uses the insights_embedding_queue since the embed Edge Function handles multiple types

create or replace function public.enqueue_missing_evidence_embeddings(
  project_id_param uuid default null
)
returns integer
language plpgsql
as $$
declare
  enqueued_count integer := 0;
  evidence_row record;
begin
  for evidence_row in
    select e.id, e.verbatim, e.gist
    from public.evidence e
    where e.embedding is null
      and (project_id_param is null or e.project_id = project_id_param)
      and (e.verbatim is not null or e.gist is not null)
    limit 500  -- Process in batches
  loop
    -- Use the insights_embedding_queue with evidence type
    perform pgmq.send(
      'insights_embedding_queue',
      jsonb_build_object(
        'table', 'evidence',
        'id', evidence_row.id,
        'text', coalesce(evidence_row.gist, evidence_row.verbatim)
      )
    );
    enqueued_count := enqueued_count + 1;
  end loop;

  raise notice 'Enqueued % evidence items for embedding generation', enqueued_count;
  return enqueued_count;
end;
$$;

comment on function public.enqueue_missing_evidence_embeddings is
  'Enqueue evidence items missing embeddings for batch processing. Pass project_id to limit to one project.';

-- Grant execute to authenticated users
grant execute on function public.enqueue_missing_evidence_embeddings to authenticated;
