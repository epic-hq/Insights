-- Create wrapper functions in public schema to call billing admin functions
-- This allows them to be accessed via the standard Supabase client

-- Wrapper for get_admin_usage_by_account
CREATE OR REPLACE FUNCTION public.get_admin_usage_by_account(
    p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
    account_id UUID,
    account_name TEXT,
    event_count BIGINT,
    total_tokens BIGINT,
    total_cost_usd DECIMAL,
    total_credits INTEGER
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM billing.get_admin_usage_by_account(p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper for get_admin_daily_usage
CREATE OR REPLACE FUNCTION public.get_admin_daily_usage(
    p_start_date TIMESTAMPTZ DEFAULT now() - interval '30 days',
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
    usage_date DATE,
    event_count BIGINT,
    total_tokens BIGINT,
    total_cost_usd DECIMAL,
    total_credits INTEGER,
    unique_accounts BIGINT
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM billing.get_admin_daily_usage(p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper for get_admin_usage_by_feature
CREATE OR REPLACE FUNCTION public.get_admin_usage_by_feature(
    p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
    feature_source TEXT,
    event_count BIGINT,
    total_tokens BIGINT,
    total_cost_usd DECIMAL,
    total_credits INTEGER
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM billing.get_admin_usage_by_feature(p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper for monthly usage summary (used by billing page)
CREATE OR REPLACE FUNCTION public.get_monthly_usage_summary(
    p_account_id UUID
)
RETURNS TABLE(
    feature_source TEXT,
    event_count BIGINT,
    total_tokens BIGINT,
    total_cost_usd DECIMAL,
    total_credits INTEGER
) AS $$
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
        AND u.created_at >= date_trunc('month', now())
    GROUP BY u.feature_source
    ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_usage_by_account(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_daily_usage(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_usage_by_feature(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_usage_summary(UUID) TO authenticated;
