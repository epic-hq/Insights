/**
 * Get monthly usage summary for an account
 * Used for billing dashboard display.
 */
CREATE OR REPLACE FUNCTION billing.get_monthly_usage_summary(
    p_account_id UUID,
    p_month_start TIMESTAMPTZ DEFAULT date_trunc('month', now())
) RETURNS TABLE(
    feature_source TEXT,
    event_count BIGINT,
    total_tokens BIGINT,
    total_cost_usd DECIMAL,
    total_credits INTEGER
) AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        u.feature_source,
        COUNT(*) AS event_count,
        SUM(u.total_tokens)::BIGINT AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd,
        SUM(u.credits_charged)::INTEGER AS total_credits
    FROM billing.usage_events u
    WHERE u.account_id = p_account_id
        AND u.created_at >= p_month_start
        AND u.created_at < p_month_start + interval '1 month'
    GROUP BY u.feature_source
    ORDER BY total_credits DESC;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- GRANT statements: run manually via supabase/snippets/imperative.sql
