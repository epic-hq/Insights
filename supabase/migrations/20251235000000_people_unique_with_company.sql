-- Fix people unique constraint to include company
-- This allows same name at different companies (John Rubey at Testco vs John Rubey at Saxco)

-- Drop the old constraint (name only)
DROP INDEX IF EXISTS uniq_people_account_namehash;

-- Create new unique index including company (COALESCE handles null companies)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_account_name_company
  ON public.people (account_id, name_hash, COALESCE(lower(company), ''));

-- Add a plain-column unique index to support ON CONFLICT clause
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_account_name_company_plain
  ON public.people (account_id, name_hash, company);

-- Add comment explaining the constraint
COMMENT ON INDEX uniq_people_account_name_company IS
  'Ensures unique people per account by name+company. Same name allowed at different companies.';
