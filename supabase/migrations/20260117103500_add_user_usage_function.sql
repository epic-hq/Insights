-- Add function to get usage by user with email for admin dashboard

CREATE OR REPLACE FUNCTION public.get_admin_usage_by_user(
    p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
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
        u.user_id,
        au.email AS user_email,
        COALESCE(au.raw_user_meta_data->>'full_name', au.email) AS user_name,
        COUNT(*) AS event_count,
        SUM(u.input_tokens + u.output_tokens)::BIGINT AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd,
        SUM(u.credits_charged)::INTEGER AS total_credits
    FROM billing.usage_events u
    LEFT JOIN auth.users au ON au.id = u.user_id
    WHERE u.created_at >= p_start_date
        AND u.created_at < p_end_date
        AND u.user_id IS NOT NULL
    GROUP BY u.user_id, au.email, au.raw_user_meta_data->>'full_name'
    ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_usage_by_user(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
