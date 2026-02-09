-- Phase 3C: Swap dedup index from company text to organization FK
-- MUST run AFTER 3A (data backfill) has been verified.
-- See _bmad-output/schema-cleanup-people-table.md for full spec.
--
-- This migration:
-- 1. Creates the new org-based unique index
-- 2. Drops the old company-based unique index
-- 3. Changes the FK to ON DELETE RESTRICT (prevents orphaned org refs)

-- Step 1: Create new unique index using default_organization_id
-- Note: Cannot use CONCURRENTLY inside a transaction block (Supabase migrations
-- run in transactions). If this is a concern for large tables, run manually
-- outside a transaction first, then run this migration.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_account_name_org_email
  ON public.people (
    account_id,
    name_hash,
    COALESCE(default_organization_id::text, ''),
    COALESCE(lower(primary_email), '')
  );

-- Step 2: Drop old company-based index
DROP INDEX IF EXISTS uniq_people_account_name_company_email;

-- Step 3: Change FK from ON DELETE SET NULL to ON DELETE RESTRICT
-- This prevents org deletion when people reference it, avoiding index violations.
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_default_organization_id_fkey;
ALTER TABLE people ADD CONSTRAINT people_default_organization_id_fkey
  FOREIGN KEY (default_organization_id)
  REFERENCES organizations(id)
  ON DELETE RESTRICT;

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT people_default_organization_id_fkey ON people IS
  'ON DELETE RESTRICT: Cannot delete organization while people reference it. Reassign people first.';
