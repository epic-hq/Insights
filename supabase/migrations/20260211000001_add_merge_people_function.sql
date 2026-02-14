-- Merge People Transaction Function
-- Atomically transfers all related records from source to target person

CREATE OR REPLACE FUNCTION merge_people_transaction(
  p_source_person_id uuid,
  p_target_person_id uuid,
  p_account_id uuid,
  p_project_id uuid,
  p_merged_by uuid,
  p_reason text,
  p_source_person_data jsonb,
  p_source_person_name text,
  p_target_person_name text,
  p_evidence_count integer,
  p_interview_count integer,
  p_facet_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merge_history_id uuid;
BEGIN
  -- 1. Update evidence records
  UPDATE evidence
  SET person_id = p_target_person_id,
      updated_at = now()
  WHERE person_id = p_source_person_id;

  -- 2. Update interview participants
  UPDATE interview_participants
  SET person_id = p_target_person_id,
      updated_at = now()
  WHERE person_id = p_source_person_id;

  -- 3. Update person facets
  UPDATE person_facets
  SET person_id = p_target_person_id,
      updated_at = now()
  WHERE person_id = p_source_person_id;

  -- 4. Update person personas
  UPDATE person_personas
  SET person_id = p_target_person_id,
      updated_at = now()
  WHERE person_id = p_source_person_id;

  -- 5. Transfer person scales (ICP scores) - keep highest score
  INSERT INTO person_scales (
    account_id,
    project_id,
    person_id,
    scale_id,
    band,
    confidence,
    reasoning,
    created_at,
    updated_at
  )
  SELECT
    account_id,
    project_id,
    p_target_person_id,
    scale_id,
    band,
    confidence,
    reasoning,
    created_at,
    now()
  FROM person_scales
  WHERE person_id = p_source_person_id
  ON CONFLICT (person_id, scale_id)
  DO UPDATE SET
    band = CASE
      WHEN EXCLUDED.confidence > person_scales.confidence THEN EXCLUDED.band
      ELSE person_scales.band
    END,
    confidence = GREATEST(EXCLUDED.confidence, person_scales.confidence),
    reasoning = CASE
      WHEN EXCLUDED.confidence > person_scales.confidence THEN EXCLUDED.reasoning
      ELSE person_scales.reasoning
    END,
    updated_at = now();

  -- Delete source person scales (already merged)
  DELETE FROM person_scales WHERE person_id = p_source_person_id;

  -- 6. Create merge history record
  INSERT INTO person_merge_history (
    account_id,
    project_id,
    source_person_id,
    source_person_name,
    source_person_data,
    target_person_id,
    target_person_name,
    merged_by,
    merged_at,
    reason,
    evidence_count,
    interview_count,
    facet_count
  ) VALUES (
    p_account_id,
    p_project_id,
    p_source_person_id,
    p_source_person_name,
    p_source_person_data,
    p_target_person_id,
    p_target_person_name,
    p_merged_by,
    now(),
    p_reason,
    p_evidence_count,
    p_interview_count,
    p_facet_count
  )
  RETURNING id INTO v_merge_history_id;

  -- 7. Soft delete source person (set deleted_at)
  UPDATE people
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_source_person_id;

  -- Return success with merge history ID
  RETURN jsonb_build_object(
    'success', true,
    'merge_history_id', v_merge_history_id,
    'source_person_id', p_source_person_id,
    'target_person_id', p_target_person_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback will happen automatically
    RAISE EXCEPTION 'Merge transaction failed: %', SQLERRM;
END;
$$;

-- Grant execute to authenticated users (RLS on person_merge_history will control access)
GRANT EXECUTE ON FUNCTION merge_people_transaction TO authenticated;

-- Comment
COMMENT ON FUNCTION merge_people_transaction IS 'Atomically merges source person into target person, transferring all related records and creating audit trail';
