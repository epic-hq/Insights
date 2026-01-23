-- Grant execute on billing functions to service_role
DO $$
BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION billing.grant_credits TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION billing.spend_credits_atomic TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION billing.get_credit_balance TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION billing.get_active_entitlement TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION billing.increment_voice_minutes TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION billing.get_monthly_usage_summary TO service_role';
END $$;
