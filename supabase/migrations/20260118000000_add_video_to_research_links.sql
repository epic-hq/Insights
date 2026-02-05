-- Add video response support to research_links
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS allow_video boolean NOT NULL DEFAULT false;

-- Add video_url to responses
ALTER TABLE public.research_link_responses
ADD COLUMN IF NOT EXISTS video_url text;
