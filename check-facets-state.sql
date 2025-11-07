-- Check current state of facets and people segmentation
-- Run this with: npx supabase db execute --file check-facets-state.sql

\echo '\n=== Checking People table columns ==='
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'people'
  AND column_name IN ('job_function', 'seniority_level', 'title', 'industry', 'life_stage', 'age_range', 'segment', 'role', 'occupation')
ORDER BY column_name;

\echo '\n=== Checking facet_kind_global entries ==='
SELECT id, slug, label
FROM facet_kind_global
ORDER BY slug;

\echo '\n=== Checking facet_account counts by kind ==='
SELECT
  fkg.slug as kind,
  fkg.label,
  COUNT(fa.id) as facet_count
FROM facet_kind_global fkg
LEFT JOIN facet_account fa ON fa.kind_id = fkg.id
GROUP BY fkg.slug, fkg.label
ORDER BY fkg.slug;

\echo '\n=== Checking person_facet link counts ==='
SELECT
  fkg.slug as kind,
  COUNT(DISTINCT pf.person_id) as people_linked,
  COUNT(*) as total_links
FROM person_facet pf
JOIN facet_account fa ON fa.id = pf.facet_account_id
JOIN facet_kind_global fkg ON fkg.id = fa.kind_id
GROUP BY fkg.slug
ORDER BY fkg.slug;

\echo '\n=== Checking people with segment data (old fields) ==='
SELECT
  COUNT(*) as total_people,
  COUNT(segment) FILTER (WHERE segment IS NOT NULL AND segment != '') as with_segment,
  COUNT(role) FILTER (WHERE role IS NOT NULL AND role != '') as with_role,
  COUNT(title) FILTER (WHERE title IS NOT NULL AND title != '') as with_title,
  COUNT(industry) FILTER (WHERE industry IS NOT NULL AND industry != '') as with_industry,
  COUNT(occupation) FILTER (WHERE occupation IS NOT NULL AND occupation != '') as with_occupation
FROM people;

\echo '\n=== Sample people data ==='
SELECT
  id,
  name,
  segment,
  role,
  title,
  industry,
  occupation,
  company
FROM people
LIMIT 5;
