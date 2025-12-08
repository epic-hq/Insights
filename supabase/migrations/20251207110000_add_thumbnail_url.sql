-- Add thumbnail_url column to interviews table
-- Stores URL to video thumbnail image for preview display

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS thumbnail_url text;

COMMENT ON COLUMN public.interviews.thumbnail_url IS 'URL to video thumbnail image generated from first frame of media';
