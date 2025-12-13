-- RPC function for semantic search of project_assets
create or replace function find_similar_assets(
    query_embedding vector(1536),
    project_id_param uuid,
    match_threshold float default 0.5,
    match_count int default 10
)
returns table (
    id uuid,
    title text,
    description text,
    asset_type public.asset_type,
    row_count int,
    column_count int,
    table_data jsonb,
    content_md text,
    similarity float
)
language plpgsql
security definer
as $$
begin
    return query
    select
        pa.id,
        pa.title,
        pa.description,
        pa.asset_type,
        pa.row_count,
        pa.column_count,
        pa.table_data,
        pa.content_md,
        1 - (pa.embedding <=> query_embedding) as similarity
    from project_assets pa
    where pa.project_id = project_id_param
      and pa.embedding is not null
      and 1 - (pa.embedding <=> query_embedding) > match_threshold
    order by pa.embedding <=> query_embedding
    limit match_count;
end;
$$;

comment on function find_similar_assets is 'Semantic search for project_assets using vector similarity';
