# How to Migrate People Segmentation Schema

This guide explains how to apply the people segmentation schema updates following the declarative schema approach.

## What's Changing

### New Fields Added
- `people.job_function` - B2B: Engineering, Product, Sales, etc.
- `people.seniority_level` - B2B: C-Level, VP, Director, Manager, IC
- `people.age_range` - B2C: 18-24, 25-34, 35-44, etc.
- `people.life_stage` - B2C: Student, New Parent, Retiree, etc.
- `projects.target_segments` - JSONB field for ICP hypothesis tracking

### Data Migration
- `people.segment` → migrated to persona facets
- Existing values like "founder", "student" become discoverable personas

### Deprecated (NOT removed yet)
- `people.role` - Use `interview_people.role` for interview role, `people.job_function` for job role
- `people.segment` - Now stored as persona facets
- `people.occupation` - Use `people.job_function` instead

## Prerequisites

1. Make sure you're running Supabase locally:
   ```bash
   supabase status
   ```

2. Make sure you have the latest schema:
   ```bash
   supabase db pull
   ```

## Step 1: Apply Schema Changes

Following the declarative schema approach:

```bash
# 1. The new schema file has been added: supabase/schemas/13_people_segmentation.sql

# 2. Generate a migration from the schema changes
supabase db diff -f migrate_people_segmentation

# 3. Review the generated migration
cat supabase/migrations/[timestamp]_migrate_people_segmentation.sql

# 4. Apply the migration locally
supabase db reset  # This will apply all schema files

# Or apply just this migration:
supabase migration up
```

## Step 2: Migrate Data

After the schema is updated, migrate existing `people.segment` data to facets:

```bash
# Run the data migration script
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  < supabase/migrations/migrate-segments-to-facets.sql
```

## Step 3: Verify Migration

Check that the migration worked:

```sql
-- Count how many people had segments
SELECT COUNT(*) as people_with_segments
FROM people
WHERE segment IS NOT NULL AND segment != '';

-- Count how many persona facets were created
SELECT COUNT(*) as persona_facets
FROM facet_account
WHERE kind_slug = 'persona';

-- See all migrated personas
SELECT
  fa.label as persona,
  COUNT(DISTINCT pf.person_id) as person_count
FROM facet_account fa
LEFT JOIN person_facet pf ON pf.facet_account_id = fa.id
WHERE fa.kind_slug = 'persona'
GROUP BY fa.label
ORDER BY person_count DESC;
```

## Step 4: Update TypeScript Types

Generate new types from the updated schema:

```bash
supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts
```

## Step 5: Update Code

Update any code that references the old fields:

### Before:
```typescript
const segment = person.segment  // ❌ Deprecated
const role = person.role        // ❌ Confusing (interview role vs job role)
const occupation = person.occupation  // ❌ Deprecated
```

### After:
```typescript
// For B2B segmentation
const jobFunction = person.job_function      // ✅ "Engineering", "Product"
const seniorityLevel = person.seniority_level // ✅ "Director", "VP"
const jobTitle = person.title                 // ✅ "VP of Engineering"

// For B2C segmentation
const ageRange = person.age_range    // ✅ "25-34"
const lifeStage = person.life_stage  // ✅ "New Parent"

// For personas (now in facets)
const personaFacets = await supabase
  .from('person_facet')
  .select('facet_account:facet_account(*)')
  .eq('person_id', personId)
  .eq('facet_account.kind_slug', 'persona')
```

## Step 6: Deploy to Production

When ready to deploy:

```bash
# 1. Push migrations to remote
supabase db push

# 2. Run the data migration on production
supabase db execute --file supabase/migrations/migrate-segments-to-facets.sql --remote

# 3. Verify on production
supabase db execute --remote --sql "
  SELECT
    COUNT(DISTINCT segment) as unique_segments,
    COUNT(*) as persona_facets
  FROM facet_account
  WHERE kind_slug = 'persona';
"
```

## Step 7: Clean Up (Optional, Later)

**DO NOT run this immediately!** Wait until you've verified everything works in production for at least a week.

When you're confident the migration worked:

```sql
-- Remove deprecated columns
ALTER TABLE people DROP COLUMN IF EXISTS segment;
ALTER TABLE people DROP COLUMN IF EXISTS role;
ALTER TABLE people DROP COLUMN IF EXISTS occupation;
```

Then generate a new migration:

```bash
supabase db diff -f cleanup_deprecated_people_fields
supabase db push
```

## Troubleshooting

### "Column already exists" error

If you see this error, it means the schema has already been partially applied:

```bash
# Skip to data migration step
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  < supabase/migrations/migrate-segments-to-facets.sql
```

### Missing facet_account entries

If person_facet links fail because facet_account doesn't exist:

```sql
-- Check for orphaned segment values
SELECT DISTINCT p.segment
FROM people p
WHERE p.segment IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM facet_account fa
    WHERE fa.account_id = p.account_id
      AND fa.kind_slug = 'persona'
      AND LOWER(fa.label) = LOWER(p.segment)
  );
```

Then manually create the missing facets and re-run the migration.

## Related Documentation

- [Segments & Targeting Architecture](/docs/architecture/segments-and-targeting.md)
- [Declarative Schema Approach](/docs/@supabase/howto/declarative-schemas.md)
