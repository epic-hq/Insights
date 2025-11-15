-- Migration: Add firstname/lastname to people table and migrate existing names
-- This removes the hash suffixes from names and splits them into firstname/lastname

-- Step 1: Add firstname and lastname columns
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS firstname text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS lastname text;

-- Step 2: Migrate existing data - parse current names into firstname/lastname
-- This will strip any hash suffixes (e.g., "John Doe #abc123" -> firstname: "John", lastname: "Doe")
UPDATE public.people
SET
  firstname = CASE
    WHEN position(' ' in regexp_replace(name, ' #[a-f0-9]+$', '', 'i')) > 0
    THEN split_part(regexp_replace(name, ' #[a-f0-9]+$', '', 'i'), ' ', 1)
    ELSE regexp_replace(name, ' #[a-f0-9]+$', '', 'i')
  END,
  lastname = CASE
    WHEN position(' ' in regexp_replace(name, ' #[a-f0-9]+$', '', 'i')) > 0
    THEN substring(regexp_replace(name, ' #[a-f0-9]+$', '', 'i') from position(' ' in regexp_replace(name, ' #[a-f0-9]+$', '', 'i')) + 1)
    ELSE NULL
  END
WHERE name IS NOT NULL;

-- Step 3: Drop the old name and name_hash columns
ALTER TABLE public.people DROP COLUMN IF EXISTS name CASCADE;
ALTER TABLE public.people DROP COLUMN IF EXISTS name_hash CASCADE;

-- Step 4: Recreate name as a generated column
ALTER TABLE public.people ADD COLUMN name text GENERATED ALWAYS AS (
  CASE
    WHEN firstname IS NOT NULL AND lastname IS NOT NULL THEN trim(firstname || ' ' || lastname)
    WHEN firstname IS NOT NULL THEN trim(firstname)
    WHEN lastname IS NOT NULL THEN trim(lastname)
    ELSE NULL
  END
) STORED;

-- Step 5: Recreate name_hash as a generated column
ALTER TABLE public.people ADD COLUMN name_hash text GENERATED ALWAYS AS (
  lower(
    CASE
      WHEN firstname IS NOT NULL AND lastname IS NOT NULL THEN trim(firstname || ' ' || lastname)
      WHEN firstname IS NOT NULL THEN trim(firstname)
      WHEN lastname IS NOT NULL THEN trim(lastname)
      ELSE ''
    END
  )
) STORED;

-- Step 6: Handle duplicates by adding a suffix to lastname for duplicate names within same account
WITH duplicates AS (
  SELECT
    id,
    account_id,
    firstname,
    lastname,
    ROW_NUMBER() OVER (PARTITION BY account_id, firstname, lastname ORDER BY created_at) as rn
  FROM public.people
)
UPDATE public.people p
SET lastname = COALESCE(d.lastname, '') || ' (' || d.rn || ')'
FROM duplicates d
WHERE p.id = d.id
  AND d.rn > 1;

-- Step 7: Recreate the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_account_namehash
  ON public.people (account_id, name_hash);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.people.firstname IS 'Person''s first name';
COMMENT ON COLUMN public.people.lastname IS 'Person''s last name';
COMMENT ON COLUMN public.people.name IS 'Generated full name (firstname + lastname)';
COMMENT ON COLUMN public.people.name_hash IS 'Generated lowercase full name for deduplication';
