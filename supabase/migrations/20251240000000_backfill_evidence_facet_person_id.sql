-- Backfill evidence_facet.person_id from evidence_people junction table
-- This unifies the attribution model: facets directly link to their owner

-- Backfill person_id from evidence_people (where 1:1 relationship exists)
UPDATE evidence_facet ef
SET person_id = ep.person_id
FROM evidence_people ep
WHERE ef.evidence_id = ep.evidence_id
  AND ef.person_id IS NULL;

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
  remaining_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM evidence_facet WHERE person_id IS NOT NULL;
  SELECT COUNT(*) INTO remaining_null FROM evidence_facet WHERE person_id IS NULL;

  RAISE NOTICE 'Backfill complete: % facets now have person_id, % remain NULL (no evidence_people link)',
    updated_count, remaining_null;
END $$;

COMMENT ON COLUMN evidence_facet.person_id IS
'Direct link to the person this facet belongs to. For conversations, this is the speaker who expressed the pain/gain/need. For surveys, this is the respondent who answered. NULL if attribution is unknown or genuinely shared.';
