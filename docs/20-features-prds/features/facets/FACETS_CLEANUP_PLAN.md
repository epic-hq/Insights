# Facets Schema Cleanup Plan

## Problem
Mixed migration and declarative schema changes causing conflicts:
- Modified already-applied migration: `20251023082644_evidence_Facets.sql`
- Created new migration: `20251024120000_simplify_facets.sql`
- Modified declarative schemas: `12_core_tables.sql`, `32_evidence.sql`
- Error: `idx_evidence_facet_account_id` already exists (created twice)

## Root Cause
The previous AI mixed two approaches:
1. ✅ Updated declarative schema files (correct)
2. ❌ Also modified an existing migration (wrong)
3. ❌ Created a new migration manually (wrong)

## Solution Steps

### Step 1: Restore Clean State
```bash
# Discard changes to the already-applied migration
git restore supabase/migrations/20251023082644_evidence_Facets.sql

# Delete the manually created migration
rm supabase/migrations/20251024120000_simplify_facets.sql

# Keep the declarative schema changes (these are correct)
# - supabase/schemas/12_core_tables.sql
# - supabase/schemas/32_evidence.sql
```

### Step 2: Update Declarative Schema (32_evidence.sql)

The schema file needs to match what you want. Currently it has:
- `facet_ref text` (old column)
- `evidence_facet_ref_pattern` constraint (old)

It should have:
- `facet_account_id integer not null` (new column)
- Foreign key to `facet_account(id)`
- Index on `facet_account_id`

### Step 3: Generate Clean Migration
```bash
# This will compare declarative schemas to current DB state
# and generate a migration with all the changes
supabase db diff -f simplify_facets
```

### Step 4: Review and Apply
```bash
# Review the generated migration
cat supabase/migrations/*_simplify_facets.sql

# Apply to local
supabase db reset

# Or apply just the new migration
supabase migration up
```

## What the Migration Should Contain

Based on declarative schema changes:

### From 12_core_tables.sql:
- Add `is_active` column to `facet_account`
- Drop `project_facet` table
- Drop `facet_candidate` table
- Modify `person_facet`:
  - Add `facet_account_id` column
  - Migrate data from `facet_ref` to `facet_account_id`
  - Drop `facet_ref` column
  - Drop `candidate_id` column
  - Change PK to `(person_id, facet_account_id)`
  - Add FK to `facet_account(id)`
  - Add index on `facet_account_id`

### From 32_evidence.sql:
- Modify `evidence_facet`:
  - Change `facet_ref` to `facet_account_id integer not null`
  - Drop `evidence_facet_ref_pattern` constraint
  - Add FK to `facet_account(id)`
  - Add index on `facet_account_id`

## Commands to Execute

```bash
# 1. Clean up mixed changes
git restore supabase/migrations/20251023082644_evidence_Facets.sql
rm supabase/migrations/20251024120000_simplify_facets.sql

# 2. Update 32_evidence.sql to match desired state (see below)

# 3. Generate migration from declarative schemas
supabase db diff -f simplify_facets

# 4. Review and test
supabase db reset
```

## Next: Update 32_evidence.sql

The file needs these changes to match the desired state.
