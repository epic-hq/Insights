-- Shared Slide Decks

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

CREATE INDEX IF NOT EXISTS idx_decks_token ON public.decks(token);

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can manage decks"
  ON public.decks
  FOR ALL
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));
