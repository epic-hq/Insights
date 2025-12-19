-- Remove auto-private lens visibility trigger
-- Per "analyze everything by default" philosophy, all content types should
-- default to 'account' visibility (enabling lens processing)
-- Users can manually set to 'private' to exclude specific content

-- Drop the trigger
DROP TRIGGER IF EXISTS interview_lens_visibility_trigger ON public.interviews;

-- Drop the function (no longer needed)
DROP FUNCTION IF EXISTS set_default_lens_visibility();

-- Update column comment
COMMENT ON COLUMN public.interviews.lens_visibility IS 'Controls lens application: private = excluded from lenses, account = lenses applied (default)';
