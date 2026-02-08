/**
 * Imperative SQL Statements
 *
 * These statements are NOT handled by `supabase db diff` and must be run manually.
 * Run after migrations: psql $DATABASE_URL -f supabase/snippets/imperative.sql
 *
 * @see docs/30-howtos/supabase-howto.md
 */

-- ============================================================
-- BILLING SCHEMA GRANTS (04_billing_usage.sql)
-- ============================================================

-- Schema access
GRANT USAGE ON SCHEMA billing TO authenticated, service_role;

-- Usage events table
GRANT SELECT, INSERT ON billing.usage_events TO service_role;
GRANT SELECT ON billing.usage_events TO authenticated;

-- Credit ledger table
GRANT SELECT, INSERT ON billing.credit_ledger TO service_role;
GRANT SELECT ON billing.credit_ledger TO authenticated;

-- Feature entitlements table
GRANT SELECT, INSERT, UPDATE ON billing.feature_entitlements TO service_role;
GRANT SELECT ON billing.feature_entitlements TO authenticated;

-- Billing functions
GRANT EXECUTE ON FUNCTION billing.get_credit_balance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION billing.spend_credits_atomic(UUID, INTEGER, INTEGER, INTEGER, TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION billing.grant_credits(UUID, INTEGER, billing.credit_source, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION billing.get_active_entitlement(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION billing.increment_voice_minutes(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION billing.get_monthly_usage_summary(UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- ============================================================
-- ACCOUNTS BILLING GRANTS (03_accounts-billing.sql)
-- ============================================================

-- These may already exist, but including for completeness
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.billing_customers TO service_role;
GRANT SELECT ON TABLE accounts.billing_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.billing_subscriptions TO service_role;
GRANT SELECT ON TABLE accounts.billing_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_role_upsert_customer_subscription(uuid, jsonb, jsonb) TO service_role;
