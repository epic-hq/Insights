-- Migration: people.segment → persona facets
-- Run this AFTER deploying schema 13_people_segmentation.sql
-- See docs/architecture/segments-and-targeting.md for rationale

-- Step 1: Ensure persona facet kind exists on remote
INSERT INTO facet_kind_global (id, slug, label, description, created_at, updated_at)
VALUES (1, 'persona', 'Persona', 'User archetypes and customer personas', now(), now())
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Step 2: Create persona facets from existing people.segment values
-- This creates account-level facets for each unique segment value
INSERT INTO facet_account (
  account_id,
  kind_id,
  slug,
  label,
  description,
  created_at,
  updated_at
)
SELECT DISTINCT
  p.account_id,
  1 as kind_id, -- persona kind_id
  LOWER(REPLACE(TRIM(p.segment), ' ', '-')) as slug,
  TRIM(p.segment) as label,
  'Migrated from people.segment - add a definition' as description,
  now() as created_at,
  now() as updated_at
FROM people p
WHERE p.segment IS NOT NULL
  AND TRIM(p.segment) != ''
  AND TRIM(p.segment) != 'null' -- Sometimes string 'null' gets stored
  -- Only create if facet doesn't already exist
  AND NOT EXISTS (
    SELECT 1 FROM facet_account fa
    WHERE fa.account_id = p.account_id
      AND fa.kind_id = 1
      AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.segment), ' ', '-'))
  );

-- Step 3: Link people to their persona facets via person_facet
-- Create entries for each project the person has evidence in
INSERT INTO person_facet (
  person_id,
  facet_account_id,
  account_id,
  project_id,
  source
)
SELECT DISTINCT
  p.id as person_id,
  fa.id as facet_account_id,
  p.account_id as account_id,
  e.project_id as project_id,
  'manual' as source
FROM people p
JOIN facet_account fa
  ON fa.account_id = p.account_id
  AND fa.kind_id = 1  -- persona
  AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.segment), ' ', '-'))
JOIN evidence_people ep ON ep.person_id = p.id
JOIN evidence e ON e.id = ep.evidence_id
WHERE p.segment IS NOT NULL
  AND TRIM(p.segment) != ''
  AND TRIM(p.segment) != 'null'
ON CONFLICT (person_id, facet_account_id) DO NOTHING;

-- Step 4: Verify migration
DO $$
DECLARE
  migrated_count INTEGER;
  unique_segments INTEGER;
  created_facets INTEGER;
BEGIN
  SELECT
    COUNT(DISTINCT p.id),
    COUNT(DISTINCT p.segment),
    COUNT(DISTINCT fa.id)
  INTO migrated_count, unique_segments, created_facets
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = 1
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.segment), ' ', '-'))
  WHERE p.segment IS NOT NULL
    AND TRIM(p.segment) != ''
    AND TRIM(p.segment) != 'null';

  RAISE NOTICE 'Segment migration summary:';
  RAISE NOTICE '  People migrated: %', migrated_count;
  RAISE NOTICE '  Unique segments: %', unique_segments;
  RAISE NOTICE '  Facet_account entries created: %', created_facets;
  RAISE NOTICE '';
  RAISE NOTICE 'Note: evidence_facet entries will be created automatically when evidence is tagged with personas';
END $$;

-- Step 5 (MANUAL - DO NOT RUN YET):
-- After verifying the migration worked, you can clean up deprecated columns:
--
-- ALTER TABLE people DROP COLUMN IF EXISTS segment;
-- ALTER TABLE people DROP COLUMN IF EXISTS role;  -- Interview role is in interview_people
-- ALTER TABLE people DROP COLUMN IF EXISTS occupation;  -- Use job_function instead
--
-- NOTE: Do NOT run this automatically. Verify data first!
