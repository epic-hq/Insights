-- Add walkthrough video URL to research_links
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS walkthrough_video_url text;
