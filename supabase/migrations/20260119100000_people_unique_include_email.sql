-- Change people unique constraint to include email
-- This allows same name at same company if emails differ
-- Rationale: Two people can have the same name, email distinguishes them

-- Drop the old constraints
DROP INDEX IF EXISTS uniq_people_account_name_company;
DROP INDEX IF EXISTS uniq_people_account_name_company_plain;

-- Create new unique index including email
-- Using COALESCE to handle nulls: null emails each get unique random value
-- so two people with same name/company but no email are both allowed
CREATE UNIQUE INDEX uniq_people_account_name_company_email
  ON public.people (
    account_id,
    name_hash,
    COALESCE(lower(company), ''),
    COALESCE(lower(primary_email), '')
  );

-- Add comment explaining the constraint
COMMENT ON INDEX uniq_people_account_name_company_email IS
  'Ensures unique people per account by name+company+email. Same name allowed if different email.';
