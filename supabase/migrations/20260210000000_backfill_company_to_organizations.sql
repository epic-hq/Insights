-- Phase 3A: Backfill people.company text into organizations table
-- For each unique (account_id, company) pair, find or create an organization,
-- then set default_organization_id on the person.
-- See _bmad-output/schema-cleanup-people-table.md for full spec.
--
-- This migration is IDEMPOTENT and non-destructive.
-- Safe to re-run if interrupted.

-- Step 1: Normalize common junk values in company text before creating orgs.
-- Set obvious non-company values to empty string so we skip them.
UPDATE people
SET company = ''
WHERE company IS NOT NULL
  AND lower(trim(company)) IN (
    'n/a', 'na', 'none', 'null', '-', '--', '.', '..', 'unknown',
    'self', 'self-employed', 'self employed', 'freelance', 'freelancer',
    'independent', 'consultant', 'personal', 'myself', 'me', 'individual',
    'retired', 'student', 'unemployed', 'not applicable', 'no company',
    'tbd', 'test', 'testing', 'asdf', 'xxx', 'abc', 'company'
  )
  AND default_organization_id IS NULL;
-- Step 2: Normalize company text casing/whitespace for better org matching.
-- Trim leading/trailing whitespace and collapse internal whitespace.
UPDATE people
SET company = trim(regexp_replace(company, '\s+', ' ', 'g'))
WHERE company != ''
  AND company IS NOT NULL
  AND company != trim(regexp_replace(company, '\s+', ' ', 'g'));
-- Step 3: Create organizations for company names that don't have matching orgs.
-- Uses DISTINCT ON to avoid duplicate org creation per account.
-- Tags auto-created orgs for rollback identification.
INSERT INTO organizations (account_id, name, description)
SELECT DISTINCT ON (p.account_id, lower(trim(p.company)))
  p.account_id,
  trim(p.company),
  'Auto-created from people.company during Phase 3A schema cleanup [2026-02-10]'
FROM people p
WHERE p.company != ''
  AND p.company IS NOT NULL
  AND p.default_organization_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.account_id = p.account_id
      AND lower(trim(o.name)) = lower(trim(p.company))
  )
ORDER BY p.account_id, lower(trim(p.company)), p.created_at ASC
ON CONFLICT DO NOTHING;
-- Step 4: Link people to their matching organizations via default_organization_id.
-- Match by normalized name (case-insensitive, trimmed).
-- Use the most recently updated org if multiple matches exist.
UPDATE people p
SET default_organization_id = (
  SELECT o.id
  FROM organizations o
  WHERE o.account_id = p.account_id
    AND lower(trim(o.name)) = lower(trim(p.company))
  ORDER BY o.updated_at DESC
  LIMIT 1
)
WHERE p.company != ''
  AND p.company IS NOT NULL
  AND p.default_organization_id IS NULL;
-- Step 5: Create people_organizations junction rows for any missing links.
-- Only for people who now have a default_organization_id but no junction row.
INSERT INTO people_organizations (account_id, person_id, organization_id, is_primary)
SELECT
  p.account_id,
  p.id,
  p.default_organization_id,
  true
FROM people p
WHERE p.default_organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM people_organizations po
    WHERE po.person_id = p.id
      AND po.organization_id = p.default_organization_id
  )
ON CONFLICT DO NOTHING;
-- Step 6: Backfill industry from people to their default organization.
-- Only fills in where the org doesn't already have an industry set.
UPDATE organizations o
SET industry = p.industry
FROM people p
WHERE p.default_organization_id = o.id
  AND p.industry IS NOT NULL
  AND p.industry != ''
  AND (o.industry IS NULL OR o.industry = '');
-- Verification queries (run manually after migration):
--
-- Must return 0 (no people with company text but no org link):
-- SELECT count(*) FROM people WHERE company != '' AND company IS NOT NULL AND default_organization_id IS NULL;
--
-- Check auto-created org count:
-- SELECT count(*) FROM organizations WHERE description LIKE 'Auto-created from people.company%';
--
-- Compare dedup index equivalence (both should return 0):
-- SELECT count(*) FROM (
--   SELECT account_id, name_hash, COALESCE(lower(company), ''), COALESCE(lower(primary_email), '')
--   FROM people GROUP BY 1,2,3,4 HAVING count(*) > 1
-- ) old_dupes;
--
-- SELECT count(*) FROM (
--   SELECT account_id, name_hash, COALESCE(default_organization_id::text, ''), COALESCE(lower(primary_email), '')
--   FROM people GROUP BY 1,2,3,4 HAVING count(*) > 1
-- ) new_dupes;;
