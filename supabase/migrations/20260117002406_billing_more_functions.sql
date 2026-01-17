-- Billing Schema - Part 6: More Functions

-- Function: Grant credits with idempotency
CREATE OR REPLACE FUNCTION billing.grant_credits(
    p_account_id UUID,
    p_amount INTEGER,
    p_source billing.credit_source,
    p_idempotency_key TEXT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_billing_period_start TIMESTAMPTZ DEFAULT NULL,
    p_billing_period_end TIMESTAMPTZ DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS TABLE(
    success BOOLEAN,
    is_duplicate BOOLEAN,
    ledger_id UUID
) AS $$
DECLARE
    v_ledger_id UUID;
BEGIN
    INSERT INTO billing.credit_ledger (
        account_id,
        event_type,
        amount,
        source,
        idempotency_key,
        expires_at,
        billing_period_start,
        billing_period_end,
        created_by,
        metadata
    ) VALUES (
        p_account_id,
        'grant',
        p_amount,
        p_source,
        p_idempotency_key,
        p_expires_at,
        p_billing_period_start,
        p_billing_period_end,
        p_created_by,
        COALESCE(p_metadata, '{}'::jsonb)
    ) ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;

    IF v_ledger_id IS NULL THEN
        RETURN QUERY SELECT TRUE, TRUE, NULL::UUID;
    ELSE
        RETURN QUERY SELECT TRUE, FALSE, v_ledger_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get active entitlement for a feature
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
) AS $$
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
        CASE e.source
            WHEN 'override' THEN 1
            WHEN 'promo' THEN 2
            WHEN 'addon' THEN 3
            WHEN 'plan' THEN 4
        END,
        e.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Increment voice minutes used
CREATE OR REPLACE FUNCTION billing.increment_voice_minutes(
    p_account_id UUID,
    p_minutes INTEGER
) RETURNS TABLE(
    success BOOLEAN,
    new_quantity_used INTEGER,
    quantity_remaining INTEGER
) AS $$
DECLARE
    v_entitlement_id UUID;
    v_quantity_limit INTEGER;
    v_new_used INTEGER;
BEGIN
    SELECT e.id, e.quantity_limit, e.quantity_used + p_minutes
    INTO v_entitlement_id, v_quantity_limit, v_new_used
    FROM billing.feature_entitlements e
    WHERE e.account_id = p_account_id
        AND e.feature_key = 'voice_chat'
        AND e.enabled = true
        AND e.valid_from <= now()
        AND (e.valid_until IS NULL OR e.valid_until > now())
    ORDER BY e.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_entitlement_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0;
        RETURN;
    END IF;

    UPDATE billing.feature_entitlements
    SET quantity_used = v_new_used
    WHERE id = v_entitlement_id;

    RETURN QUERY SELECT
        TRUE,
        v_new_used,
        GREATEST(0, v_quantity_limit - v_new_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get monthly usage summary
CREATE OR REPLACE FUNCTION billing.get_monthly_usage_summary(
    p_account_id UUID,
    p_month_start TIMESTAMPTZ DEFAULT date_trunc('month', now())
) RETURNS TABLE(
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
        AND u.created_at >= p_month_start
        AND u.created_at < p_month_start + interval '1 month'
    GROUP BY u.feature_source
    ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
