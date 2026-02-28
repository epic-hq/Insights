-- Add source_url column to interviews for preserving original import URLs
-- This enables retry and debugging when URL imports fail (especially Apollo.io)

ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS source_url text;

COMMENT ON COLUMN public.interviews.source_url IS 'Original URL provided by the user for URL imports. Preserved even when the import fails, enabling retry and debugging.';
