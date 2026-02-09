# Schema Cleanup: People Table Field Consolidation

**Date:** 2026-02-09
**Origin:** BMad Party Mode consensus (Winston, Mary, John, Sally, Amelia, Bob)
**Status:** Approved - Phase 1 in progress

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

## Phased Implementation

### Phase 1 — Hotfixes & Quick Wins (no DB migration)

**Scope:** Stop writing to deprecated fields, fix facet naming bug, clean UI.

| # | Task | Files | Risk |
|---|------|-------|------|
| 1 | Fix `syncTitleToFacet` — rename facet kind from `job_function` to `job_title`, or remove entirely | `syncTitleToFacet.server.ts` | Low |
| 2 | Stop writing `people.role` in import | `import-people-from-table.ts` | Low |
| 3 | Stop writing `people.occupation` in import | `import-people-from-table.ts` | Low |
| 4 | Remove `role`/`occupation` from edit form | `edit.tsx` | Low |
| 5 | Remove `role`/`occupation` from inline update API | `update-inline.tsx` | Low |
| 6 | Remove `people.role` from UI display | `EnhancedPersonCard.tsx`, `PeopleDataTable.tsx`, `generatePersonDescription.server.ts` | Low |
| 7 | Clean BAML input — remove `role` from `PersonSegmentInput` or mark optional-only | `infer_person_segments.baml` | Low |

**Definition of Done:**
- [ ] `syncTitleToFacet` no longer creates facets under `job_function` kind
- [ ] Import tool does not write to `people.role` or `people.occupation`
- [ ] Edit form and inline update API do not accept `role` or `occupation`
- [ ] UI components do not display `people.role` or `people.occupation`
- [ ] Existing data in deprecated columns untouched (no destructive migration)
- [ ] All existing tests pass

### Phase 2 — Segment Migration & Naming (schema migration, moderate risk)

- Sally's Option A: Swap segment badge for primary persona facet badge in UI
- Migrate existing `people.segment` data into persona facets
- Rename `people_organizations.role` → `job_title`
- Rename `people.title` → `job_title` for consistency
- Rename `project_people.role` → `relationship_type`

### Phase 3 — Company Denormalization Cleanup (schema migration, high risk)

- Redesign dedup index to not depend on `people.company` text
- Ensure all people with company text have linked `organizations` rows
- Rebuild unique index using org FK
- Drop `people.company` column
- Resolve company display from org FK at read time
