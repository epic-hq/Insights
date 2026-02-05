-- Fix spend_credits_atomic function to not use ON CONFLICT
-- ON CONFLICT doesn't work with partial indexes in PostgreSQL

CREATE OR REPLACE FUNCTION billing.spend_credits_atomic(
    p_account_id UUID,
    p_amount INTEGER,
    p_soft_limit INTEGER,
    p_hard_limit INTEGER,
    p_idempotency_key TEXT,
    p_usage_event_id UUID DEFAULT NULL,
    p_feature_source TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER,
    limit_status TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_status TEXT;
    v_existing_id UUID;
    v_ledger_id UUID;
BEGIN
    -- Lock account row to prevent concurrent spends
    PERFORM 1 FROM accounts.accounts WHERE id = p_account_id FOR UPDATE;

    -- Check for duplicate first
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM billing.credit_ledger
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            -- Calculate current balance for response
            SELECT COALESCE(SUM(
                CASE
                    WHEN event_type IN ('grant', 'purchase', 'refund') THEN amount
                    WHEN event_type IN ('spend', 'expire') THEN -amount
                    ELSE 0
                END
            ), 0) INTO v_current_balance
            FROM billing.credit_ledger
            WHERE account_id = p_account_id
                AND (expires_at IS NULL OR expires_at > now());

            RETURN QUERY SELECT TRUE, v_current_balance, 'duplicate_ignored'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Calculate current balance (only non-expired credits)
    SELECT COALESCE(SUM(
        CASE
            WHEN event_type IN ('grant', 'purchase', 'refund') THEN amount
            WHEN event_type IN ('spend', 'expire') THEN -amount
            ELSE 0
        END
    ), 0) INTO v_current_balance
    FROM billing.credit_ledger
    WHERE account_id = p_account_id
        AND (expires_at IS NULL OR expires_at > now());

    v_new_balance := v_current_balance - p_amount;

    -- Check hard limit (only for free tier typically)
    IF p_hard_limit > 0 AND v_new_balance < -p_hard_limit THEN
        v_status := 'hard_limit_exceeded';
        RETURN QUERY SELECT FALSE, v_current_balance, v_status;
        RETURN;
    END IF;

    -- Insert spend event
    INSERT INTO billing.credit_ledger (
        account_id,
        event_type,
        amount,
        idempotency_key,
        usage_event_id,
        feature_source,
        metadata
    ) VALUES (
        p_account_id,
        'spend',
        p_amount,
        p_idempotency_key,
        p_usage_event_id,
        p_feature_source,
        p_metadata
    )
    RETURNING id INTO v_ledger_id;

    -- Determine status based on soft cap
    IF p_soft_limit > 0 THEN
        IF v_new_balance < -p_soft_limit * 0.2 THEN
            v_status := 'soft_cap_exceeded';
        ELSIF v_new_balance < 0 THEN
            v_status := 'soft_cap_warning';
        ELSIF v_current_balance - p_amount < p_soft_limit * 0.2 THEN
            v_status := 'approaching_limit';
        ELSE
            v_status := 'ok';
        END IF;
    ELSE
        v_status := 'ok';
    END IF;

    RETURN QUERY SELECT TRUE, v_new_balance, v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
