-- Add embedding columns for semantic search and clustering
-- Using pgvector extension with OpenAI text-embedding-3-small (1536 dimensions)

-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to evidence
alter table public.evidence
add column if not exists embedding vector(1536);

-- Add embedding column to themes
alter table public.themes
add column if not exists embedding vector(1536);

-- Add embedding column to insights
alter table public.insights
add column if not exists embedding vector(1536);

-- Add indexes for vector similarity search (using HNSW for best performance)
-- Note: These indexes are created only if they don't exist yet
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where tablename = 'evidence' and indexname = 'evidence_embedding_idx'
  ) then
    create index evidence_embedding_idx on public.evidence
    using hnsw (embedding vector_cosine_ops);
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'themes' and indexname = 'themes_embedding_idx'
  ) then
    create index themes_embedding_idx on public.themes
    using hnsw (embedding vector_cosine_ops);
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'insights' and indexname = 'insights_embedding_idx'
  ) then
    create index insights_embedding_idx on public.insights
    using hnsw (embedding vector_cosine_ops);
  end if;
end $$;

-- Add embedding metadata columns for tracking
alter table public.evidence
add column if not exists embedding_model text,
add column if not exists embedding_generated_at timestamptz;

alter table public.themes
add column if not exists embedding_model text,
add column if not exists embedding_generated_at timestamptz;

alter table public.insights
add column if not exists embedding_model text,
add column if not exists embedding_generated_at timestamptz;

-- Helper function to find similar evidence by embedding
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
      and 1 - (evidence.embedding <=> query_embedding) > match_threshold
    order by evidence.embedding <=> query_embedding
    limit match_count;
end;
$$ language plpgsql;

-- Helper function to find similar themes by embedding
create or replace function public.find_similar_themes(
  query_embedding vector(1536),
  project_id_param uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  name text,
  statement text,
  similarity float
) as $$
begin
  return query
    select
      themes.id,
      themes.name,
      themes.statement,
      1 - (themes.embedding <=> query_embedding) as similarity
    from public.themes
    where themes.project_id = project_id_param
      and themes.embedding is not null
      and 1 - (themes.embedding <=> query_embedding) > match_threshold
    order by themes.embedding <=> query_embedding
    limit match_count;
end;
$$ language plpgsql;

-- Helper function to cluster themes by similarity (for consolidation)
create or replace function public.find_duplicate_themes(
  project_id_param uuid,
  similarity_threshold float default 0.85
)
returns table (
  theme_id_1 uuid,
  theme_id_2 uuid,
  theme_name_1 text,
  theme_name_2 text,
  similarity float
) as $$
begin
  return query
    select
      t1.id as theme_id_1,
      t2.id as theme_id_2,
      t1.name as theme_name_1,
      t2.name as theme_name_2,
      1 - (t1.embedding <=> t2.embedding) as similarity
    from public.themes t1
    cross join public.themes t2
    where t1.project_id = project_id_param
      and t2.project_id = project_id_param
      and t1.id < t2.id  -- Avoid duplicates and self-matches
      and t1.embedding is not null
      and t2.embedding is not null
      and 1 - (t1.embedding <=> t2.embedding) > similarity_threshold
    order by similarity desc;
end;
$$ language plpgsql;

-- Comments
comment on column public.evidence.embedding is 'OpenAI text-embedding-3-small (1536 dims) for semantic search and clustering';
comment on column public.themes.embedding is 'OpenAI text-embedding-3-small (1536 dims) for theme consolidation and similarity';
comment on column public.insights.embedding is 'OpenAI text-embedding-3-small (1536 dims) for insight discovery and recommendations';

comment on function public.find_similar_evidence is 'Find evidence similar to a query embedding using cosine similarity';
comment on function public.find_similar_themes is 'Find themes similar to a query embedding using cosine similarity';
comment on function public.find_duplicate_themes is 'Find duplicate/similar themes within a project for consolidation';
