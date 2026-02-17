/**
 * Grant credits with idempotency
 * Used by webhook handlers and admin tools.
 */
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
) AS $fn$
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
        -- Duplicate detected
        RETURN QUERY SELECT TRUE, TRUE, NULL::UUID;
    ELSE
        RETURN QUERY SELECT TRUE, FALSE, v_ledger_id;
    END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
