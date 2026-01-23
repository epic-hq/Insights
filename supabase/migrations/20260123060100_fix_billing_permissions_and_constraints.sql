-- Grant all billing table permissions to service_role
DO $$
BEGIN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON billing.feature_entitlements TO service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON billing.credit_ledger TO service_role';
    EXECUTE 'GRANT SELECT, INSERT ON billing.usage_events TO service_role';
END $$;
