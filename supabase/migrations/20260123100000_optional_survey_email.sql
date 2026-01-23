-- Add email_required column to research_links (default true for backwards compatibility)
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS email_required boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.research_links.email_required IS 'When false, respondents can submit anonymous responses without providing an email';

-- Make email nullable in research_link_responses for anonymous submissions
ALTER TABLE public.research_link_responses
ALTER COLUMN email DROP NOT NULL;

-- Drop the old unique constraint on email (if it exists)
DROP INDEX IF EXISTS research_link_responses_unique_email;

-- Create a new unique constraint that allows multiple null emails
-- (PostgreSQL unique constraints by default allow multiple nulls)
CREATE UNIQUE INDEX IF NOT EXISTS research_link_responses_unique_email
    ON public.research_link_responses (research_link_id, lower(email))
    WHERE email IS NOT NULL;
