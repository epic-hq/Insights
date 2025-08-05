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

-- ========== Triggers and Policies (all schemas) ==========
-- NOTE: All CREATE TRIGGER, CREATE POLICY, ALTER POLICY, DROP POLICY, and SECURITY DEFINER/SET SEARCH_PATH statements should be reviewed for manual application as well.
-- For brevity, only GRANT/REVOKE/ENABLE RLS/EXTENSION statements are included here, but you may want to move triggers and policies as well if db diff does not handle them.


grant execute on function public.set_current_account_id(uuid) to authenticated, service_role;
