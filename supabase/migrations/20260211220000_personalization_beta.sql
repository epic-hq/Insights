-- Personal Touch AI - Beta Database Schema
-- Add personalization fields for survey generation

-- 1. Add personalization fields to research_links
ALTER TABLE research_links
  ADD COLUMN IF NOT EXISTS personalized_for UUID REFERENCES people(id),
  ADD COLUMN IF NOT EXISTS survey_goal TEXT CHECK (survey_goal IN ('validate', 'discover', 'deep_dive', 'pricing')),
  ADD COLUMN IF NOT EXISTS generation_metadata JSONB;

COMMENT ON COLUMN research_links.personalized_for IS 'Person this survey was personalized for';
COMMENT ON COLUMN research_links.survey_goal IS 'Goal of the personalized survey: validate, discover, deep_dive, pricing';
COMMENT ON COLUMN research_links.generation_metadata IS 'Stores question rationale and uses_attributes from BAML generation';

-- 2. Add evidence extraction tracking to research_link_responses
ALTER TABLE research_link_responses
  ADD COLUMN IF NOT EXISTS evidence_extracted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS evidence_count INT DEFAULT 0;

COMMENT ON COLUMN research_link_responses.evidence_extracted IS 'Whether evidence has been extracted from this survey response';
COMMENT ON COLUMN research_link_responses.evidence_count IS 'Number of evidence pieces extracted from this survey';

-- 3. Create RPC function to get top themes for a person (optimized for personalization context)
CREATE OR REPLACE FUNCTION get_person_top_themes(
  p_person_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  theme_name TEXT,
  evidence_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.name::TEXT,
    COUNT(e.id)::BIGINT as evidence_count
  FROM themes t
  JOIN theme_evidence te ON te.theme_id = t.id
  JOIN evidence e ON e.id = te.evidence_id
  JOIN person_attribution pa ON pa.evidence_id = e.id
  WHERE pa.person_id = p_person_id
  GROUP BY t.id, t.name
  ORDER BY evidence_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_person_top_themes IS 'Returns top N themes for a person based on evidence count. Used for survey personalization context.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_person_top_themes(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_person_top_themes(UUID, INT) TO service_role;
