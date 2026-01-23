-- Add function to get recent login activity with feature usage for admin dashboard

/**
 * Get the most recent logins with their feature usage
 * Returns last N users by login time, with their last M features used
 */
CREATE OR REPLACE FUNCTION public.get_admin_recent_login_activity(
    p_user_limit INTEGER DEFAULT 5,
    p_feature_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    last_sign_in_at TIMESTAMPTZ,
    recent_features JSONB
) AS $$
BEGIN
    -- Check if caller is platform admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: Platform admin required';
    END IF;

    RETURN QUERY
    WITH recent_users AS (
        -- Get the last N users by sign-in time (excluding null sign-ins)
        SELECT
            au.id AS uid,
            au.email,
            COALESCE(au.raw_user_meta_data->>'full_name', au.email) AS name,
            au.last_sign_in_at
        FROM auth.users au
        WHERE au.last_sign_in_at IS NOT NULL
        ORDER BY au.last_sign_in_at DESC
        LIMIT p_user_limit
    ),
    user_features AS (
        -- For each recent user, get their last M usage events
        SELECT
            ru.uid,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'feature', ue.feature_source,
                        'model', ue.model,
                        'tokens', ue.total_tokens,
                        'credits', ue.credits_charged,
                        'created_at', ue.created_at
                    ) ORDER BY ue.created_at DESC
                ) FILTER (WHERE ue.id IS NOT NULL),
                '[]'::jsonb
            ) AS features
        FROM recent_users ru
        LEFT JOIN LATERAL (
            SELECT ue2.*
            FROM billing.usage_events ue2
            WHERE ue2.user_id = ru.uid
            ORDER BY ue2.created_at DESC
            LIMIT p_feature_limit
        ) ue ON true
        GROUP BY ru.uid
    )
    SELECT
        ru.uid AS user_id,
        ru.email AS user_email,
        ru.name AS user_name,
        ru.last_sign_in_at,
        uf.features AS recent_features
    FROM recent_users ru
    JOIN user_features uf ON uf.uid = ru.uid
    ORDER BY ru.last_sign_in_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_recent_login_activity(INTEGER, INTEGER) TO authenticated;
