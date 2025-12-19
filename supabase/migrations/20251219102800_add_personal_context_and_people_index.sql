-- Add 'personal' value to interaction_context enum
-- PostgreSQL requires ALTER TYPE to add new enum values
ALTER TYPE interaction_context ADD VALUE IF NOT EXISTS 'personal';

-- Ensure the people unique index exists (fixes migration parsing issue)
-- This index is required for ON CONFLICT (account_id, name_hash, company) upserts
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_account_name_company_plain
  ON public.people (account_id, name_hash, company);
