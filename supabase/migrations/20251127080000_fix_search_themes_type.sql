-- Fix type mismatch in search_themes_semantic function
CREATE OR REPLACE FUNCTION public.search_themes_semantic(
  query_text text,
  project_id_param uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
RETURNS TABLE (
  id uuid,
  name text,
  pain text,
  statement text,
  category text,
  journey_stage text,
  similarity float
) AS $$
BEGIN
  -- TODO: Get embedding for query_text from OpenAI
  -- For now, use ILIKE as fallback
  RETURN QUERY
    SELECT
      themes.id,
      themes.name,
      themes.pain,
      themes.statement,
      themes.category,
      themes.journey_stage,
      0.9::float AS similarity -- Fixed: cast to float
    FROM public.themes
    WHERE themes.project_id = project_id_param
      AND (
        themes.name ILIKE '%' || query_text || '%'
        OR themes.pain ILIKE '%' || query_text || '%'
        OR themes.statement ILIKE '%' || query_text || '%'
      )
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.search_themes_semantic IS 'Search themes by text query using semantic similarity (placeholder until text-to-embedding API is implemented)';
