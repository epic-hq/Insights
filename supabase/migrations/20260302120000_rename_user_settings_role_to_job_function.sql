-- Rename ambiguous "role" column to "job_function" on user_settings
-- Aligns with the rest of the codebase (people.job_function, BAML, facets, UI)
-- The old "role" name conflicted with interview_people.role (participant role)

ALTER TABLE public.user_settings RENAME COLUMN role TO job_function;

COMMENT ON COLUMN public.user_settings.job_function IS 'User job function category from onboarding (e.g. product, sales, engineering). Distinct from title (specific job title).';
