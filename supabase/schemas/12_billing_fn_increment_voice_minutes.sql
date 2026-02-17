/**
 * Increment voice minutes used
 * Used by real-time voice tracking.
 */
CREATE OR REPLACE FUNCTION billing.increment_voice_minutes(
    p_account_id UUID,
    p_minutes INTEGER
) RETURNS TABLE(
    success BOOLEAN,
    new_quantity_used INTEGER,
    quantity_remaining INTEGER
) AS $fn$
DECLARE
    v_entitlement_id UUID;
    v_quantity_limit INTEGER;
    v_new_used INTEGER;
BEGIN
    -- Get the active voice_chat entitlement
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

    -- Update quantity used
    UPDATE billing.feature_entitlements
    SET quantity_used = v_new_used
    WHERE id = v_entitlement_id;

    RETURN QUERY SELECT
        TRUE,
        v_new_used,
        GREATEST(0, v_quantity_limit - v_new_used);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
