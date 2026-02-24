-- Shared Slide Decks
-- Stores deck HTML in the database for editability and future linking to projects/reels.
-- Assets (images, etc.) remain in R2 and are served via the deck asset proxy route.

CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  title TEXT,
  html_content TEXT NOT NULL,
  account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  share_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fast token lookups for the public share route
CREATE INDEX IF NOT EXISTS idx_decks_token ON public.decks(token);

-- RLS: public reads via admin client (like interview sharing), writes scoped to account members
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can manage decks"
  ON public.decks
  FOR ALL
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

COMMENT ON TABLE public.decks IS 'Shared slide decks with editable HTML content';
COMMENT ON COLUMN public.decks.token IS 'URL-safe unique token for public sharing (nanoid format)';
COMMENT ON COLUMN public.decks.html_content IS 'Full HTML content of the deck';
COMMENT ON COLUMN public.decks.share_enabled IS 'Whether the public share link is active';
