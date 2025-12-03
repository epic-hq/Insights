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

-- Helper function to find clusters of similar person facets (for semantic segment grouping)
-- This enables clustering like "Product Manager" + "PM" + "Product Lead" into one segment
create or replace function public.find_person_facet_clusters(
  project_id_param uuid,
  kind_slug_param text,
  similarity_threshold float default 0.75
)
returns table (
  person_facet_id_1 text,  -- composite: person_id|facet_account_id
  person_facet_id_2 text,  -- composite: person_id|facet_account_id
  facet_account_id_1 int,
  facet_account_id_2 int,
  label_1 text,
  label_2 text,
  similarity float,
  combined_person_count bigint
) as $$
begin
  return query
    select
      pf1.person_id::text || '|' || pf1.facet_account_id::text as person_facet_id_1,
      pf2.person_id::text || '|' || pf2.facet_account_id::text as person_facet_id_2,
      pf1.facet_account_id as facet_account_id_1,
      pf2.facet_account_id as facet_account_id_2,
      fa1.label as label_1,
      fa2.label as label_2,
      1 - (pf1.embedding <=> pf2.embedding) as similarity,
      (
        select count(distinct person_id)
        from public.person_facet pf_temp
        where pf_temp.facet_account_id in (pf1.facet_account_id, pf2.facet_account_id)
          and pf_temp.project_id = project_id_param
      ) as combined_person_count
    from public.person_facet pf1
    join public.facet_account fa1 on fa1.id = pf1.facet_account_id
    join public.facet_kind_global fkg1 on fkg1.id = fa1.kind_id
    cross join public.person_facet pf2
    join public.facet_account fa2 on fa2.id = pf2.facet_account_id
    join public.facet_kind_global fkg2 on fkg2.id = fa2.kind_id
    where pf1.project_id = project_id_param
      and pf2.project_id = project_id_param
      and fkg1.slug = kind_slug_param
      and fkg2.slug = kind_slug_param
      and pf1.facet_account_id < pf2.facet_account_id  -- Avoid duplicates and self-matches
      and pf1.embedding is not null
      and pf2.embedding is not null
      and 1 - (pf1.embedding <=> pf2.embedding) > similarity_threshold
    order by similarity desc;
end;
$$ language plpgsql;

-- Helper function to find themes relevant to a person facet (semantic user segmentation)
create or replace function public.find_themes_by_person_facet(
  facet_label_query text,
  project_id_param uuid,
  match_threshold float default 0.6,
  match_count int default 20
)
returns table (
  theme_id uuid,
  theme_name text,
  theme_pain text,
  similarity float,
  person_count bigint
) as $$
declare
  query_embedding vector(1536);
begin
  -- Get embedding for the facet label query
  select embedding into query_embedding
  from person_facet pf
  join facet_account fa on fa.id = pf.facet_account_id
  where fa.label ilike facet_label_query
  and pf.project_id = project_id_param
  and pf.embedding is not null
  limit 1;

  -- If no exact match, use semantic search on all person facets
  if query_embedding is null then
    -- TODO: Create embedding from query text via OpenAI
    -- For now, return empty result
    return;
  end if;

  -- Find themes linked to evidence from people with similar facets
  return query
    with similar_people as (
      select distinct pf.person_id,
             1 - (pf.embedding <=> query_embedding) as facet_similarity
      from person_facet pf
      where pf.project_id = project_id_param
        and pf.embedding is not null
        and 1 - (pf.embedding <=> query_embedding) > match_threshold
    )
    select
      t.id as theme_id,
      t.name as theme_name,
      t.pain as theme_pain,
      avg(1 - (t.embedding <=> query_embedding)) as similarity,
      count(distinct ep.person_id) as person_count
    from themes t
    join theme_evidence te on te.theme_id = t.id
    join evidence e on e.id = te.evidence_id
    join evidence_people ep on ep.evidence_id = e.id
    join similar_people sp on sp.person_id = ep.person_id
    where t.project_id = project_id_param
      and t.embedding is not null
    group by t.id, t.name, t.pain
    having avg(1 - (t.embedding <=> query_embedding)) > match_threshold
    order by similarity desc, person_count desc
    limit match_count;
end;
$$ language plpgsql;

-- Helper function to find themes by text query (combines theme + person facet semantic search)
create or replace function public.search_themes_semantic(
  query_text text,
  project_id_param uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  name text,
  pain text,
  statement text,
  category text,
  journey_stage text,
  similarity float
) as $$
begin
  -- TODO: Get embedding for query_text from OpenAI
  -- For now, use ILIKE as fallback until we implement text-to-embedding API
  return query
    select
      themes.id,
      themes.name,
      themes.pain,
      themes.statement,
      themes.category,
      themes.journey_stage,
      0.9::float as similarity -- Placeholder
    from public.themes
    where themes.project_id = project_id_param
      and (
        themes.name ilike '%' || query_text || '%'
        or themes.pain ilike '%' || query_text || '%'
        or themes.statement ilike '%' || query_text || '%'
      )
    limit match_count;
end;
$$ language plpgsql;

-- Helper function to find evidence facet clusters (semantic evidence grouping across all kinds)
-- This enables clustering similar evidence across different kinds (pain + gain + goal + behavior, etc.)
-- for theme generation and duplicate detection
create or replace function public.find_evidence_facet_clusters(
  project_id_param uuid,
  kind_slug_filter text default null, -- Optional: filter by specific kind(s), null = all kinds
  similarity_threshold float default 0.75,
  limit_results int default 100
)
returns table (
  evidence_facet_id_1 uuid,
  evidence_facet_id_2 uuid,
  label_1 text,
  label_2 text,
  kind_slug_1 text,
  kind_slug_2 text,
  similarity float,
  combined_evidence_count bigint
) as $$
begin
  return query
    select
      ef1.id as evidence_facet_id_1,
      ef2.id as evidence_facet_id_2,
      ef1.label as label_1,
      ef2.label as label_2,
      ef1.kind_slug as kind_slug_1,
      ef2.kind_slug as kind_slug_2,
      1 - (ef1.embedding <=> ef2.embedding) as similarity,
      (
        -- Count distinct evidence linked to either facet
        select count(distinct evidence_id)
        from public.evidence_facets
        where facet_id in (ef1.id, ef2.id)
          and project_id = project_id_param
      ) as combined_evidence_count
    from public.evidence_facet ef1
    cross join public.evidence_facet ef2
    where ef1.project_id = project_id_param
      and ef2.project_id = project_id_param
      and ef1.id < ef2.id  -- Avoid duplicates and self-matches
      and ef1.embedding is not null
      and ef2.embedding is not null
      and 1 - (ef1.embedding <=> ef2.embedding) > similarity_threshold
      -- Optional kind filter
      and (kind_slug_filter is null
           or ef1.kind_slug = kind_slug_filter
           or ef2.kind_slug = kind_slug_filter)
    order by similarity desc
    limit limit_results;
end;
$$ language plpgsql;

-- Helper function to get representative evidence facets for a cluster (seed-based clustering)
-- Given a seed facet, find all similar facets across all kinds to form a thematic cluster
create or replace function public.get_evidence_cluster(
  seed_facet_id uuid,
  project_id_param uuid,
  similarity_threshold float default 0.7,
  limit_results int default 50
)
returns table (
  facet_id uuid,
  label text,
  kind_slug text,
  similarity float,
  evidence_count bigint
) as $$
declare
  seed_embedding vector(1536);
begin
  -- Get seed embedding
  select embedding into seed_embedding
  from evidence_facet
  where id = seed_facet_id
    and project_id = project_id_param
    and embedding is not null;

  if seed_embedding is null then
    return;
  end if;

  return query
    select
      ef.id as facet_id,
      ef.label,
      ef.kind_slug,
      1 - (ef.embedding <=> seed_embedding) as similarity,
      (
        select count(*)
        from public.evidence_facets evf
        where evf.facet_id = ef.id
          and evf.project_id = project_id_param
      ) as evidence_count
    from public.evidence_facet ef
    where ef.project_id = project_id_param
      and ef.id != seed_facet_id
      and ef.embedding is not null
      and 1 - (ef.embedding <=> seed_embedding) > similarity_threshold
    order by similarity desc
    limit limit_results;
end;
$$ language plpgsql;

-- Comments
comment on column public.evidence.embedding is 'OpenAI text-embedding-3-small (1536 dims) for semantic search and clustering';
comment on column public.themes.embedding is 'OpenAI text-embedding-3-small (1536 dims) for theme consolidation and similarity';
comment on column public.insights.embedding is 'OpenAI text-embedding-3-small (1536 dims) for insight discovery and recommendations';

comment on function public.find_similar_evidence is 'Find evidence similar to a query embedding using cosine similarity';
comment on function public.find_similar_themes is 'Find themes similar to a query embedding using cosine similarity';
comment on function public.find_duplicate_themes is 'Find duplicate/similar themes within a project for consolidation';
comment on function public.find_person_facet_clusters is 'Find clusters of similar person facets for semantic segment grouping (e.g., "Product Manager" + "PM" + "Product Lead")';
comment on function public.find_themes_by_person_facet is 'Find themes relevant to people with a specific facet using semantic matching on person_facet embeddings';
comment on function public.search_themes_semantic is 'Search themes by text query using semantic similarity (placeholder until text-to-embedding API is implemented)';
comment on function public.find_evidence_facet_clusters is 'Find clusters of similar evidence facets across all kinds for theme generation and duplicate detection';
comment on function public.get_evidence_cluster is 'Get all evidence facets similar to a seed facet, forming a thematic cluster across different evidence kinds';
