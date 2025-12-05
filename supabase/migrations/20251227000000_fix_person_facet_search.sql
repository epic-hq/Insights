-- Fix find_similar_person_facets to use composite key and join with facet tables
-- person_facet uses (person_id, facet_account_id) as primary key, not id

set check_function_bodies = off;

-- Drop the function first since we're changing the return type
DROP FUNCTION IF EXISTS public.find_similar_person_facets(vector, uuid, double precision, integer, text);

CREATE OR REPLACE FUNCTION public.find_similar_person_facets(query_embedding public.vector, project_id_param uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10, kind_slug_filter text DEFAULT NULL::text)
 RETURNS TABLE(person_id uuid, facet_account_id integer, kind_slug text, label text, confidence numeric, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      pf.person_id,
      pf.facet_account_id,
      fkg.slug as kind_slug,
      fa.label,
      pf.confidence,
      1 - (pf.embedding <=> query_embedding) as similarity
    from public.person_facet pf
    join public.facet_account fa on pf.facet_account_id = fa.id
    join public.facet_kind_global fkg on fa.kind_id = fkg.id
    where pf.project_id = project_id_param
      and pf.embedding is not null
      and 1 - (pf.embedding <=> query_embedding) > match_threshold
      and (kind_slug_filter is null or fkg.slug = kind_slug_filter)
    order by pf.embedding <=> query_embedding
    limit match_count;
end;
$function$;
