-- Create view for persona distribution with dual calculation methods
-- Method 1: By Participant Assignment (interviews.participant_pseudonym matches persona name)
-- Method 2: By Segment Assignment (interviews.segment matches persona name)

CREATE OR REPLACE VIEW persona_distribution AS
WITH participant_counts AS (
  -- Count interviews by participant assignment (interviews.participant_pseudonym field)
  SELECT
    p.id as persona_id,
    p.account_id,
    p.name as persona_name,
    p.color_hex,
    p.description,
    p.created_at,
    p.updated_at,
    COUNT(i1.id) as participant_interview_count,
    -- Total interviews with participant assignments for this account
    (
      SELECT COUNT(*)
      FROM interviews i_total
      WHERE i_total.account_id = p.account_id
      AND i_total.participant_pseudonym IS NOT NULL
    ) as total_participant_interviews
  FROM personas p
  LEFT JOIN interviews i1 ON (
    i1.account_id = p.account_id
    AND i1.participant_pseudonym = p.name
  )
  GROUP BY p.id, p.account_id, p.name, p.color_hex, p.description, p.created_at, p.updated_at
),
segment_counts AS (
  -- Count interviews by segment assignment (interviews.segment field)
  SELECT
    p.id as persona_id,
    COUNT(i2.id) as segment_interview_count,
    -- Total interviews with segment assignments for this account
    (
      SELECT COUNT(*)
      FROM interviews i_total
      WHERE i_total.account_id = p.account_id
      AND i_total.segment IS NOT NULL
    ) as total_segment_interviews
  FROM personas p
  LEFT JOIN interviews i2 ON (
    i2.account_id = p.account_id
    AND i2.segment = p.name
  )
  GROUP BY p.id, p.account_id
)
SELECT
  pc.persona_id,
  pc.account_id,
  pc.persona_name,
  pc.color_hex,
  pc.description,
  pc.created_at,
  pc.updated_at,

  -- Participant-based calculations (by participant_pseudonym)
  pc.participant_interview_count,
  pc.total_participant_interviews,
  CASE
    WHEN pc.total_participant_interviews > 0 THEN
      ROUND((pc.participant_interview_count::numeric / pc.total_participant_interviews::numeric) * 100, 1)
    ELSE 0
  END as participant_percentage,

  -- Segment-based calculations (by segment)
  sc.segment_interview_count,
  sc.total_segment_interviews,
  CASE
    WHEN sc.total_segment_interviews > 0 THEN
      ROUND((sc.segment_interview_count::numeric / sc.total_segment_interviews::numeric) * 100, 1)
    ELSE 0
  END as segment_percentage

FROM participant_counts pc
JOIN segment_counts sc ON pc.persona_id = sc.persona_id
ORDER BY pc.account_id, pc.participant_interview_count DESC;

-- Grant access to the view
GRANT SELECT ON persona_distribution TO authenticated;
