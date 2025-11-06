-- Add embedding support to evidence_facet for semantic clustering
-- Phase 3: Semantic Clustering with Embeddings

-- Ensure pgvector extension is enabled
create extension if not exists vector;

-- Add embedding columns to evidence_facet
alter table public.evidence_facet
  add column if not exists embedding vector(1536),
  add column if not exists embedding_model text default 'text-embedding-3-small',
  add column if not exists embedding_generated_at timestamptz;

-- Create HNSW index for fast similarity search on facet embeddings
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where tablename = 'evidence_facet' and indexname = 'evidence_facet_embedding_idx'
  ) then
    create index evidence_facet_embedding_idx on public.evidence_facet
    using hnsw (embedding vector_cosine_ops);
  end if;
end $$;

-- Trigger function to generate embeddings for facet labels
-- Calls edge function asynchronously when label is inserted/updated
-- Uses Supabase Vault for secure key storage (following pattern from 50_queues.sql)
create or replace function public.trigger_generate_facet_embedding()
returns trigger as $$
declare
  req_id bigint;
  supabase_anon_key text;
begin
  -- Only generate embedding if label has changed or is new
  if TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and NEW.label is distinct from OLD.label) then
    -- Get anon key from Supabase Vault (secure storage)
    select decrypted_secret
    into supabase_anon_key
    from vault.decrypted_secrets
    where name = 'SUPABASE_ANON_KEY'
    order by created_at desc
    limit 1;

    -- Call edge function asynchronously using pg_net
    req_id := net.http_post(
      'https://rbginqvgkonnoktrttqv.functions.supabase.co/embed-facet',
      jsonb_build_object(
        'facet_id', NEW.id::text,
        'label', NEW.label,
        'kind_slug', NEW.kind_slug
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Authorization', 'Bearer ' || supabase_anon_key,
        'Content-Type', 'application/json'
      ),
      2000  -- timeout in milliseconds
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger (only if not exists)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_evidence_facet_embedding'
  ) then
    create trigger trigger_evidence_facet_embedding
      after insert or update of label on public.evidence_facet
      for each row
      execute function public.trigger_generate_facet_embedding();
  end if;
end $$;

-- Helper function to find similar facets by embedding
create or replace function public.find_similar_facets(
  query_embedding vector(1536),
  kind_slug_param text,
  project_id_param uuid,
  match_threshold float default 0.75,
  match_count int default 20
)
returns table (
  id uuid,
  label text,
  kind_slug text,
  similarity float,
  evidence_count bigint
) as $$
begin
  return query
    select
      ef.id,
      ef.label,
      ef.kind_slug,
      1 - (ef.embedding <=> query_embedding) as similarity,
      count(distinct ef.evidence_id) as evidence_count
    from public.evidence_facet ef
    where ef.project_id = project_id_param
      and ef.kind_slug = kind_slug_param
      and ef.embedding is not null
      and 1 - (ef.embedding <=> query_embedding) > match_threshold
    group by ef.id, ef.label, ef.kind_slug, ef.embedding
    order by ef.embedding <=> query_embedding
    limit match_count;
end;
$$ language plpgsql;

-- Helper function to find clusters of similar facets (for consolidation)
create or replace function public.find_facet_clusters(
  project_id_param uuid,
  kind_slug_param text,
  similarity_threshold float default 0.85
)
returns table (
  facet_id_1 uuid,
  facet_id_2 uuid,
  label_1 text,
  label_2 text,
  similarity float,
  combined_evidence_count bigint
) as $$
begin
  return query
    select
      ef1.id as facet_id_1,
      ef2.id as facet_id_2,
      ef1.label as label_1,
      ef2.label as label_2,
      1 - (ef1.embedding <=> ef2.embedding) as similarity,
      (
        select count(distinct evidence_id)
        from public.evidence_facet ef_temp
        where ef_temp.id in (ef1.id, ef2.id)
      ) as combined_evidence_count
    from public.evidence_facet ef1
    cross join public.evidence_facet ef2
    where ef1.project_id = project_id_param
      and ef2.project_id = project_id_param
      and ef1.kind_slug = kind_slug_param
      and ef2.kind_slug = kind_slug_param
      and ef1.id < ef2.id  -- Avoid duplicates and self-matches
      and ef1.embedding is not null
      and ef2.embedding is not null
      and 1 - (ef1.embedding <=> ef2.embedding) > similarity_threshold
    order by similarity desc;
end;
$$ language plpgsql;

-- Comments
comment on column public.evidence_facet.embedding is 'OpenAI text-embedding-3-small (1536 dims) for semantic clustering of similar facets';
comment on column public.evidence_facet.embedding_model is 'Model used to generate the embedding';
comment on column public.evidence_facet.embedding_generated_at is 'Timestamp when embedding was generated';

comment on function public.find_similar_facets is 'Find facets similar to a query embedding using cosine similarity';
comment on function public.find_facet_clusters is 'Find clusters of similar facets within a project for semantic consolidation';
comment on function public.trigger_generate_facet_embedding is 'Trigger to automatically generate embeddings when facet labels are created/updated';
