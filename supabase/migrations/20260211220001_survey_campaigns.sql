-- Survey Campaigns - Smart campaign management with AI-recommended recipients
-- Extends research_links + creates personalized_surveys table

-- 1. Add campaign-level fields to research_links
ALTER TABLE public.research_links
  ADD COLUMN IF NOT EXISTS campaign_strategy TEXT CHECK (campaign_strategy IN ('pricing_validation', 'sparse_data_discovery', 'theme_validation', 'general_research')),
  ADD COLUMN IF NOT EXISTS campaign_goal TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommendation_metadata JSONB,
  ADD COLUMN IF NOT EXISTS campaign_status TEXT NOT NULL DEFAULT 'draft' CHECK (campaign_status IN ('draft', 'active', 'paused', 'completed'));

COMMENT ON COLUMN public.research_links.campaign_strategy IS 'AI strategy for selecting recipients: pricing_validation, sparse_data_discovery, theme_validation, general_research';
COMMENT ON COLUMN public.research_links.campaign_goal IS 'Human-readable goal for this campaign';
COMMENT ON COLUMN public.research_links.ai_recommendation_metadata IS 'Stores AI reasoning for recommended recipients';
COMMENT ON COLUMN public.research_links.campaign_status IS 'Campaign lifecycle: draft, active, paused, completed';

-- 2. Create personalized_surveys table
CREATE TABLE IF NOT EXISTS public.personalized_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts (id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
  research_link_id UUID NOT NULL REFERENCES public.research_links (id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,

  -- Personalization context
  survey_goal TEXT NOT NULL CHECK (survey_goal IN ('validate', 'discover', 'deep_dive', 'pricing')),
  generation_metadata JSONB NOT NULL,

  -- Questions (personalized per person)
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'opened', 'completed')),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Evidence extraction tracking
  evidence_extracted BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_count INT NOT NULL DEFAULT 0,
  extraction_metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One personalized survey per person per campaign
  UNIQUE(research_link_id, person_id)
);

COMMENT ON TABLE public.personalized_surveys IS 'Personalized survey instances generated for specific people within a campaign';
COMMENT ON COLUMN public.personalized_surveys.generation_metadata IS 'BAML generation context including PersonContext, question rationale, uses_attributes';
COMMENT ON COLUMN public.personalized_surveys.extraction_metadata IS 'Evidence extraction tracking: { extracted_at, confidence_avg, retry_count, errors }';

CREATE INDEX IF NOT EXISTS personalized_surveys_person_id_idx ON public.personalized_surveys (person_id);
CREATE INDEX IF NOT EXISTS personalized_surveys_research_link_id_idx ON public.personalized_surveys (research_link_id);
CREATE INDEX IF NOT EXISTS personalized_surveys_status_idx ON public.personalized_surveys (status);
CREATE INDEX IF NOT EXISTS personalized_surveys_campaign_completion_idx ON public.personalized_surveys (research_link_id, status) WHERE status IN ('sent', 'opened', 'completed');

-- 3. Link personalized surveys to responses
ALTER TABLE public.research_link_responses
  ADD COLUMN IF NOT EXISTS personalized_survey_id UUID REFERENCES public.personalized_surveys (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.research_link_responses.personalized_survey_id IS 'Links response to the personalized survey that generated it';

CREATE INDEX IF NOT EXISTS research_link_responses_personalized_survey_idx ON public.research_link_responses (personalized_survey_id);

-- 4. Campaign stats RPC
CREATE OR REPLACE FUNCTION get_campaign_stats(
  p_research_link_id UUID
)
RETURNS TABLE (
  total_sent BIGINT,
  total_opened BIGINT,
  total_completed BIGINT,
  completion_rate NUMERIC,
  avg_evidence_per_response NUMERIC,
  total_evidence_extracted BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE ps.status IN ('sent', 'opened', 'completed'))::BIGINT AS total_sent,
    count(*) FILTER (WHERE ps.status IN ('opened', 'completed'))::BIGINT AS total_opened,
    count(*) FILTER (WHERE ps.status = 'completed')::BIGINT AS total_completed,
    CASE
      WHEN count(*) FILTER (WHERE ps.status IN ('sent', 'opened', 'completed')) > 0
      THEN round(
        (count(*) FILTER (WHERE ps.status = 'completed')::NUMERIC /
         count(*) FILTER (WHERE ps.status IN ('sent', 'opened', 'completed'))::NUMERIC) * 100,
        1
      )
      ELSE 0
    END AS completion_rate,
    coalesce(avg(ps.evidence_count) FILTER (WHERE ps.evidence_extracted = TRUE), 0) AS avg_evidence_per_response,
    coalesce(sum(ps.evidence_count) FILTER (WHERE ps.evidence_extracted = TRUE), 0)::BIGINT AS total_evidence_extracted
  FROM public.personalized_surveys ps
  WHERE ps.research_link_id = p_research_link_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_campaign_stats IS 'Returns campaign-level statistics: sent/opened/completed counts, completion rate, evidence metrics';

GRANT EXECUTE ON FUNCTION get_campaign_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_stats(UUID) TO service_role;

-- 5. AI recommendation RPC
CREATE OR REPLACE FUNCTION get_campaign_recommendations(
  p_account_id UUID,
  p_project_id UUID,
  p_strategy TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  person_id UUID,
  person_name TEXT,
  person_email TEXT,
  person_title TEXT,
  icp_score NUMERIC,
  evidence_count BIGINT,
  recommendation_score NUMERIC,
  recommendation_reason TEXT
) AS $$
BEGIN
  IF p_strategy = 'sparse_data_discovery' THEN
    RETURN QUERY
    SELECT
      p.id AS person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') AS person_name,
      p.primary_email AS person_email,
      p.title AS person_title,
      coalesce(ps.score, 0) AS icp_score,
      count(ep.evidence_id)::BIGINT AS evidence_count,
      (coalesce(ps.score, 0) * 100 - count(ep.evidence_id)::NUMERIC) AS recommendation_score,
      CASE
        WHEN count(ep.evidence_id) = 0 THEN 'No evidence yet - great for discovery'
        WHEN count(ep.evidence_id) < 3 THEN 'Minimal evidence (' || count(ep.evidence_id) || ' pieces) - good for follow-up'
        ELSE 'Some evidence but gaps remain'
      END AS recommendation_reason
    FROM public.people p
    LEFT JOIN public.person_scale ps ON ps.person_id = p.id AND ps.kind_slug = 'icp_match'
    LEFT JOIN public.evidence_people ep ON ep.person_id = p.id
    WHERE
      p.account_id = p_account_id
      AND (p.project_id = p_project_id OR p_project_id IS NULL)
      AND p.primary_email IS NOT NULL
    GROUP BY p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    ORDER BY recommendation_score DESC
    LIMIT p_limit;

  ELSIF p_strategy = 'pricing_validation' THEN
    RETURN QUERY
    SELECT
      p.id AS person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') AS person_name,
      p.primary_email AS person_email,
      p.title AS person_title,
      coalesce(ps.score, 0) AS icp_score,
      count(ep.evidence_id)::BIGINT AS evidence_count,
      (coalesce(ps.score, 0) * 100) AS recommendation_score,
      CASE
        WHEN coalesce(ps.score, 0) >= 0.7 THEN 'Strong ICP match - valuable for pricing validation'
        WHEN coalesce(ps.score, 0) >= 0.5 THEN 'Moderate ICP match - useful for pricing feedback'
        ELSE 'Weak ICP match - consider for broader perspective'
      END AS recommendation_reason
    FROM public.people p
    LEFT JOIN public.person_scale ps ON ps.person_id = p.id AND ps.kind_slug = 'icp_match'
    LEFT JOIN public.evidence_people ep ON ep.person_id = p.id
    WHERE
      p.account_id = p_account_id
      AND (p.project_id = p_project_id OR p_project_id IS NULL)
      AND p.primary_email IS NOT NULL
    GROUP BY p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    HAVING coalesce(ps.score, 0) >= 0.5
    ORDER BY recommendation_score DESC
    LIMIT p_limit;

  ELSE
    RETURN QUERY
    SELECT
      p.id AS person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') AS person_name,
      p.primary_email AS person_email,
      p.title AS person_title,
      coalesce(ps.score, 0) AS icp_score,
      count(ep.evidence_id)::BIGINT AS evidence_count,
      (coalesce(ps.score, 0) * 50 + (10 - least(count(ep.evidence_id)::NUMERIC, 10)) * 5) AS recommendation_score,
      'Balanced candidate for general research' AS recommendation_reason
    FROM public.people p
    LEFT JOIN public.person_scale ps ON ps.person_id = p.id AND ps.kind_slug = 'icp_match'
    LEFT JOIN public.evidence_people ep ON ep.person_id = p.id
    WHERE
      p.account_id = p_account_id
      AND (p.project_id = p_project_id OR p_project_id IS NULL)
      AND p.primary_email IS NOT NULL
    GROUP BY p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    ORDER BY recommendation_score DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_campaign_recommendations IS 'Returns AI-recommended people for a campaign based on strategy';

GRANT EXECUTE ON FUNCTION get_campaign_recommendations(UUID, UUID, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_recommendations(UUID, UUID, TEXT, INT) TO service_role;

-- 6. RLS policies
ALTER TABLE public.personalized_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read personalized surveys"
  ON public.personalized_surveys
  FOR SELECT
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Members can insert personalized surveys"
  ON public.personalized_surveys
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Members can update personalized surveys"
  ON public.personalized_surveys
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Members can delete personalized surveys"
  ON public.personalized_surveys
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- 7. Updated_at trigger
CREATE TRIGGER set_personalized_surveys_updated_at
  BEFORE UPDATE ON public.personalized_surveys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
