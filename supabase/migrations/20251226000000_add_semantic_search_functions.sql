-- Add semantic search functions for evidence facets and person facets
-- Part of hybrid semantic search implementation

set check_function_bodies = off;

-- Search evidence facets (pains, gains, thinks, feels) by semantic similarity
CREATE OR REPLACE FUNCTION public.find_similar_evidence_facets(query_embedding public.vector, project_id_param uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10, kind_slug_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, evidence_id uuid, kind_slug text, label text, quote text, confidence numeric, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      ef.id,
      ef.evidence_id,
      ef.kind_slug,
      ef.label,
      ef.quote,
      ef.confidence,
      1 - (ef.embedding <=> query_embedding) as similarity
    from public.evidence_facet ef
    where ef.project_id = project_id_param
      and ef.embedding is not null
      and 1 - (ef.embedding <=> query_embedding) > match_threshold
      and (kind_slug_filter is null or ef.kind_slug = kind_slug_filter)
    order by ef.embedding <=> query_embedding
    limit match_count;
end;
$function$;

-- Search person facets (roles, titles, demographics, behaviors) by semantic similarity
CREATE OR REPLACE FUNCTION public.find_similar_person_facets(query_embedding public.vector, project_id_param uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10, kind_slug_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, person_id uuid, kind_slug text, label text, value text, confidence numeric, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      pf.id,
      pf.person_id,
      pf.kind_slug,
      pf.label,
      pf.value,
      pf.confidence,
      1 - (pf.embedding <=> query_embedding) as similarity
    from public.person_facet pf
    where pf.project_id = project_id_param
      and pf.embedding is not null
      and 1 - (pf.embedding <=> query_embedding) > match_threshold
      and (kind_slug_filter is null or pf.kind_slug = kind_slug_filter)
    order by pf.embedding <=> query_embedding
    limit match_count;
end;
$function$;
