-- Add key_takeaways column to interviews table
-- This stores AI-generated conversation value synopsis in 3-4 sentences

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS key_takeaways text;

COMMENT ON COLUMN public.interviews.key_takeaways IS 'AI-generated synopsis of conversation value, critical next steps, and future improvements (3-4 sentences)';
