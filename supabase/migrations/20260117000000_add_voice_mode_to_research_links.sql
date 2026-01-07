-- Add voice mode support to research_links
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS allow_voice boolean NOT NULL DEFAULT false;

-- Update default_response_mode check constraint to include 'voice'
ALTER TABLE public.research_links
DROP CONSTRAINT IF EXISTS research_links_default_response_mode_check;

ALTER TABLE public.research_links
ADD CONSTRAINT research_links_default_response_mode_check
CHECK (default_response_mode IN ('form', 'chat', 'voice'));

-- Update response_mode check constraint in responses table to include 'voice'
ALTER TABLE public.research_link_responses
DROP CONSTRAINT IF EXISTS research_link_responses_response_mode_check;

ALTER TABLE public.research_link_responses
ADD CONSTRAINT research_link_responses_response_mode_check
CHECK (response_mode IN ('form', 'chat', 'voice'));
