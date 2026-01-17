-- Admin function to get usage summary across all accounts
-- Only accessible by platform admins via service_role or admin check
CREATE OR REPLACE FUNCTION billing.get_admin_usage_by_account(
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
    -- Check if caller is platform admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: Platform admin required';
    END IF;

    RETURN QUERY
    SELECT
        u.account_id,
        a.name AS account_name,
        COUNT(*) AS event_count,
        SUM(u.total_tokens)::BIGINT AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd,
        SUM(u.credits_charged)::INTEGER AS total_credits
    FROM billing.usage_events u
    JOIN accounts.accounts a ON a.id = u.account_id
    WHERE u.created_at >= p_start_date
        AND u.created_at < p_end_date
    GROUP BY u.account_id, a.name
    ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to get daily usage trends
CREATE OR REPLACE FUNCTION billing.get_admin_daily_usage(
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
    -- Check if caller is platform admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: Platform admin required';
    END IF;

    RETURN QUERY
    SELECT
        DATE(u.created_at) AS usage_date,
        COUNT(*) AS event_count,
        SUM(u.total_tokens)::BIGINT AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd,
        SUM(u.credits_charged)::INTEGER AS total_credits,
        COUNT(DISTINCT u.account_id) AS unique_accounts
    FROM billing.usage_events u
    WHERE u.created_at >= p_start_date
        AND u.created_at < p_end_date
    GROUP BY DATE(u.created_at)
    ORDER BY usage_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to get usage breakdown by feature
CREATE OR REPLACE FUNCTION billing.get_admin_usage_by_feature(
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
    -- Check if caller is platform admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: Platform admin required';
    END IF;

    RETURN QUERY
    SELECT
        u.feature_source,
        COUNT(*) AS event_count,
        SUM(u.total_tokens)::BIGINT AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd,
        SUM(u.credits_charged)::INTEGER AS total_credits
    FROM billing.usage_events u
    WHERE u.created_at >= p_start_date
        AND u.created_at < p_end_date
    GROUP BY u.feature_source
    ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION billing.get_admin_usage_by_account(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.get_admin_daily_usage(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.get_admin_usage_by_feature(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
