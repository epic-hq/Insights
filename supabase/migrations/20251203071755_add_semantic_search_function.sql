-- Helper function to find similar evidence by interview (for sales lens extraction)
create or replace function public.find_similar_evidence_by_interview(
  query_embedding vector(1536),
  interview_id_param uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  verbatim text,
  chunk text,
  gist text,
  anchors jsonb,
  pains text[],
  gains text[],
  thinks text[],
  feels text[],
  similarity float
) as $$
begin
  return query
    select
      evidence.id,
      evidence.verbatim,
      evidence.chunk,
      evidence.gist,
      evidence.anchors,
      evidence.pains,
      evidence.gains,
      evidence.thinks,
      evidence.feels,
      1 - (evidence.embedding <=> query_embedding) as similarity
    from public.evidence
    where evidence.interview_id = interview_id_param
      and evidence.embedding is not null
      and 1 - (evidence.embedding <=> query_embedding) > match_threshold
    order by evidence.embedding <=> query_embedding
    limit match_count;
end;
$$ language plpgsql;
