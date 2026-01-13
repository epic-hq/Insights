-- Remove first_name and last_name columns from research_link_responses
-- These should be stored in the people table instead (normalized)
ALTER TABLE public.research_link_responses
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name;
