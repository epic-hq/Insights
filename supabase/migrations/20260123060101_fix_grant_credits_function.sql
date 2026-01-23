-- Fix grant_credits function to not use ON CONFLICT
-- ON CONFLICT doesn't work with partial indexes in PostgreSQL

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
    v_existing_id UUID;
BEGIN
    -- Check for existing entry with same idempotency key first
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM billing.credit_ledger
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            -- Duplicate detected
            RETURN QUERY SELECT TRUE, TRUE, v_existing_id;
            RETURN;
        END IF;
    END IF;

    -- Insert new entry
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
    )
    RETURNING id INTO v_ledger_id;

    RETURN QUERY SELECT TRUE, FALSE, v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
