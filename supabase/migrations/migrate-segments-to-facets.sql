-- Migration: people.segment → persona facets
-- Run this AFTER deploying schema 13_people_segmentation.sql
-- See docs/architecture/segments-and-targeting.md for rationale

-- Step 1: Persona facet kind already exists (id=1)
-- No need to create it

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

-- Step 3: Create evidence_facet entries linking to facet_account
INSERT INTO evidence_facet (
  kind_slug,
  label,
  quote,
  facet_account_id
)
SELECT DISTINCT
  'persona' as kind_slug,
  fa.label,
  fa.description as quote,
  fa.id as facet_account_id
FROM facet_account fa
WHERE fa.kind_id = 1  -- persona
  -- Only if not already in evidence_facet
  AND NOT EXISTS (
    SELECT 1 FROM evidence_facet ef
    WHERE ef.facet_account_id = fa.id
  );

-- Step 4: Link people to their persona facets via person_facet
INSERT INTO person_facet (
  person_id,
  facet_account_id
)
SELECT DISTINCT
  p.id as person_id,
  fa.id as facet_account_id
FROM people p
JOIN facet_account fa
  ON fa.account_id = p.account_id
  AND fa.kind_id = 1  -- persona
  AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.segment), ' ', '-'))
WHERE p.segment IS NOT NULL
  AND TRIM(p.segment) != ''
  AND TRIM(p.segment) != 'null'
  -- Don't create duplicates
  AND NOT EXISTS (
    SELECT 1 FROM person_facet pf
    WHERE pf.person_id = p.id
      AND pf.facet_account_id = fa.id
  );

-- Step 5: Verify migration
-- Run this query to check results:
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

  RAISE NOTICE 'Migration summary:';
  RAISE NOTICE '  People migrated: %', migrated_count;
  RAISE NOTICE '  Unique segments: %', unique_segments;
  RAISE NOTICE '  Facets created: %', created_facets;
END $$;

-- Step 6 (MANUAL - DO NOT RUN YET):
-- After verifying the migration worked, you can clean up deprecated columns:
--
-- ALTER TABLE people DROP COLUMN IF EXISTS segment;
-- ALTER TABLE people DROP COLUMN IF EXISTS role;  -- Interview role is in interview_people
-- ALTER TABLE people DROP COLUMN IF EXISTS occupation;  -- Use job_function instead
--
-- NOTE: Do NOT run this automatically. Verify data first!
