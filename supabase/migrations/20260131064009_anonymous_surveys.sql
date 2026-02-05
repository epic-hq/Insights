-- Migration: Add support for anonymous survey responses
-- Allows surveys to be configured as anonymous (no email required) or identified (email or phone)

-- Add identity settings to research_links
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS identity_mode text NOT NULL DEFAULT 'identified'
    CHECK (identity_mode IN ('anonymous', 'identified'));

ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS identity_field text NOT NULL DEFAULT 'email'
    CHECK (identity_field IN ('email', 'phone'));

COMMENT ON COLUMN public.research_links.identity_mode IS 'anonymous = no identification required, identified = requires email or phone';
COMMENT ON COLUMN public.research_links.identity_field IS 'When identity_mode is identified, which field to collect: email or phone';

-- Make email nullable for anonymous responses
ALTER TABLE public.research_link_responses
ALTER COLUMN email DROP NOT NULL;

-- Add phone column for phone-identified responses
ALTER TABLE public.research_link_responses
ADD COLUMN IF NOT EXISTS phone text;

-- Add index for phone lookups
CREATE INDEX IF NOT EXISTS research_link_responses_phone_idx
    ON public.research_link_responses (research_link_id, phone)
    WHERE phone IS NOT NULL;

-- Drop the old unique constraint on email (it was NOT NULL before)
DROP INDEX IF EXISTS research_link_responses_unique_email;

-- Create new unique constraint that handles anonymous, email, and phone modes
-- For anonymous responses, we don't enforce uniqueness
-- For email-identified, unique on (research_link_id, lower(email))
-- For phone-identified, unique on (research_link_id, phone)
CREATE UNIQUE INDEX IF NOT EXISTS research_link_responses_unique_email_v2
    ON public.research_link_responses (research_link_id, lower(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_link_responses_unique_phone
    ON public.research_link_responses (research_link_id, phone)
    WHERE phone IS NOT NULL;

-- Update RLS policy to handle anonymous responses
-- Anonymous responses can be read by anyone with the response ID (handled at app level)
DROP POLICY IF EXISTS "Users can read own responses by email" ON public.research_link_responses;

CREATE POLICY "Users can read own responses by email or phone"
    ON public.research_link_responses
    FOR SELECT
    TO authenticated
    USING (
        (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
        OR
        (phone IS NOT NULL AND phone = auth.jwt() ->> 'phone')
    );

-- Update the accounts policy that uses email to also handle phone
DROP POLICY IF EXISTS "Users can read accounts they responded to" ON accounts.accounts;

CREATE POLICY "Users can read accounts they responded to" ON accounts.accounts
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT rl.account_id
            FROM public.research_links rl
            INNER JOIN public.research_link_responses rlr ON rlr.research_link_id = rl.id
            WHERE
                (rlr.email IS NOT NULL AND lower(rlr.email) = lower(auth.jwt() ->> 'email'))
                OR
                (rlr.phone IS NOT NULL AND rlr.phone = auth.jwt() ->> 'phone')
        )
    );

-- Update the research_links policy for authenticated users
DROP POLICY IF EXISTS "Users can read research links they responded to" ON public.research_links;

CREATE POLICY "Users can read research links they responded to"
    ON public.research_links
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT research_link_id
            FROM public.research_link_responses
            WHERE
                (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
                OR
                (phone IS NOT NULL AND phone = auth.jwt() ->> 'phone')
        )
    );
