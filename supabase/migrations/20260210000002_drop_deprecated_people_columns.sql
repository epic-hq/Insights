-- Phase 3E: Drop deprecated text columns from people table
-- These have been replaced by:
--   company  -> default_organization_id FK to organizations
--   industry -> organizations.industry
--   occupation -> (was unused/rarely populated, data preserved in facets)
--
-- Prerequisite: Phase 3D code changes deployed (reads from org join, not these columns)
-- Prerequisite: Backfill verified (company_but_no_org = 0)

ALTER TABLE people DROP COLUMN IF EXISTS company;
ALTER TABLE people DROP COLUMN IF EXISTS industry;
ALTER TABLE people DROP COLUMN IF EXISTS occupation;
