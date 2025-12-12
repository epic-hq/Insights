-- Filter out interviewer questions from semantic search results
-- This prevents salesperson/interviewer comments from appearing in theme evidence

create or replace function public.find_similar_evidence(
  query_embedding vector(1536),
  project_id_param uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  verbatim text,
  similarity float
) as $$
begin
  return query
    select
      evidence.id,
      evidence.verbatim,
      1 - (evidence.embedding <=> query_embedding) as similarity
    from public.evidence
    where evidence.project_id = project_id_param
      and evidence.embedding is not null
      and (evidence.is_question is null or evidence.is_question = false)
      and 1 - (evidence.embedding <=> query_embedding) > match_threshold
    order by evidence.embedding <=> query_embedding
    limit match_count;
end;
$$ language plpgsql;
