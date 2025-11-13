-- Debug ICP data issue
-- Check what data exists for the project

-- 1. Evidence count
SELECT 'Evidence count:' as check_type, COUNT(*) as count
FROM evidence e
JOIN projects p ON p.id = e.project_id
WHERE p.account_id = (SELECT id FROM accounts.accounts LIMIT 1);

-- 2. Person facets count by kind
SELECT 'Person facets by kind:' as check_type, fkg.slug, fkg.label, COUNT(*) as count
FROM person_facet pf
JOIN facet_account fa ON fa.id = pf.facet_account_id
JOIN facet_kind_global fkg ON fkg.id = fa.kind_id
JOIN projects p ON p.id = pf.project_id
WHERE p.account_id = (SELECT id FROM accounts.accounts LIMIT 1)
GROUP BY fkg.slug, fkg.label
ORDER BY count DESC;

-- 3. Evidence facets count by kind
SELECT 'Evidence facets by kind:' as check_type, kind_slug, COUNT(*) as count
FROM evidence_facet ef
JOIN projects p ON p.id = ef.project_id
WHERE p.account_id = (SELECT id FROM accounts.accounts LIMIT 1)
GROUP BY kind_slug
ORDER BY count DESC;

-- 4. Check for people
SELECT 'People count:' as check_type, COUNT(*) as count
FROM people p
WHERE p.account_id = (SELECT id FROM accounts.accounts LIMIT 1);

-- 5. Sample of person_facets with labels
SELECT 'Sample person facets:' as check_type,
  fkg.slug as kind,
  fa.label,
  COUNT(DISTINCT pf.person_id) as person_count
FROM person_facet pf
JOIN facet_account fa ON fa.id = pf.facet_account_id
JOIN facet_kind_global fkg ON fkg.id = fa.kind_id
JOIN projects p ON p.id = pf.project_id
WHERE p.account_id = (SELECT id FROM accounts.accounts LIMIT 1)
GROUP BY fkg.slug, fa.label
ORDER BY person_count DESC
LIMIT 10;

-- 6. Sample of evidence facets (pains)
SELECT 'Sample pain facets:' as check_type,
  kind_slug,
  label,
  COUNT(DISTINCT evidence_id) as evidence_count
FROM evidence_facet ef
JOIN projects p ON p.id = ef.project_id
WHERE p.account_id = (SELECT id FROM accounts.accounts LIMIT 1)
  AND kind_slug = 'pain'
GROUP BY kind_slug, label
ORDER BY evidence_count DESC
LIMIT 10;

-- 7. Check for old segment data
SELECT 'Old segment data:' as check_type, segment, COUNT(*) as count
FROM people
WHERE account_id = (SELECT id FROM accounts.accounts LIMIT 1)
  AND segment IS NOT NULL
GROUP BY segment;
