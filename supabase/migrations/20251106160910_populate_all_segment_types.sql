-- Migration: Populate all segment types from people attributes
-- Creates facet_account and person_facet entries for job_function, seniority_level,
-- title, industry, life_stage, and age_range

-- Step 1: Create facet_kind_global entries for all segment types
INSERT INTO facet_kind_global (slug, label, description, created_at, updated_at) VALUES
  ('job_function', 'Job Function', 'Department or functional role (Engineering, Product, Sales, etc.)', now(), now()),
  ('seniority_level', 'Seniority Level', 'Career level (C-Level, VP, Director, Manager, IC)', now(), now()),
  ('title', 'Job Title', 'Specific job titles', now(), now()),
  ('industry', 'Industry', 'Industry background (SaaS, FinTech, Healthcare, etc.)', now(), now()),
  ('life_stage', 'Life Stage', 'Life stage (Student, New Parent, Retiree, etc.)', now(), now()),
  ('age_range', 'Age Range', 'Age bracket (18-24, 25-34, 35-44, etc.)', now(), now())
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Step 2: Create facet_account entries for job_function
INSERT INTO facet_account (account_id, kind_id, slug, label, description, created_at, updated_at)
SELECT DISTINCT
  p.account_id,
  (SELECT id FROM facet_kind_global WHERE slug = 'job_function'),
  LOWER(REPLACE(TRIM(p.job_function), ' ', '-')),
  TRIM(p.job_function),
  'Job function segment - auto-generated',
  now(),
  now()
FROM people p
WHERE p.job_function IS NOT NULL AND TRIM(p.job_function) != ''
ON CONFLICT (account_id, kind_id, slug) DO NOTHING;

-- Step 3: Create facet_account entries for seniority_level
INSERT INTO facet_account (account_id, kind_id, slug, label, description, created_at, updated_at)
SELECT DISTINCT
  p.account_id,
  (SELECT id FROM facet_kind_global WHERE slug = 'seniority_level'),
  LOWER(REPLACE(TRIM(p.seniority_level), ' ', '-')),
  TRIM(p.seniority_level),
  'Seniority level segment - auto-generated',
  now(),
  now()
FROM people p
WHERE p.seniority_level IS NOT NULL AND TRIM(p.seniority_level) != ''
ON CONFLICT (account_id, kind_id, slug) DO NOTHING;

-- Step 4: Create facet_account entries for title
INSERT INTO facet_account (account_id, kind_id, slug, label, description, created_at, updated_at)
SELECT DISTINCT
  p.account_id,
  (SELECT id FROM facet_kind_global WHERE slug = 'title'),
  LOWER(REPLACE(TRIM(p.title), ' ', '-')),
  TRIM(p.title),
  'Job title segment - auto-generated',
  now(),
  now()
FROM people p
WHERE p.title IS NOT NULL AND TRIM(p.title) != ''
ON CONFLICT (account_id, kind_id, slug) DO NOTHING;

-- Step 5: Create facet_account entries for industry
INSERT INTO facet_account (account_id, kind_id, slug, label, description, created_at, updated_at)
SELECT DISTINCT
  p.account_id,
  (SELECT id FROM facet_kind_global WHERE slug = 'industry'),
  LOWER(REPLACE(TRIM(p.industry), ' ', '-')),
  TRIM(p.industry),
  'Industry segment - auto-generated',
  now(),
  now()
FROM people p
WHERE p.industry IS NOT NULL AND TRIM(p.industry) != ''
ON CONFLICT (account_id, kind_id, slug) DO NOTHING;

-- Step 6: Create facet_account entries for life_stage
INSERT INTO facet_account (account_id, kind_id, slug, label, description, created_at, updated_at)
SELECT DISTINCT
  p.account_id,
  (SELECT id FROM facet_kind_global WHERE slug = 'life_stage'),
  LOWER(REPLACE(TRIM(p.life_stage), ' ', '-')),
  TRIM(p.life_stage),
  'Life stage segment - auto-generated',
  now(),
  now()
FROM people p
WHERE p.life_stage IS NOT NULL AND TRIM(p.life_stage) != ''
ON CONFLICT (account_id, kind_id, slug) DO NOTHING;

-- Step 7: Create facet_account entries for age_range
INSERT INTO facet_account (account_id, kind_id, slug, label, description, created_at, updated_at)
SELECT DISTINCT
  p.account_id,
  (SELECT id FROM facet_kind_global WHERE slug = 'age_range'),
  LOWER(REPLACE(TRIM(p.age_range), ' ', '-')),
  TRIM(p.age_range),
  'Age range segment - auto-generated',
  now(),
  now()
FROM people p
WHERE p.age_range IS NOT NULL AND TRIM(p.age_range) != ''
ON CONFLICT (account_id, kind_id, slug) DO NOTHING;

-- Step 8-13: Link people to facets via person_facet (for all types)
DO $$
DECLARE
  job_func_kind_id INTEGER;
  seniority_kind_id INTEGER;
  title_kind_id INTEGER;
  industry_kind_id INTEGER;
  life_stage_kind_id INTEGER;
  age_range_kind_id INTEGER;
BEGIN
  -- Get kind IDs
  SELECT id INTO job_func_kind_id FROM facet_kind_global WHERE slug = 'job_function';
  SELECT id INTO seniority_kind_id FROM facet_kind_global WHERE slug = 'seniority_level';
  SELECT id INTO title_kind_id FROM facet_kind_global WHERE slug = 'title';
  SELECT id INTO industry_kind_id FROM facet_kind_global WHERE slug = 'industry';
  SELECT id INTO life_stage_kind_id FROM facet_kind_global WHERE slug = 'life_stage';
  SELECT id INTO age_range_kind_id FROM facet_kind_global WHERE slug = 'age_range';

  -- Link job_function
  INSERT INTO person_facet (person_id, facet_account_id, account_id, project_id, source)
  SELECT DISTINCT p.id, fa.id, p.account_id, e.project_id, 'manual'
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = job_func_kind_id
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.job_function), ' ', '-'))
  JOIN evidence_people ep ON ep.person_id = p.id
  JOIN evidence e ON e.id = ep.evidence_id
  WHERE p.job_function IS NOT NULL AND TRIM(p.job_function) != ''
  ON CONFLICT (person_id, facet_account_id) DO NOTHING;

  -- Link seniority_level
  INSERT INTO person_facet (person_id, facet_account_id, account_id, project_id, source)
  SELECT DISTINCT p.id, fa.id, p.account_id, e.project_id, 'manual'
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = seniority_kind_id
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.seniority_level), ' ', '-'))
  JOIN evidence_people ep ON ep.person_id = p.id
  JOIN evidence e ON e.id = ep.evidence_id
  WHERE p.seniority_level IS NOT NULL AND TRIM(p.seniority_level) != ''
  ON CONFLICT (person_id, facet_account_id) DO NOTHING;

  -- Link title
  INSERT INTO person_facet (person_id, facet_account_id, account_id, project_id, source)
  SELECT DISTINCT p.id, fa.id, p.account_id, e.project_id, 'manual'
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = title_kind_id
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.title), ' ', '-'))
  JOIN evidence_people ep ON ep.person_id = p.id
  JOIN evidence e ON e.id = ep.evidence_id
  WHERE p.title IS NOT NULL AND TRIM(p.title) != ''
  ON CONFLICT (person_id, facet_account_id) DO NOTHING;

  -- Link industry
  INSERT INTO person_facet (person_id, facet_account_id, account_id, project_id, source)
  SELECT DISTINCT p.id, fa.id, p.account_id, e.project_id, 'manual'
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = industry_kind_id
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.industry), ' ', '-'))
  JOIN evidence_people ep ON ep.person_id = p.id
  JOIN evidence e ON e.id = ep.evidence_id
  WHERE p.industry IS NOT NULL AND TRIM(p.industry) != ''
  ON CONFLICT (person_id, facet_account_id) DO NOTHING;

  -- Link life_stage
  INSERT INTO person_facet (person_id, facet_account_id, account_id, project_id, source)
  SELECT DISTINCT p.id, fa.id, p.account_id, e.project_id, 'manual'
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = life_stage_kind_id
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.life_stage), ' ', '-'))
  JOIN evidence_people ep ON ep.person_id = p.id
  JOIN evidence e ON e.id = ep.evidence_id
  WHERE p.life_stage IS NOT NULL AND TRIM(p.life_stage) != ''
  ON CONFLICT (person_id, facet_account_id) DO NOTHING;

  -- Link age_range
  INSERT INTO person_facet (person_id, facet_account_id, account_id, project_id, source)
  SELECT DISTINCT p.id, fa.id, p.account_id, e.project_id, 'manual'
  FROM people p
  JOIN facet_account fa ON fa.account_id = p.account_id
    AND fa.kind_id = age_range_kind_id
    AND LOWER(fa.slug) = LOWER(REPLACE(TRIM(p.age_range), ' ', '-'))
  JOIN evidence_people ep ON ep.person_id = p.id
  JOIN evidence e ON e.id = ep.evidence_id
  WHERE p.age_range IS NOT NULL AND TRIM(p.age_range) != ''
  ON CONFLICT (person_id, facet_account_id) DO NOTHING;
END $$;

-- Step 14: Verify migration
DO $$
DECLARE
  persona_count INTEGER;
  job_function_count INTEGER;
  seniority_count INTEGER;
  title_count INTEGER;
  industry_count INTEGER;
  life_stage_count INTEGER;
  age_range_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO persona_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'persona';

  SELECT COUNT(*) INTO job_function_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'job_function';

  SELECT COUNT(*) INTO seniority_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'seniority_level';

  SELECT COUNT(*) INTO title_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'title';

  SELECT COUNT(*) INTO industry_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'industry';

  SELECT COUNT(*) INTO life_stage_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'life_stage';

  SELECT COUNT(*) INTO age_range_count
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fa.kind_id = fkg.id
    WHERE fkg.slug = 'age_range';

  RAISE NOTICE 'Segment type population summary:';
  RAISE NOTICE '  Personas: %', persona_count;
  RAISE NOTICE '  Job Functions: %', job_function_count;
  RAISE NOTICE '  Seniority Levels: %', seniority_count;
  RAISE NOTICE '  Titles: %', title_count;
  RAISE NOTICE '  Industries: %', industry_count;
  RAISE NOTICE '  Life Stages: %', life_stage_count;
  RAISE NOTICE '  Age Ranges: %', age_range_count;
  RAISE NOTICE 'Total: %', (persona_count + job_function_count + seniority_count + title_count + industry_count + life_stage_count + age_range_count);
END $$;
