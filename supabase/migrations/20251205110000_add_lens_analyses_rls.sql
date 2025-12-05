-- Add missing RLS policies for conversation_lens_analyses
-- The policies were dropped in an earlier migration but not re-added
-- This allows authenticated users to manage their own account's analyses

-- ─────────────────────────────────────────────────────────────────────
-- RLS Policies for conversation_lens_analyses
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Account members can read lens analyses" ON public.conversation_lens_analyses;
DROP POLICY IF EXISTS "Account members can insert lens analyses" ON public.conversation_lens_analyses;
DROP POLICY IF EXISTS "Account members can update lens analyses" ON public.conversation_lens_analyses;
DROP POLICY IF EXISTS "Account members can delete lens analyses" ON public.conversation_lens_analyses;

-- SELECT: Users can read analyses for accounts they belong to
CREATE POLICY "Account members can read lens analyses"
  ON public.conversation_lens_analyses
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- INSERT: Users can create analyses for accounts they belong to
CREATE POLICY "Account members can insert lens analyses"
  ON public.conversation_lens_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

-- UPDATE: Users can update analyses for accounts they belong to
CREATE POLICY "Account members can update lens analyses"
  ON public.conversation_lens_analyses
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- DELETE: Users can delete analyses for accounts they belong to (owner only)
CREATE POLICY "Account members can delete lens analyses"
  ON public.conversation_lens_analyses
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
