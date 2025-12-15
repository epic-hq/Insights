-- Interview Public Sharing
-- Adds columns to support shareable public links with configurable expiration

-- Add sharing columns to interviews table
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ;

-- Index for fast token lookups on public share route
CREATE INDEX IF NOT EXISTS idx_interviews_share_token
ON public.interviews(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN public.interviews.share_token IS 'URL-safe unique token for public sharing (nanoid format)';
COMMENT ON COLUMN public.interviews.share_enabled IS 'Whether public sharing is currently enabled for this interview';
COMMENT ON COLUMN public.interviews.share_expires_at IS 'When the share link expires (NULL = never expires)';
COMMENT ON COLUMN public.interviews.share_created_at IS 'When sharing was first enabled for this interview';
