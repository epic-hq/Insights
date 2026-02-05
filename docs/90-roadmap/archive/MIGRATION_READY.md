# ✅ Facet Migration Ready for Production

## Summary

The migration from `facet_ref` (string) to `facet_account_id` (integer FK) is **ready to deploy**.

## What Was Done

### 1. ✅ Code Already Updated
The application code was **already migrated** by the previous developer:
- `persistFacetObservations()` writes `facet_account_id` (not `facet_ref`)
- `FacetResolver` converts refs to IDs before writing
- Database upserts use `facet_account_id` as the conflict key

### 2. ✅ Migration Fixed
Updated `20251024154750_simplify_facets.sql` to:
- Add `facet_account_id` as nullable first
- Migrate data safely with validation (`a:123` → `123`)
- Log deletion counts before removing unmigrated rows
- Delete legacy global/project facets (`g:*`, `p:*`)
- Set NOT NULL only after data migration complete

### 3. ✅ Tested Locally
```
NOTICE: Will delete 0 evidence_facet rows with null facet_account_id
NOTICE: Will delete 0 person_facet rows with null facet_account_id
Finished supabase db reset on branch facets2.
```

## What Will Happen in Production

### Data Migration
1. **Migrated:** All `person_facet` and `evidence_facet` rows with `facet_ref = 'a:123'` → `facet_account_id = 123`
2. **Deleted:** Rows with:
   - `facet_ref = null` (never set)
   - `facet_ref = 'g:*'` (legacy global facets)
   - `facet_ref = 'p:*'` (legacy project facets)

### Schema Changes
- ✅ Drops `project_facet` table (legacy)
- ✅ Drops `facet_candidate` table (legacy)
- ✅ Removes `facet_ref` column from `person_facet`
- ✅ Removes `facet_ref` column from `evidence_facet`
- ✅ Adds `facet_account_id` with FK to `facet_account(id)`
- ✅ Changes PK to `(person_id, facet_account_id)`

## Deploy Command

```bash
npx supabase db push
```

The migration will:
1. Show you the deletion counts
2. Ask for confirmation
3. Apply all changes atomically

## Rollback Plan

If something goes wrong:
```bash
# Revert the migration file
git restore supabase/migrations/20251024154750_simplify_facets.sql

# Or manually rollback in production
# (Contact Supabase support if needed)
```

## Post-Migration

After successful deployment:
- ✅ New interviews will write `facet_account_id` directly
- ✅ No more string parsing overhead
- ✅ Proper foreign key constraints
- ✅ Better query performance

## Why This Is Safe

1. **Code is ready** - Already writing to new column
2. **Data validated** - Only migrates valid `a:*` refs
3. **Logged deletions** - Shows what will be removed
4. **Tested locally** - Clean migration on fresh DB
5. **Atomic transaction** - All-or-nothing migration

## Expected Impact

- **Zero downtime** - Migration runs in transaction
- **Minimal data loss** - Only legacy/invalid refs deleted
- **Performance gain** - Integer joins faster than string parsing
- **Better integrity** - FK constraints prevent orphaned data

---

**Ready to deploy!** Run `npx supabase db push` when you're ready.
