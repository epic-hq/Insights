-- Theme generation from evidence facet clusters
-- This schema handles smart theme creation with merge/update logic

-- Function to generate or update a theme from an evidence cluster
-- If similar theme exists (>0.85 similarity), UPDATE it
-- If no match, INSERT new theme
create or replace function public.generate_theme_from_cluster(
  project_id_param uuid,
  account_id_param uuid,
  cluster_facet_ids uuid[],  -- Array of evidence facet IDs in the cluster
  theme_name_param text,
  theme_pain_param text default null,
  theme_jtbd_param text default null,
  theme_category_param text default null,
  theme_statement_param text default null,
  similarity_threshold float default 0.85
)
returns table (
  theme_id uuid,
  action text,  -- 'created', 'updated', or 'merged'
  message text
) as $$
declare
  cluster_embedding vector(1536);
  existing_theme_id uuid;
  existing_theme_similarity float;
  new_theme_id uuid;
  affected_count int;
begin
  -- Calculate representative embedding for the cluster (average of all facet embeddings)
  select avg(embedding)::vector(1536) into cluster_embedding
  from evidence_facet
  where id = any(cluster_facet_ids)
    and embedding is not null;

  if cluster_embedding is null then
    return query select null::uuid, 'error'::text, 'No valid embeddings in cluster'::text;
    return;
  end if;

  -- Check if similar theme already exists
  select t.id, 1 - (t.embedding <=> cluster_embedding) as similarity
  into existing_theme_id, existing_theme_similarity
  from themes t
  where t.project_id = project_id_param
    and t.embedding is not null
    and 1 - (t.embedding <=> cluster_embedding) > similarity_threshold
  order by t.embedding <=> cluster_embedding
  limit 1;

  if existing_theme_id is not null then
    -- UPDATE existing theme with enriched data (only update NULL fields)
    update themes
    set
      name = coalesce(themes.name, theme_name_param),
      pain = coalesce(themes.pain, theme_pain_param),
      jtbd = coalesce(themes.jtbd, theme_jtbd_param),
      category = coalesce(themes.category, theme_category_param),
      statement = coalesce(themes.statement, theme_statement_param),
      embedding = coalesce(themes.embedding, cluster_embedding),
      embedding_model = coalesce(themes.embedding_model, 'text-embedding-3-small'),
      embedding_generated_at = coalesce(themes.embedding_generated_at, now()),
      updated_at = now()
    where id = existing_theme_id;

    return query select
      existing_theme_id,
      'updated'::text,
      format('Updated existing theme (%.0f%% similarity)', existing_theme_similarity * 100)::text;
  else
    -- INSERT new theme
    insert into themes (
      account_id,
      project_id,
      name,
      pain,
      jtbd,
      category,
      statement,
      embedding,
      embedding_model,
      embedding_generated_at,
      created_at,
      updated_at
    ) values (
      account_id_param,
      project_id_param,
      theme_name_param,
      theme_pain_param,
      theme_jtbd_param,
      theme_category_param,
      theme_statement_param,
      cluster_embedding,
      'text-embedding-3-small',
      now(),
      now(),
      now()
    )
    returning id into new_theme_id;

    return query select
      new_theme_id,
      'created'::text,
      'Created new theme from cluster'::text;
  end if;
end;
$$ language plpgsql;

-- Function to auto-generate themes from top evidence clusters
-- Processes the most prominent clusters and generates/updates themes
create or replace function public.auto_generate_themes_from_clusters(
  project_id_param uuid,
  account_id_param uuid,
  max_clusters int default 50,
  similarity_threshold float default 0.75,
  merge_threshold float default 0.85
)
returns table (
  cluster_rank int,
  theme_id uuid,
  theme_name text,
  action text,
  message text,
  facet_count int
) as $$
declare
  cluster_rec record;
  cluster_facets uuid[];
  generated_name text;
  generated_pain text;
  generated_jtbd text;
  generated_category text;
  generated_statement text;
  result_rec record;
  rank_counter int := 0;
begin
  -- Get top clusters using connected components (graph-based clustering)
  -- We'll use a simplified approach: pick seed facets and expand
  for cluster_rec in
    with cluster_seeds as (
      -- Get most connected facets as cluster seeds
      select
        ef1.id as seed_id,
        ef1.label as seed_label,
        ef1.kind_slug,
        count(distinct ef2.id) as connection_count
      from evidence_facet ef1
      cross join evidence_facet ef2
      where ef1.project_id = project_id_param
        and ef2.project_id = project_id_param
        and ef1.id != ef2.id
        and ef1.embedding is not null
        and ef2.embedding is not null
        and 1 - (ef1.embedding <=> ef2.embedding) > similarity_threshold
      group by ef1.id, ef1.label, ef1.kind_slug
      order by connection_count desc
      limit max_clusters
    )
    select
      seed_id,
      seed_label,
      kind_slug,
      connection_count
    from cluster_seeds
  loop
    rank_counter := rank_counter + 1;

    -- Get all facets in this cluster
    select array_agg(facet_id) into cluster_facets
    from get_evidence_cluster(
      cluster_rec.seed_id,
      project_id_param,
      similarity_threshold,
      50
    );

    -- Add seed itself
    cluster_facets := array_append(cluster_facets, cluster_rec.seed_id);

    -- Generate theme metadata from cluster
    -- For now, use simple aggregation (later: use LLM for better naming)
    select
      -- Name: Use seed label as base, could enhance with LLM
      cluster_rec.seed_label as name,
      -- Pain: Aggregate pain facets
      string_agg(distinct ef.label, ' | ') filter (where ef.kind_slug = 'pain') as pain,
      -- JTBD: Aggregate goal facets
      string_agg(distinct ef.label, ' | ') filter (where ef.kind_slug = 'goal') as jtbd,
      -- Category: Infer from dominant kind
      mode() within group (order by ef.kind_slug) as category,
      -- Statement: Combine all labels
      string_agg(distinct ef.kind_slug || ': ' || ef.label, '; ') as statement
    into generated_name, generated_pain, generated_jtbd, generated_category, generated_statement
    from evidence_facet ef
    where ef.id = any(cluster_facets);

    -- Generate or update theme
    select * into result_rec
    from generate_theme_from_cluster(
      project_id_param,
      account_id_param,
      cluster_facets,
      generated_name,
      generated_pain,
      generated_jtbd,
      generated_category,
      generated_statement,
      merge_threshold
    );

    return query select
      rank_counter,
      result_rec.theme_id,
      generated_name,
      result_rec.action,
      result_rec.message,
      array_length(cluster_facets, 1);
  end loop;
end;
$$ language plpgsql;

comment on function public.generate_theme_from_cluster is 'Generate or update a theme from an evidence cluster. Updates existing similar themes or creates new ones.';
comment on function public.auto_generate_themes_from_clusters is 'Auto-generate themes from top evidence clusters. Smart merge/update logic enriches existing themes.';

-- Evidence clustering functions (from 34_embeddings.sql)

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

comment on function public.find_evidence_facet_clusters is 'Find clusters of similar evidence facets across all kinds for theme generation and duplicate detection';
comment on function public.get_evidence_cluster is 'Get all evidence facets similar to a seed facet, forming a thematic cluster across different evidence kinds';
