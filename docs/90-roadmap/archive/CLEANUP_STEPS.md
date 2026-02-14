# Facets Schema Cleanup - Ready to Execute

## ✅ What I've Done

1. **Restored the modified migration** - `20251023082644_evidence_Facets.sql` is back to its original state
2. **Deleted the manual migration** - `20251024120000_simplify_facets.sql` has been removed
3. **Updated declarative schemas** - Both `12_core_tables.sql` and `32_evidence.sql` now reflect the desired final state

## Current Clean State

```bash
$ git status supabase/
Changes not staged for commit:
  modified:   supabase/schemas/12_core_tables.sql
  modified:   supabase/schemas/32_evidence.sql
  modified:   supabase/types.ts
```

**Perfect!** Only declarative schema files are modified, no migration files.

## Next Steps

### Option 1: Generate Migration (Recommended if you have local Supabase running)

```bash
# Make sure Supabase is running
supabase start

# Generate the migration from declarative schemas
supabase db diff -f simplify_facets

# Review the generated migration
cat supabase/migrations/*_simplify_facets.sql

# Test it
supabase db reset
```

### Option 2: Manual Migration (If `db diff` fails)

If `supabase db diff` continues to fail with connection errors, you can create the migration manually based on the declarative schema changes:

```bash
# Create the migration file
cat > supabase/migrations/20251024120000_simplify_facets.sql << 'EOF'
-- Add activation flag to facet_account
alter table if not exists public.facet_account
  add column if not exists is_active boolean not null default true;

-- Drop legacy tables
drop table if exists public.project_facet cascade;
drop table if exists public.facet_candidate cascade;

-- Update person_facet table
alter table if exists public.person_facet
  add column if not exists facet_account_id integer;

-- Migrate existing data from facet_ref to facet_account_id
update public.person_facet
set facet_account_id = split_part(facet_ref, ':', 2)::integer
where facet_account_id is null
  and facet_ref like 'a:%';

-- Drop old constraints and columns
alter table if exists public.person_facet
  drop constraint if exists person_facet_ref_pattern;

alter table if exists public.person_facet
  drop constraint if exists person_facet_pkey;

alter table if exists public.person_facet
  drop column if exists candidate_id;

alter table if exists public.person_facet
  drop column if exists facet_ref;

-- Set not null and add foreign key
alter table if exists public.person_facet
  alter column facet_account_id set not null;

alter table if exists public.person_facet
  add constraint person_facet_facet_account_id_fkey
    foreign key (facet_account_id) references public.facet_account(id) on delete cascade;

-- Add new primary key
alter table if exists public.person_facet
  add primary key (person_id, facet_account_id);

-- Add index
create index if not exists idx_person_facet_facet_account
  on public.person_facet(facet_account_id);

-- Update evidence_facet table
alter table if exists public.evidence_facet
  add column if not exists facet_account_id integer;

-- Migrate existing data
update public.evidence_facet
set facet_account_id = split_part(facet_ref, ':', 2)::integer
where facet_account_id is null
  and facet_ref like 'a:%';

-- Drop old constraints and columns
alter table if exists public.evidence_facet
  drop constraint if exists evidence_facet_ref_pattern;

alter table if exists public.evidence_facet
  drop column if exists facet_ref;

-- Set not null and add foreign key
alter table if exists public.evidence_facet
  alter column facet_account_id set not null;

alter table if exists public.evidence_facet
  add constraint evidence_facet_facet_account_id_fkey
    foreign key (facet_account_id) references public.facet_account(id) on delete cascade;

-- Add index
create index if not exists idx_evidence_facet_facet_account_id
  on public.evidence_facet(facet_account_id);
EOF

# Test the migration
supabase db reset
```

## What Changed in Declarative Schemas

### `12_core_tables.sql`:
- ✅ Added `is_active` column to `facet_account`
- ✅ Removed `project_facet` table (entire definition)
- ✅ Removed `facet_candidate` table (entire definition)
- ✅ Updated `person_facet`:
  - Changed `facet_ref text` → `facet_account_id int not null`
  - Removed `candidate_id` column
  - Removed `facet_ref_pattern` constraint
  - Changed PK from `(person_id, facet_ref)` → `(person_id, facet_account_id)`
  - Added FK to `facet_account(id)`
  - Added index on `facet_account_id`

### `32_evidence.sql`:
- ✅ Updated `evidence_facet`:
  - Changed `facet_ref text` → `facet_account_id integer not null`
  - Removed `evidence_facet_ref_pattern` constraint
  - Added FK to `facet_account(id) on delete cascade`
  - Added index on `facet_account_id`

## Verification

After running the migration:

```bash
# Check the schema
supabase db diff --schema

# Should show no differences if everything is in sync
```

## Summary

You're now in a **clean declarative state**. The schema files represent your desired state, and you just need to generate/apply the migration to make the database match.

Choose Option 1 if `supabase start` works, otherwise use Option 2 to create the migration manually.
