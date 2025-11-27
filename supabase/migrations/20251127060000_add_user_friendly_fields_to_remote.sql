-- Add user-friendly fields to themes table (remote database)

-- Add columns if they don't exist
ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS jtbd text,
  ADD COLUMN IF NOT EXISTS pain text,
  ADD COLUMN IF NOT EXISTS desired_outcome text,
  ADD COLUMN IF NOT EXISTS journey_stage text,
  ADD COLUMN IF NOT EXISTS emotional_response text,
  ADD COLUMN IF NOT EXISTS motivation text,
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS impact text,
  ADD COLUMN IF NOT EXISTS contradictions text,
  ADD COLUMN IF NOT EXISTS novelty text,
  ADD COLUMN IF NOT EXISTS opportunity_ideas text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confidence smallint,
  ADD COLUMN IF NOT EXISTS interview_id uuid;

-- Add foreign key constraint for interview_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'themes_interview_id_fkey'
    AND conrelid = 'public.themes'::regclass
  ) THEN
    ALTER TABLE public.themes
      ADD CONSTRAINT themes_interview_id_fkey
      FOREIGN KEY (interview_id)
      REFERENCES public.interviews(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Update junction table foreign keys to point to themes instead of insights
DO $$
BEGIN
  -- actions table
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actions_insight_id_fkey') THEN
    ALTER TABLE public.actions DROP CONSTRAINT actions_insight_id_fkey;
    ALTER TABLE public.actions ADD CONSTRAINT actions_insight_id_fkey
      FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE SET NULL;
  END IF;

  -- insight_tags table
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insight_tags_insight_id_fkey') THEN
    ALTER TABLE public.insight_tags DROP CONSTRAINT insight_tags_insight_id_fkey;
    ALTER TABLE public.insight_tags ADD CONSTRAINT insight_tags_insight_id_fkey
      FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE;
  END IF;

  -- opportunity_insights table
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_insights_insight_id_fkey') THEN
    ALTER TABLE public.opportunity_insights DROP CONSTRAINT opportunity_insights_insight_id_fkey;
    ALTER TABLE public.opportunity_insights ADD CONSTRAINT opportunity_insights_insight_id_fkey
      FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE;
  END IF;

  -- persona_insights table
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_insights_insight_id_fkey') THEN
    ALTER TABLE public.persona_insights DROP CONSTRAINT persona_insights_insight_id_fkey;
    ALTER TABLE public.persona_insights ADD CONSTRAINT persona_insights_insight_id_fkey
      FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add trigger for theme embedding queue
CREATE OR REPLACE TRIGGER trg_enqueue_theme
  AFTER INSERT OR UPDATE ON public.themes
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_insight_embedding();

-- Update semantic search functions to include new fields
CREATE OR REPLACE FUNCTION public.find_themes_by_person_facet(
  facet_label_query text,
  project_id_param uuid,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  theme_id uuid,
  theme_name text,
  theme_pain text,
  similarity float,
  person_count bigint
) AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- Get embedding for the facet label query
  SELECT embedding INTO query_embedding
  FROM person_facet pf
  JOIN facet_account fa ON fa.id = pf.facet_account_id
  WHERE fa.label ILIKE facet_label_query
  AND pf.project_id = project_id_param
  AND pf.embedding IS NOT NULL
  LIMIT 1;

  IF query_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Find themes linked to evidence from people with similar facets
  RETURN QUERY
    WITH similar_people AS (
      SELECT DISTINCT pf.person_id,
             1 - (pf.embedding <=> query_embedding) AS facet_similarity
      FROM person_facet pf
      WHERE pf.project_id = project_id_param
        AND pf.embedding IS NOT NULL
        AND 1 - (pf.embedding <=> query_embedding) > match_threshold
    )
    SELECT
      t.id AS theme_id,
      t.name AS theme_name,
      t.pain AS theme_pain,
      AVG(1 - (t.embedding <=> query_embedding)) AS similarity,
      COUNT(DISTINCT ep.person_id) AS person_count
    FROM themes t
    JOIN theme_evidence te ON te.theme_id = t.id
    JOIN evidence e ON e.id = te.evidence_id
    JOIN evidence_people ep ON ep.evidence_id = e.id
    JOIN similar_people sp ON sp.person_id = ep.person_id
    WHERE t.project_id = project_id_param
      AND t.embedding IS NOT NULL
    GROUP BY t.id, t.name, t.pain
    HAVING AVG(1 - (t.embedding <=> query_embedding)) > match_threshold
    ORDER BY similarity DESC, person_count DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.search_themes_semantic(
  query_text text,
  project_id_param uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
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
  -- For now, use ILIKE as fallback until we implement text-to-embedding API
  RETURN QUERY
    SELECT
      themes.id,
      themes.name,
      themes.pain,
      themes.statement,
      themes.category,
      themes.journey_stage,
      0.9 AS similarity -- Placeholder
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

-- Update auto_link_persona_insights to work with themes
CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(p_insight_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in interviews that have evidence linked to this theme
    -- Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
    FOR persona_record IN
        SELECT DISTINCT pp.persona_id, p.name AS persona
        FROM themes t
        -- Link through theme_evidence junction to get to interviews
        JOIN theme_evidence te ON t.id = te.theme_id
        JOIN evidence e ON te.evidence_id = e.id
        JOIN interviews iv ON e.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN people_personas pp ON pe.id = pp.person_id
        JOIN personas p ON pp.persona_id = p.id AND pe.account_id = p.account_id
        WHERE t.id = p_insight_id
        AND pp.persona_id IS NOT NULL
    LOOP
        -- Calculate relevance score (simplified - could be more sophisticated)
        relevance_score_var := 1.0;

        -- Insert persona-insight link
        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW())
        ON CONFLICT (persona_id, insight_id) DO NOTHING;
    END LOOP;
END;
$$;

COMMENT ON COLUMN public.themes.category IS 'User-friendly category for filtering themes';
COMMENT ON COLUMN public.themes.jtbd IS 'Jobs To Be Done - what the user is trying to accomplish';
COMMENT ON COLUMN public.themes.pain IS 'Pain point description - user-friendly field from legacy insights';
COMMENT ON COLUMN public.themes.desired_outcome IS 'What the user wants to achieve';
COMMENT ON COLUMN public.themes.journey_stage IS 'Stage in the user journey';
COMMENT ON TRIGGER trg_enqueue_theme ON public.themes IS 'Enqueue theme for embedding generation when created or pain field updated';
