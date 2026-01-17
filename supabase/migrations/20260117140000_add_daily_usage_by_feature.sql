-- Add function for daily usage breakdown by feature (for stacked bar chart)

CREATE OR REPLACE FUNCTION public.get_admin_daily_usage_by_feature(
    p_start_date TIMESTAMPTZ DEFAULT now() - interval '30 days',
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
    usage_date DATE,
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
        DATE(u.created_at) AS usage_date,
        u.feature_source,
        COUNT(*) AS event_count,
        SUM(u.input_tokens + u.output_tokens)::BIGINT AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd,
        SUM(u.credits_charged)::INTEGER AS total_credits
    FROM billing.usage_events u
    WHERE u.created_at >= p_start_date
        AND u.created_at < p_end_date
    GROUP BY DATE(u.created_at), u.feature_source
    ORDER BY usage_date ASC, total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_daily_usage_by_feature(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
