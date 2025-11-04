# Facet System Migration Analysis

## Current State: INCOMPLETE MIGRATION

You're in the middle of migrating from `facet_ref` (string-based references like "a:123", "g:456") to proper foreign key relationships (`facet_account_id`).

## What's Been Done ✅

### Database Schema (Declarative)
- ✅ `person_facet` table updated to use `facet_account_id int` instead of `facet_ref text`
- ✅ `evidence_facet` table updated to use `facet_account_id int` instead of `facet_ref text`
- ✅ Proper foreign keys to `facet_account(id)` with cascade deletes
- ✅ Removed `project_facet` and `facet_candidate` tables (legacy)

### Migration File
- ✅ Migration created: `20251024154750_simplify_facets.sql`
- ✅ Adds columns as nullable first
- ✅ Migrates data from `facet_ref` to `facet_account_id`
- ✅ Deletes unmigrated rows (legacy global/project facets)
- ✅ Sets NOT NULL constraint after migration

## What's NOT Done ❌

### Application Code Still Uses `facet_ref`

**1. `facets.server.ts` - Core Logic**
- ❌ `getFacetCatalog()` returns `facet_ref` in catalog entries (lines 240, 253)
- ❌ `FacetResolver.ensureFacetForRef()` accepts `facet_ref` strings (line 60)
- ❌ `persistFacetObservations()` uses `facet_ref` in observations (line 305-306)

**2. `processInterview.server.ts` - Interview Processing**
- ❌ Uses `facet_ref` in facet lookup (line 306)
- ❌ Checks `matchedFacet?.facet_ref` (line 929-930)
- ❌ Sets `facet_ref` in observations (line 1400, 1402, 1419, 1440)
- ❌ Builds facet observations with `facet_ref` field (line 1400)

**3. Frontend Components**
- ❌ `features/people/pages/edit.tsx` - filters by `facet_ref.startsWith("a:")` (line 282)
- ❌ `features/people/pages/detail.tsx` - uses `facetsByRef` map keyed by `facet_ref` (lines 165, 176, 178)
- ❌ `features/people/pages/index.tsx` - uses `facetsByRef` map (lines 60, 72, 74)
- ❌ `features/people/components/EnhancedPersonCard.tsx` - uses `facet_ref` in interface (line 44)

**4. Tests**
- ❌ Integration tests use `facet_ref` throughout (lines 79, 86, 116, 124, 201, 211, 263)

## The Problem

**Database schema says:** Use `facet_account_id` (integer FK)
**Application code says:** Use `facet_ref` (string like "a:123")

This mismatch is why the migration fails on production - the app is still trying to write `facet_ref` values, but the database column no longer exists after migration.

## Two Options Forward

### Option 1: Complete the Migration (Recommended)
**Remove `facet_ref` entirely, use only `facet_account_id`**

**Pros:**
- Proper database normalization
- Better performance (integer joins vs string parsing)
- Type safety
- Cleaner code

**Cons:**
- Requires updating all application code
- More work upfront

**Changes needed:**
1. Update `getFacetCatalog()` to return `facet_account_id` instead of `facet_ref`
2. Update `FacetResolver` to work with IDs directly
3. Update `processInterview.server.ts` to use IDs
4. Update frontend to use `facet_account_id` instead of `facet_ref`
5. Update all tests
6. Update TypeScript types in BAML

### Option 2: Keep `facet_ref` (Backwards Compatible)
**Revert schema changes, keep using string references**

**Pros:**
- No code changes needed
- Works immediately
- Backwards compatible

**Cons:**
- String parsing overhead
- Less type-safe
- Harder to maintain
- Not normalized

**Changes needed:**
1. Revert `12_core_tables.sql` to use `facet_ref text`
2. Revert `32_evidence.sql` to use `facet_ref text`
3. Delete the migration file
4. Keep existing code as-is

## Recommendation

**Complete the migration (Option 1).** You're already 50% done with the schema changes. The remaining work is updating application code to use the new structure.

The string-based `facet_ref` system was a temporary solution. Moving to proper foreign keys is the right architectural choice for:
- Performance
- Data integrity
- Type safety
- Maintainability

## Next Steps if Completing Migration

1. **Update BAML types** - Change `FacetCatalogEntry` to use `facet_account_id` instead of `facet_ref`
2. **Update `facets.server.ts`** - Return IDs instead of refs
3. **Update `processInterview.server.ts`** - Use IDs throughout
4. **Update frontend components** - Use IDs for lookups
5. **Update tests** - Use IDs in test data
6. **Run migration** - Should work once code is updated

Estimated effort: 2-3 hours of focused work.
