/**
 * Get active entitlement for a feature
 * Returns the currently valid entitlement with highest priority.
 */
CREATE OR REPLACE FUNCTION billing.get_active_entitlement(
    p_account_id UUID,
    p_feature_key TEXT
) RETURNS TABLE(
    id UUID,
    enabled BOOLEAN,
    source billing.entitlement_source,
    quantity_limit INTEGER,
    quantity_used INTEGER,
    quantity_remaining INTEGER,
    valid_until TIMESTAMPTZ
) AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.enabled,
        e.source,
        e.quantity_limit,
        e.quantity_used,
        CASE
            WHEN e.quantity_limit IS NOT NULL
            THEN e.quantity_limit - COALESCE(e.quantity_used, 0)
            ELSE NULL
        END AS quantity_remaining,
        e.valid_until
    FROM billing.feature_entitlements e
    WHERE e.account_id = p_account_id
        AND e.feature_key = p_feature_key
        AND e.enabled = true
        AND e.valid_from <= now()
        AND (e.valid_until IS NULL OR e.valid_until > now())
    ORDER BY
        -- Priority: override > promo > addon > plan
        CASE e.source
            WHEN 'override' THEN 1
            WHEN 'promo' THEN 2
            WHEN 'addon' THEN 3
            WHEN 'plan' THEN 4
        END,
        e.created_at DESC
    LIMIT 1;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
