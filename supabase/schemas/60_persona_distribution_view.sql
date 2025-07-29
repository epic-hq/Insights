-- Persona distribution view calculates interview counts and percentages
-- using the interview_people junction table for accurate participant-persona relationships.
-- This view is account-scoped and read-only.

CREATE OR REPLACE VIEW persona_distribution AS
WITH persona_interview_counts AS (
  -- Count interviews by persona assignment via junction table
  SELECT
    p.id          AS persona_id,
    p.account_id,
    p.name        AS persona_name,
    p.color_hex,
    p.description,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT i.id) AS interview_count,
    -- Total interviews for this account that have participants
    (
      SELECT COUNT(DISTINCT i_total.id)
      FROM interviews i_total
      JOIN interview_people ip_total ON ip_total.interview_id = i_total.id
      WHERE i_total.account_id = p.account_id
    ) AS total_interviews_with_participants
  FROM personas p
  -- Use new people_personas junction table instead of deprecated people.persona_id
  LEFT JOIN people_personas pp ON pp.persona_id = p.id
  LEFT JOIN interview_people ip ON ip.person_id = pp.person_id
  LEFT JOIN interviews i ON (i.id = ip.interview_id AND i.account_id = p.account_id)
  GROUP BY p.id, p.account_id, p.name, p.color_hex, p.description, p.created_at, p.updated_at
),
legacy_fallback_counts AS (
  -- Fallback to legacy fields for interviews without junction table data
  SELECT
    p.id          AS persona_id,
    COUNT(DISTINCT i_legacy.id) AS legacy_interview_count,
    -- Total legacy interviews for this account
    (
      SELECT COUNT(DISTINCT i_total.id)
      FROM interviews i_total
      WHERE i_total.account_id = p.account_id
        AND (i_total.participant_pseudonym IS NOT NULL OR i_total.segment IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM interview_people ip_check WHERE ip_check.interview_id = i_total.id
        )
    ) AS total_legacy_interviews
  FROM personas p
  LEFT JOIN interviews i_legacy ON (
    i_legacy.account_id = p.account_id
    AND (i_legacy.participant_pseudonym = p.name OR i_legacy.segment = p.name)
    AND NOT EXISTS (
      SELECT 1 FROM interview_people ip_check WHERE ip_check.interview_id = i_legacy.id
    )
  )
  GROUP BY p.id, p.account_id
)
SELECT
  pic.persona_id,
  pic.account_id,
  pic.persona_name,
  pic.color_hex,
  pic.description,
  pic.created_at,
  pic.updated_at,

  -- Junction table based counts (primary)
  pic.interview_count,
  pic.total_interviews_with_participants,
  CASE
    WHEN pic.total_interviews_with_participants > 0 THEN
      ROUND((pic.interview_count::numeric / pic.total_interviews_with_participants::numeric) * 100, 1)
    ELSE 0
  END AS interview_percentage,

  -- Legacy fallback counts (for backwards compatibility)
  lfc.legacy_interview_count,
  lfc.total_legacy_interviews,
  CASE
    WHEN lfc.total_legacy_interviews > 0 THEN
      ROUND((lfc.legacy_interview_count::numeric / lfc.total_legacy_interviews::numeric) * 100, 1)
    ELSE 0
  END AS legacy_percentage,

  -- Combined totals
  (pic.interview_count + lfc.legacy_interview_count) AS total_interview_count,
  (pic.total_interviews_with_participants + lfc.total_legacy_interviews) AS total_interviews,
  CASE
    WHEN (pic.total_interviews_with_participants + lfc.total_legacy_interviews) > 0 THEN
      ROUND(((pic.interview_count + lfc.legacy_interview_count)::numeric / (pic.total_interviews_with_participants + lfc.total_legacy_interviews)::numeric) * 100, 1)
    ELSE 0
  END AS combined_percentage

FROM persona_interview_counts pic
JOIN legacy_fallback_counts lfc ON pic.persona_id = lfc.persona_id
ORDER BY pic.account_id, (pic.interview_count + lfc.legacy_interview_count) DESC;

-- Grant access to the view
GRANT SELECT ON persona_distribution TO authenticated;


-- NOTE: Primary persona functionality removed as people table doesn't have primary_persona_id column
-- The people_personas junction table handles the many-to-many relationship directly
-- If primary persona functionality is needed, add primary_persona_id column to people table first
