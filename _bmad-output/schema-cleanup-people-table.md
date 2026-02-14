# Schema Cleanup: People Table Field Consolidation

**Date:** 2026-02-09
**Origin:** BMad Party Mode consensus (Winston, Mary, John, Sally, Amelia, Bob)
**Status:** Phase 1 complete, Phase 2 complete, Phase 3 spec ready

---

## Problem Statement

The `people` table has accumulated overlapping, deprecated, and inconsistently-used fields that cause confusion in data sources and UI. Key issues:

1. **`role` means 4 different things** across `people.role`, `people_organizations.role`, `project_people.role`, `interview_people.role`
2. **`people.company` (text) duplicates `default_organization_id` (FK)** — denormalization baked into the dedup unique index
3. **`title` flows into 5 representations** — `people.title`, `people_organizations.role`, `job_function` facet, inferred `job_function` enum, inferred `seniority_level`
4. **`segment` deprecated but still in active UI/import paths** — migration to persona facets never completed
5. **`syncTitleToFacet.server.ts` creates `job_function` facets from raw title text** — mixing with AI-inferred enum values (DATA INTEGRITY BUG)
6. **`occupation` deprecated** — overlaps with `job_function`
7. **`industry` duplicated** on both `people` and `organizations` tables

## Target Model

**Person = identity + organizational context + AI-derived segments**

```
people
  -- Identity
  firstname, lastname, name (generated), name_hash (generated)
  primary_email, primary_phone, contact_info (jsonb)

  -- Professional (B2B)
  job_title          -- raw text: "VP of Engineering" (renamed from title)
  job_function       -- AI-derived enum: "Engineering"
  seniority_level    -- AI-derived enum: "VP"
  default_organization_id  -- FK to orgs (single source of company truth)
  -- DROP: company, role, occupation, segment

  -- Demographics (B2C)
  age, age_range, gender, life_stage, education, income

  -- Classification
  person_type, customer_stage (renamed from lifecycle_stage)
```

```
people_organizations
  person_id, organization_id
  job_title          -- their title AT this org (renamed from role)
  relationship_status, is_primary
```

---

## Phase 1 — Hotfixes & Quick Wins (COMPLETE)

**Status:** Merged. 9 files changed.

- Fixed `syncTitleToFacet` facet kind from `job_function` to `job_title`
- Stopped writing `people.role` in import and upsert tools
- Cleaned BAML input (marked role as deprecated)
- Added `job_title` facet kind to seeds

## Phase 2 — Column Renames (COMPLETE)

**Status:** Merged. 18 files changed. Migration: `20260209000000_rename_role_columns.sql`

- Renamed `people_organizations.role` -> `job_title`
- Renamed `project_people.role` -> `relationship_type`
- Updated all code references across 15+ files

---

## Phase 3 — Company Denormalization Cleanup (DETAILED SPEC)

### Executive Summary

Remove the denormalized `people.company` text field and make `default_organization_id` (FK) + `people_organizations` junction table the single source of truth for a person's company. This requires redesigning the dedup unique index, updating identity resolution logic, and migrating all existing company text data to organization records.

**Why this is hard:** The unique index `uniq_people_account_name_company_email` uses `people.company` as a constraint component. Removing it changes the fundamental identity model for person dedup. 74+ files reference company across 8 categories.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dedup index change causes duplicate inserts | CRITICAL | Sub-step migration: new index alongside old, then swap |
| Existing people lose company context | HIGH | Data migration backfills org records BEFORE dropping column |
| Resolution logic breaks for interview ingestion | HIGH | Update + integration test BEFORE migration |
| UI displays empty company | MEDIUM | Computed view or JOIN provides backwards compat |
| Mastra tools write stale company field | MEDIUM | Update tools to use org resolution |

### Architecture Decision: New Dedup Strategy

**Current index:**
```sql
CREATE UNIQUE INDEX uniq_people_account_name_company_email
  ON public.people (
    account_id,
    name_hash,
    COALESCE(lower(company), ''),
    COALESCE(lower(primary_email), '')
  );
```

**Problem:** Can't use `default_organization_id` (UUID FK) directly because:
- It's nullable (many people have no org yet)
- Org names can change (FK is stable, name isn't)
- NULL UUIDs don't participate in unique constraints the same way

**Chosen strategy: `COALESCE(default_organization_id::text, '')`**

```sql
CREATE UNIQUE INDEX uniq_people_account_name_org_email
  ON public.people (
    account_id,
    name_hash,
    COALESCE(default_organization_id::text, ''),
    COALESCE(lower(primary_email), '')
  );
```

**Why this works:**
- UUID is stable (unlike company text which varies by case/formatting)
- `COALESCE(..., '')` handles null orgs (person with no company)
- Two people with same name at different orgs get different UUIDs
- Two people with same name, same org, different emails are allowed
- Two people with same name, no org, no email are blocked (same as today)

**Trade-off:** Callers must resolve company text -> org UUID BEFORE inserting a person (instead of storing raw text). This is actually better because it forces proper organization resolution upfront.

**Alternative considered: Drop company from index entirely**
```sql
-- NOT chosen: too permissive
CREATE UNIQUE INDEX uniq_people_account_name_email
  ON public.people (account_id, name_hash, COALESCE(lower(primary_email), ''));
```
Rejected because: Two "John Smith" at different companies with no email would collide.

---

### Sub-Phase 3A: Data Migration (SQL only, no code changes)

**Goal:** Ensure every person with `company` text has a linked organization record via `default_organization_id`, so the new index has equivalent data.

**Migration: `20260210000000_backfill_company_to_organizations.sql`**

```sql
-- Phase 3A: Backfill people.company text into organizations table
-- For each unique (account_id, company) pair, find or create an organization,
-- then set default_organization_id on the person.

-- Step 1: Create organizations for company names that don't have matching orgs
-- Uses DISTINCT to avoid duplicate org creation
INSERT INTO organizations (account_id, name, description)
SELECT DISTINCT
  p.account_id,
  p.company,
  'Auto-created from people.company field during schema cleanup'
FROM people p
WHERE p.company != ''
  AND p.company IS NOT NULL
  AND p.default_organization_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.account_id = p.account_id
      AND lower(trim(o.name)) = lower(trim(p.company))
  )
ON CONFLICT DO NOTHING;

-- Step 2: Link people to their matching organizations
-- Match by normalized name (case-insensitive, trimmed)
UPDATE people p
SET default_organization_id = o.id
FROM organizations o
WHERE p.company != ''
  AND p.company IS NOT NULL
  AND p.default_organization_id IS NULL
  AND o.account_id = p.account_id
  AND lower(trim(o.name)) = lower(trim(p.company));

-- Step 3: Create people_organizations junction rows for any missing links
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

-- Step 4: Verification query (run manually, not in migration)
-- SELECT count(*) FROM people WHERE company != '' AND default_organization_id IS NULL;
-- Should return 0 after migration
```

**Rollback:** No destructive changes. Organizations created can be cleaned up. `default_organization_id` can be nulled if needed.

**Validation before proceeding to 3B:**
```sql
-- Must return 0
SELECT count(*) FROM people
WHERE company != '' AND company IS NOT NULL AND default_organization_id IS NULL;

-- Compare old vs new index uniqueness (should match)
SELECT count(*) FROM (
  SELECT account_id, name_hash,
    COALESCE(lower(company), '') as co,
    COALESCE(lower(primary_email), '') as em
  FROM people
  GROUP BY 1, 2, 3, 4
  HAVING count(*) > 1
) dupes_old;

SELECT count(*) FROM (
  SELECT account_id, name_hash,
    COALESCE(default_organization_id::text, '') as org,
    COALESCE(lower(primary_email), '') as em
  FROM people
  GROUP BY 1, 2, 3, 4
  HAVING count(*) > 1
) dupes_new;
-- Both should return 0 (no duplicates in either index scheme)
```

---

### Sub-Phase 3B: Code Changes (identity resolution + ingestion)

**Goal:** Update all identity resolution and ingestion code to use org FK instead of company text. These are the CRITICAL path changes that must be correct.

#### 3B-1: Update `resolveOrCreatePerson()` pipeline

**File:** `app/lib/people/resolution.server.ts`

**Changes:**
1. Add `resolveOrganization()` helper that converts company text -> org UUID
2. Update `findByNameCompany()` to query by `default_organization_id` instead of `company` text
3. Update `resolveOrCreatePerson()` to resolve org BEFORE creating person
4. Remove `company` from insert payload, use `default_organization_id` instead

**New helper function:**
```typescript
async function resolveOrganization(
  supabase: SupabaseClient<Database>,
  accountId: string,
  companyName: string
): Promise<string | null> {
  const normalized = companyName.trim().toLowerCase();
  if (!normalized) return null;

  // Try exact match first
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("account_id", accountId)
    .ilike("name", normalized)
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new organization
  const { data: newOrg } = await supabase
    .from("organizations")
    .insert({ account_id: accountId, name: companyName.trim() })
    .select("id")
    .single();

  return newOrg?.id ?? null;
}
```

**Updated `findByNameCompany()`:**
```typescript
// BEFORE: query.ilike("company", normalizedCompany)
// AFTER:  query.eq("default_organization_id", orgId)

async function findByNameOrg(
  supabase: SupabaseClient<Database>,
  accountId: string,
  name: string,
  orgId?: string | null
): Promise<{ id: string; name: string | null } | null> {
  let query = supabase.from("people").select("id, name")
    .eq("account_id", accountId)
    .ilike("name", name.trim().toLowerCase());

  if (orgId) {
    query = query.eq("default_organization_id", orgId);
  } else {
    query = query.is("default_organization_id", null);
  }

  const { data } = await query.limit(1).single();
  return data ?? null;
}
```

**Updated `resolveOrCreatePerson()`:**
```typescript
// Resolve org BEFORE person creation
const orgId = input.company
  ? await resolveOrganization(supabase, accountId, input.company)
  : null;

// Step 3: Name + org match (instead of name + company text)
const existing = await findByNameOrg(supabase, accountId, name, orgId);

// Step 4: Create with org FK (instead of company text)
const insertPayload: PeopleInsert = {
  ...
  default_organization_id: orgId,
  // company: REMOVED
};
```

**Integration test update:** `app/test/integration/people-resolution.integration.test.ts`

#### 3B-2: Update `upsertPersonWithCompanyAwareConflict()`

**File:** `app/features/interviews/peopleNormalization.server.ts`

**Changes:**
1. Rename to `upsertPersonWithOrgAwareConflict()`
2. Accept `orgId: string | null` instead of reading `payload.company`
3. Set `default_organization_id` in insert payload
4. On 23505 conflict, find by `(name_hash, default_organization_id, primary_email)` instead of `(name_hash, company, primary_email)`

**Key change in conflict handler:**
```typescript
// BEFORE
if (normalizedCompany) {
  findQuery = findQuery.ilike("company", normalizedCompany);
} else {
  findQuery = findQuery.eq("company", "");
}

// AFTER
if (orgId) {
  findQuery = findQuery.eq("default_organization_id", orgId);
} else {
  findQuery = findQuery.is("default_organization_id", null);
}
```

#### 3B-3: Update deduplication system

**File:** `app/features/people/deduplicate.ts`

**Changes (minimal):** The dedup system already prefers org name over company text (line 217: `primaryOrg || person.company`). After 3A data migration, `primaryOrg` will always be populated for anyone who had company text. The fallback to `person.company` can be removed.

```typescript
// BEFORE (line 217)
const company = normalize(primaryOrg || person.company);

// AFTER
const company = normalize(primaryOrg);
```

Same change at line 251 for firstname+company groups.

The `calculateCompleteness()` function (line 334) should replace `person.company` with `person.default_organization_id`:
```typescript
// BEFORE
if (person.company) score += 5;

// AFTER
if (person.default_organization_id) score += 5;
```

And in `fieldsToMerge` (line 631), replace `"company"` with `"default_organization_id"`.

#### 3B-4: Update Mastra tools

**File:** `app/mastra/tools/upsert-person.ts`

**Changes:**
1. Accept `company` in input schema (unchanged externally)
2. Resolve company -> org UUID internally before inserting
3. Set `default_organization_id` instead of `company` in person record
4. Update 23505 handler to match by org UUID
5. Remove `company` from insert payload

**File:** `app/mastra/tools/import-people-from-table.ts`

**Changes:**
1. When company column is detected, resolve to org UUID via `ensureOrganizationByName()`
2. Set `default_organization_id` instead of `company` in upsert payload
3. Still create `people_organizations` junction link (already does this)

#### 3B-5: Update enrichPerson trigger

**File:** `src/trigger/interview/v2/enrichPerson.ts`

**Changes:** The enrichPerson task creates orgs from `person.company` text (lines 170-238). After Phase 3A migration, all existing people have orgs. For new people (post-migration), company resolution happens at creation time. The enrichPerson org-linking code becomes a no-op but should be kept as a safety net for edge cases where `default_organization_id` is null.

```typescript
// AFTER: Check if org link is missing (safety net)
if (!person.default_organization_id) {
  // Same logic but reads company from people_organizations junction
  // or falls back to person description context
}
```

---

### Sub-Phase 3C: Index Swap (schema migration)

**Goal:** Replace the unique index atomically.

**Migration: `20260211000000_swap_dedup_index.sql`**

```sql
-- Phase 3C: Swap dedup index from company text to organization FK
-- MUST run AFTER 3A (data backfill) and 3B (code changes)

-- Step 1: Create new index CONCURRENTLY (no lock)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_people_account_name_org_email
  ON public.people (
    account_id,
    name_hash,
    COALESCE(default_organization_id::text, ''),
    COALESCE(lower(primary_email), '')
  );

-- Step 2: Verify new index is valid
-- (CONCURRENTLY can leave invalid indexes if it fails)
-- Check: SELECT indexrelid::regclass, indisvalid FROM pg_index
--        WHERE indexrelid = 'uniq_people_account_name_org_email'::regclass;

-- Step 3: Drop old index
DROP INDEX IF EXISTS uniq_people_account_name_company_email;
```

**Rollback:** If the new index causes issues:
```sql
-- Recreate old index (company data still exists at this point)
CREATE UNIQUE INDEX uniq_people_account_name_company_email
  ON public.people (account_id, name_hash, COALESCE(lower(company), ''), COALESCE(lower(primary_email), ''));
DROP INDEX uniq_people_account_name_org_email;
```

---

### Sub-Phase 3D: UI + Display Changes (low risk)

**Goal:** Update all UI code to read company from `organizations` join instead of `people.company`.

#### Files to update (by category):

**Loaders/Queries that SELECT company (add org join if missing):**
| File | Change |
|------|--------|
| `app/features/people/db.ts` | Already JOINs people_organizations; use org name instead of company |
| `app/features/people/pages/index.tsx` | Map org name to display |
| `app/features/people/pages/edit.tsx` | Remove company form field, show org picker |
| `app/features/people/pages/prospect.tsx` | Use org name |
| `app/features/people/api/update-inline.tsx` | Remove "company" from allowedFields |

**Components that display company:**
| File | Change |
|------|--------|
| `app/features/people/components/PeopleDataTable.tsx` | Column reads org name |
| `app/features/people/components/EnhancedPersonCard.tsx` | Already reads org; remove company fallback |
| `app/features/lenses/components/PersonAnalysisSheet.tsx` | Use org name |
| `app/features/lenses/components/EditPersonDataSheet.tsx` | Remove company field |
| `app/features/lenses/components/AnalysisByPersonTab.tsx` | Use org name |
| `app/features/lenses/components/ICPMatchSection.tsx` | Use org name |
| `app/features/lenses/components/ICPScoredPeopleTable.tsx` | Use org name |
| `app/features/interviews/components/NoteViewer.tsx` | Use org name |
| `app/features/interviews/pages/detail.tsx` | Use org name |
| `app/components/notes/QuickNoteDialog.tsx` | Use org name |

**Services that read company for context:**
| File | Change |
|------|--------|
| `app/features/people/services/generatePersonDescription.server.ts` | Read org name |
| `app/features/people/services/calculateICPScore.server.ts` | Read org name |
| `app/utils/salesLens.server.ts` | Read org name |
| `app/utils/processInterview.server.ts` | Pass org name |

**BAML/AI that receive company:**
| File | Change |
|------|--------|
| `baml_src/infer_person_segments.baml` | Change `company` input to read from org |
| `src/trigger/people/inferSegments.ts` | Resolve org name for BAML input |

**Search/API endpoints:**
| File | Change |
|------|--------|
| `app/routes/api.people.search.tsx` | Include org name in results |
| `app/mastra/tools/fetch-people-details.ts` | Return org name instead of company |
| `app/mastra/tools/manage-people.ts` | Remove company from direct updates |
| `app/mastra/tools/semantic-search-people.ts` | Search org name |
| `app/mastra/tools/parse-spreadsheet.ts` | Map company column to org resolution |

**Type definitions (auto-updated after column drop):**
| File | Change |
|------|--------|
| `app/database.types.ts` | Re-generate with `pnpm db:types` |
| `app/schemas.ts` | Remove `company: nullableString` |
| `app/types.ts` | Remove company from Person type |

**Other:**
| File | Change |
|------|--------|
| `app/features/people/services/internalPeople.server.ts` | Use org FK |
| `app/routes/api.onboarding-start.tsx` | Use org FK |
| `app/components/onboarding/OnboardingWalkthrough.tsx` | Use org picker |
| `app/features/onboarding/components/UploadScreen.tsx` | Map to org |

---

### Sub-Phase 3E: Drop Column (final, irreversible)

**Migration: `20260212000000_drop_people_company.sql`**

```sql
-- Phase 3E: Drop people.company column
-- ONLY run after all code changes are deployed and verified
-- This is IRREVERSIBLE - ensure data migration (3A) has been validated

-- Safety check: Verify no people have company without org link
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM people
    WHERE company != '' AND company IS NOT NULL
      AND default_organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot drop company: % people still have company text without org link',
      (SELECT count(*) FROM people WHERE company != '' AND default_organization_id IS NULL);
  END IF;
END $$;

-- Drop the column
ALTER TABLE people DROP COLUMN IF EXISTS company;

-- Also drop other deprecated columns in this phase
ALTER TABLE people DROP COLUMN IF EXISTS occupation;
-- Note: people.role and people.segment drops are separate phases
```

**Rollback:** Not possible for column drop. This is why we validate thoroughly in 3A-3D first.

---

### Implementation Order and Checkpoints

```
Sub-Phase 3A: Data Migration (SQL) — SAFE RESTING POINT
  |-- Normalize company text (strip junk, dedupe variants)
  |-- Run migration (create orgs, link people, backfill industry)
  |-- Tag auto-created orgs for rollback identification
  |-- CHECKPOINT: Verify 0 people with company text and no org link
  |-- CHECKPOINT: Verify no duplicate violations in new index scheme
  |-- CHECKPOINT: Run findDuplicates() and compare with pre-migration baseline
  |
Sub-Phase 3B+3C: Code Changes + Index Swap (DEPLOY TOGETHER)
  |-- 3B-1: resolution.server.ts (resolveOrCreatePerson pipeline)
  |-- 3B-2: peopleNormalization.server.ts (upsert conflict handler)
  |-- 3B-3: deduplicate.ts (dedup grouping logic)
  |-- 3B-4: Mastra tools (upsert-person, import-people-from-table, manage-person-organizations)
  |-- 3B-5: enrichPerson trigger (org linking)
  |-- NOTE: 3B code MUST still write company text as mirror until 3C index swap
  |-- CHECKPOINT: Integration tests pass
  |-- 3C: Create new index CONCURRENTLY
  |-- CHECKPOINT: New index is valid
  |-- 3C: Drop old index
  |-- 3C: Change FK to ON DELETE RESTRICT
  |-- CHECKPOINT: Person creation still works (try-insert-catch-find)
  |-- CHECKPOINT: Manual test matrix passes
  |
Sub-Phase 3D: UI + Display Changes (TypeScript) — SAFE RESTING POINT
  |-- Update all components to read org name
  |-- Remove company from forms/edit UIs
  |-- Update BAML inputs
  |-- CHECKPOINT: No TypeScript errors
  |-- CHECKPOINT: UI shows org names correctly
  |
Sub-Phase 3E: Drop Column (SQL, IRREVERSIBLE)
  |-- Safety check query
  |-- Drop columns: company, occupation, industry
  |-- Regenerate types: pnpm db:types
  |-- CHECKPOINT: App builds with no errors
  |-- CHECKPOINT: Full test suite passes
```

### Estimated Scope

| Sub-Phase | Files | Risk | Reversible |
|-----------|-------|------|------------|
| 3A: Data migration | 1 SQL file | Medium | Yes |
| 3B: Identity resolution | 5 core files | HIGH | Yes (revert code) |
| 3C: Index swap | 1 SQL file | HIGH | Yes (recreate old index) |
| 3D: UI/display | ~30 files | Low | Yes (revert code) |
| 3E: Drop column | 1 SQL file + types | LOW | NO |
| **Total** | **~38 files** | | |

### Key Principle: Safe Resting Points Between Deployment Groups

- After **3A**: App works identically (company text still exists, org links now populated). Safe resting point.
- After **3B+3C** (deploy together): App uses org FK for resolution AND new index enforces it. 3B continues writing `company` text as mirror until 3C swaps the index. **3B without 3C is NOT safe** — see Adversarial Critique.
- After **3D**: UI reads from org, company field ignored. Safe resting point.
- After **3E**: Column gone, clean schema. Irreversible.

**You can stop at 3A, 3B+3C, or 3D and the app works correctly.** Only 3E is irreversible.

### Testing Strategy

1. **Before 3A:** Run `findDuplicates()` on all accounts, save results
2. **After 3A:** Re-run `findDuplicates()`, verify same groups detected
3. **After 3B:** Run integration tests in `people-resolution.integration.test.ts`
4. **After 3B:** Manual test matrix:
   - Create person via interview (desktop)
   - Create person via Mastra import tool
   - Create person via manual edit form
   - Create duplicate person (same name+company) -> verify conflict detection
   - Create person with new company -> verify org auto-created
   - Create person with existing company -> verify matched to existing org
5. **After 3C:** Repeat manual test matrix (index now enforced)
6. **After 3D:** Visual QA of all people-related UI pages
7. **After 3E:** Full `pnpm build && pnpm test` must pass

### Adversarial Critique — Known Risks & Mitigations

> Added 2026-02-09 after adversarial review of the spec.

#### CRITICAL: 3B-without-3C data corruption window

**Problem:** `company` is `NOT NULL DEFAULT ''`. After 3B stops writing company text, new inserts get `company = ''` while the OLD index (`uniq_people_account_name_company_email`) still uses company. Two people at different orgs would both have `company = ''`, making the old index treat them as identical.

**Fix:** Sub-phase 3B MUST continue writing `company` text (as a redundant mirror of the org name) until 3C swaps the index. Add to 3B code: `company: orgName || ""` alongside `default_organization_id: orgId`. Only stop writing company AFTER 3C completes.

**This means 3B and 3C should deploy together, not independently.** Revise the "independently deployable" claim: 3A is independent, 3B+3C deploy as a unit, 3D is independent, 3E is independent.

#### CRITICAL: `ON DELETE SET NULL` on default_organization_id FK

**Problem:** The FK is `references organizations(id) ON DELETE SET NULL`. If an org is deleted, all people pointing to it get `default_organization_id = NULL`, collapsing to `COALESCE(..., '')` in the new index. If two people from the same (now-deleted) org had the same name and no email, they'd violate the unique constraint.

**Fix:** Change FK to `ON DELETE RESTRICT` in the 3C migration:
```sql
ALTER TABLE people DROP CONSTRAINT people_default_organization_id_fkey;
ALTER TABLE people ADD CONSTRAINT people_default_organization_id_fkey
  FOREIGN KEY (default_organization_id)
  REFERENCES organizations(id)
  ON DELETE RESTRICT;
```
This prevents org deletion when people reference it. Add a UI guard: "Cannot delete organization with linked people. Reassign them first."

#### HIGH: Fuzzy company name matching creates org duplicates

**Problem:** `resolveOrganization()` uses `ilike("name", normalized)` for exact case-insensitive match. But company text varies: "Acme Corp" vs "Acme Corp." vs "Acme Corporation" vs "ACME". The 3A migration will create separate orgs for each variant, splitting people who should be grouped together.

**Fix:** Add company name normalization BEFORE 3A migration:
1. Pre-migration cleanup script: normalize company text (strip trailing periods, standardize "Inc"/"Inc."/"Incorporated", trim whitespace)
2. OR: Use fuzzy matching (`similarity()` from pg_trgm) in the 3A org-matching query with a threshold
3. Post-3A: Run dedup on organizations table to merge near-duplicates
4. In `resolveOrganization()`: normalize input before lookup (same rules)

#### HIGH: `manage-person-organizations.ts` missing from file inventory

**Problem:** This Mastra tool has its own `ensureOrganization()` function and writes to `people_organizations`. It's not in the Phase 3 file list. After Phase 3, it should also set `default_organization_id` on the person when linking to a primary org (currently only creates the junction link).

**Fix:** Add to 3B-4 file list. When `is_primary = true`, also update `people.default_organization_id`.

#### MEDIUM: `people.industry` drop needs backfill

**Problem:** The spec says drop `people.industry` in 3E but doesn't backfill the data to organizations first. If people have industry values but their org doesn't, data is lost.

**Fix:** Add to 3A migration:
```sql
-- Backfill industry from people to their default organization
UPDATE organizations o
SET industry = p.industry
FROM people p
WHERE p.default_organization_id = o.id
  AND p.industry IS NOT NULL
  AND p.industry != ''
  AND (o.industry IS NULL OR o.industry = '');
```

#### MEDIUM: No rollback tagging for auto-created orgs

**Problem:** 3A creates organizations from raw company text. Some will be junk ("N/A", "-", "self", "freelance"). No way to identify and clean them up.

**Fix:** Add a description tag to auto-created orgs:
```sql
description: 'Auto-created from people.company during Phase 3A schema cleanup [2026-02-10]'
```
Rollback: `DELETE FROM organizations WHERE description LIKE 'Auto-created from people.company%' AND id NOT IN (SELECT default_organization_id FROM people WHERE default_organization_id IS NOT NULL);`

#### MEDIUM: Organizations are project-scoped but resolveOrganization() isn't

**Problem:** The `organizations` table has a `project_id` column. Two projects in the same account could each have an "Acme Corp" org. The proposed `resolveOrganization()` only filters by `account_id`, potentially matching the wrong project's org.

**Fix:** `resolveOrganization()` should prefer project-scoped match, then fall back to account-scoped:
```typescript
// Try project-scoped first
let query = supabase.from("organizations").select("id")
  .eq("account_id", accountId)
  .eq("project_id", projectId)
  .ilike("name", normalized);
// If no match, try account-wide
```

#### LOW: Org rename changes all people's displayed company instantly

**Problem:** After Phase 3, company display comes from org name. Renaming an org changes display for all linked people — feature for most cases, but a surprise if done accidentally.

**Accepted risk.** This is the correct behavior for a normalized schema. Mitigate with audit logging on org name changes (future work, not blocking).

---

### Open Questions

1. **Should `people.company` become a computed/virtual column during transition?**
   Pro: Zero UI changes needed for 3D. Con: Adds complexity, delays cleanup.
   **Recommendation:** No. Do the UI changes properly in 3D.

2. **What about `people.industry`?**
   Currently duplicated on people and organizations. Should follow same pattern (resolve from org).
   **Recommendation:** Backfill to orgs in 3A, then drop in 3E: `ALTER TABLE people DROP COLUMN IF EXISTS industry;`

3. **What about `people.segment`?**
   Already deprecated in Phase 1. Should be dropped in a separate Phase 4.
   **Recommendation:** Not in scope for Phase 3.

4. **Should 3B and 3C be a single atomic deployment?**
   **Recommendation:** Yes. The data corruption window makes independent deployment unsafe. Deploy 3B+3C together.
