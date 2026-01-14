-- Add instructions field to research_links table
-- This field allows authors to provide detailed guidance separate from the brief subtitle

ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS instructions text;

COMMENT ON COLUMN public.research_links.instructions IS 'Detailed instructions shown before starting the survey';
