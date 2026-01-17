-- Billing Schema - Part 4: Functions

-- Function: Get credit balance
CREATE OR REPLACE FUNCTION billing.get_credit_balance(p_account_id UUID)
RETURNS TABLE(
    balance INTEGER,
    grants_total INTEGER,
    spends_total INTEGER,
    expires_in_7_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(
            CASE
                WHEN event_type IN ('grant', 'purchase', 'refund') THEN amount
                WHEN event_type IN ('spend', 'expire') THEN -amount
                ELSE 0
            END
        ), 0)::INTEGER AS balance,
        COALESCE(SUM(CASE WHEN event_type IN ('grant', 'purchase') THEN amount ELSE 0 END), 0)::INTEGER AS grants_total,
        COALESCE(SUM(CASE WHEN event_type = 'spend' THEN amount ELSE 0 END), 0)::INTEGER AS spends_total,
        COALESCE(SUM(
            CASE
                WHEN event_type = 'grant'
                    AND expires_at IS NOT NULL
                    AND expires_at BETWEEN now() AND now() + interval '7 days'
                THEN amount
                ELSE 0
            END
        ), 0)::INTEGER AS expires_in_7_days
    FROM billing.credit_ledger
    WHERE account_id = p_account_id
        AND (expires_at IS NULL OR expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
