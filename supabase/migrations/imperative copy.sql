-- ===================================================================
-- IMPERATIVE MIGRATIONS: Statements not handled by supabase db diff
-- Run this file manually after applying all declarative migrations:
--   psql $DATABASE_URL -f supabase/migrations/imperative.sql
-- ===================================================================

-- ========== Extracted from 01_accounts_setup.sql ==========
GRANT USAGE ON SCHEMA accounts to authenticated;
GRANT USAGE ON SCHEMA accounts to service_role;
GRANT SELECT ON accounts.config TO authenticated, service_role;

-- ========== Extracted from 02_accounts.sql ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.accounts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.account_user TO authenticated, service_role;

-- ========== Extracted from 03_accounts-billing.sql ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.billing_customers TO service_role;
GRANT SELECT ON TABLE accounts.billing_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.billing_subscriptions TO service_role;
GRANT SELECT ON TABLE accounts.billing_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_role_upsert_customer_subscription(uuid, jsonb, jsonb) TO service_role;

-- ========== Extracted from 05_accounts-invitations.sql ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.invitations TO authenticated, service_role;




-- ========== Extracted from 15_rpc_get_user_accounts.sql ==========
GRANT EXECUTE ON FUNCTION public.get_user_accounts() TO authenticated;





-- ========== Extracted from 36_junction_functions.sql ==========
GRANT EXECUTE ON FUNCTION sync_insight_tags(UUID, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_opportunity_insights(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_people_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_link_persona_insights(UUID) TO authenticated;

-- ========== Extracted from 50_queues.sql ==========
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

-- ========== Extracted from 60_persona_distribution_view.sql ==========
GRANT SELECT ON persona_distribution TO authenticated;

-- =============================================================================
-- ANNOTATIONS SYSTEM RLS POLICIES
-- =============================================================================

-- ANNOTATIONS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view annotations in their projects" ON public.annotations;
CREATE POLICY "Users can view annotations in their projects" ON public.annotations
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can create annotations in their projects" ON public.annotations;
CREATE POLICY "Users can create annotations in their projects" ON public.annotations
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
    AND (created_by_user_id = auth.uid() OR created_by_ai = TRUE)
  );

DROP POLICY IF EXISTS "Users can update their own annotations" ON public.annotations;
CREATE POLICY "Users can update their own annotations" ON public.annotations
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete their own annotations" ON public.annotations;
CREATE POLICY "Users can delete their own annotations" ON public.annotations
  FOR DELETE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND created_by_user_id = auth.uid()
  );

-- VOTES TABLE POLICIES
DROP POLICY IF EXISTS "Users can view votes in their projects" ON public.votes;
CREATE POLICY "Users can view votes in their projects" ON public.votes
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can create votes in their projects" ON public.votes;
CREATE POLICY "Users can create votes in their projects" ON public.votes
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own votes" ON public.votes;
CREATE POLICY "Users can update their own votes" ON public.votes
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete their own votes" ON public.votes;
CREATE POLICY "Users can delete their own votes" ON public.votes
  FOR DELETE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND user_id = auth.uid()
  );

-- ENTITY_FLAGS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view flags in their projects" ON public.entity_flags;
CREATE POLICY "Users can view flags in their projects" ON public.entity_flags
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can create flags in their projects" ON public.entity_flags;
CREATE POLICY "Users can create flags in their projects" ON public.entity_flags
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own flags" ON public.entity_flags;
CREATE POLICY "Users can update their own flags" ON public.entity_flags
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete their own flags" ON public.entity_flags;
CREATE POLICY "Users can delete their own flags" ON public.entity_flags
  FOR DELETE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.account_id = (auth.jwt() ->> 'account_id')::uuid
    )
    AND user_id = auth.uid()
  );

-- GRANT PERMISSIONS FOR HELPER FUNCTIONS
GRANT EXECUTE ON FUNCTION public.get_annotation_counts(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_counts(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_vote(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_flags(TEXT, UUID, UUID) TO authenticated;

-- ========== Triggers and Policies (all schemas) ==========
-- NOTE: All CREATE TRIGGER, CREATE POLICY, ALTER POLICY, DROP POLICY, and SECURITY DEFINER/SET SEARCH_PATH statements should be reviewed for manual application as well.
-- For brevity, only GRANT/REVOKE/ENABLE RLS/EXTENSION statements are included here, but you may want to move triggers and policies as well if db diff does not handle them.


grant execute on function public.set_current_account_id(uuid) to authenticated, service_role;
