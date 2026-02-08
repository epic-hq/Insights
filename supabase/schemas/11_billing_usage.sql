/**
 * -------------------------------------------------------
 * Billing Usage & Credits Schema
 * -------------------------------------------------------
 *
 * This schema implements the hybrid billing model:
 * - Usage events track all LLM/AI calls with token counts and costs
 * - Credit ledger provides internal accounting (never shown to users)
 * - Feature entitlements gate premium features with temporal support
 *
 * @see docs/20-features-prds/specs/billing-credits-entitlements.md
 */

-- Create billing schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS billing;

-- Grant schema access: run manually via supabase/snippets/imperative.sql

/**
 * -------------------------------------------------------
 * Section - Enums
 * -------------------------------------------------------
 */

-- Credit ledger event types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_event_type' AND typnamespace = 'billing'::regnamespace) THEN
        CREATE TYPE billing.credit_event_type AS ENUM (
            'grant',      -- Monthly plan credits, promo bonuses, manual credits
            'purchase',   -- Add-on purchases
            'spend',      -- Usage consumption
            'expire',     -- Expired credits
            'refund'      -- Reversals for failed operations
        );
    END IF;
END $$;

-- Credit source types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_source' AND typnamespace = 'billing'::regnamespace) THEN
        CREATE TYPE billing.credit_source AS ENUM (
            'plan',       -- Monthly plan allocation
            'purchase',   -- Purchased add-on
            'promo',      -- Promotional grant
            'manual'      -- Manual admin adjustment
        );
    END IF;
END $$;

-- Entitlement source types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entitlement_source' AND typnamespace = 'billing'::regnamespace) THEN
        CREATE TYPE billing.entitlement_source AS ENUM (
            'plan',       -- Derived from subscription plan
            'addon',      -- Purchased add-on
            'promo',      -- Promotional access
            'override'    -- Manual admin override
        );
    END IF;
END $$;

/**
 * -------------------------------------------------------
 * Section - Usage Events Table
 * -------------------------------------------------------
 * Records every LLM/AI call with token counts and costs.
 * Used for cost tracking, margin analysis, and credit spending.
 */

CREATE TABLE IF NOT EXISTS billing.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- LLM call details
    provider TEXT NOT NULL,  -- 'openai', 'anthropic', 'exa'
    model TEXT NOT NULL,     -- 'gpt-4o', 'claude-sonnet-4', etc.
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

    -- Cost tracking (1 credit = $0.01 USD)
    estimated_cost_usd DECIMAL(10,6) NOT NULL,
    credits_charged INTEGER NOT NULL,  -- floor(estimated_cost_usd * 100)

    -- Context
    feature_source TEXT NOT NULL,  -- 'interview_analysis', 'project_status_agent', etc.
    resource_type TEXT,            -- 'interview', 'survey_response', 'chat_message'
    resource_id UUID,

    -- Idempotency (prevents duplicate records on retries)
    idempotency_key TEXT UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS usage_events_account_created_idx
    ON billing.usage_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_account_feature_idx
    ON billing.usage_events(account_id, feature_source, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_project_idx
    ON billing.usage_events(project_id, created_at DESC)
    WHERE project_id IS NOT NULL;

-- Enable RLS
ALTER TABLE billing.usage_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Account members can view usage events"
    ON billing.usage_events FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- GRANT statements: run manually via supabase/snippets/imperative.sql

/**
 * -------------------------------------------------------
 * Section - Credit Ledger Table
 * -------------------------------------------------------
 * Immutable ledger of all credit operations.
 * Balance is always computed from ledger, never stored as mutable number.
 *
 * IMPORTANT: Credits are internal only - never shown to users.
 */

CREATE TABLE IF NOT EXISTS billing.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,

    -- Event details
    event_type billing.credit_event_type NOT NULL,
    amount INTEGER NOT NULL,  -- Positive for grants/purchases/refunds, represents absolute value for spends/expires
    source billing.credit_source,  -- Required for grants

    -- Idempotency (CRITICAL: prevents duplicate operations on webhook/task retries)
    idempotency_key TEXT,

    -- Link to usage event (for spends)
    usage_event_id UUID REFERENCES billing.usage_events(id) ON DELETE SET NULL,
    feature_source TEXT,  -- Denormalized for quick queries

    -- Expiration (for grants)
    expires_at TIMESTAMPTZ,

    -- Billing cycle reference (for plan grants)
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Unique constraint for idempotency (partial index allows NULL)
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency_idx
    ON billing.credit_ledger(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Indexes for balance calculation and queries
CREATE INDEX IF NOT EXISTS credit_ledger_account_created_idx
    ON billing.credit_ledger(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_account_expires_idx
    ON billing.credit_ledger(account_id, expires_at)
    WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE billing.credit_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies (credit data is sensitive, account members can only view)
CREATE POLICY "Account members can view credit ledger"
    ON billing.credit_ledger FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- GRANT statements: run manually via supabase/snippets/imperative.sql

/**
 * -------------------------------------------------------
 * Section - Feature Entitlements Table
 * -------------------------------------------------------
 * Gates premium features with temporal support for promos/trials.
 */

CREATE TABLE IF NOT EXISTS billing.feature_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,  -- 'voice_chat', 'sso', 'team_workspace'
    enabled BOOLEAN NOT NULL DEFAULT true,
    source billing.entitlement_source NOT NULL,

    -- Temporal bounds (for promos, trials, time-limited access)
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,  -- NULL = forever

    -- Quantity limits (for metered features like voice minutes)
    quantity_limit INTEGER,   -- e.g., voice_minutes: 60
    quantity_used INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Allow multiple entitlements per feature (for history/overlapping promos)
    -- but unique per account/feature/valid_from
    UNIQUE(account_id, feature_key, valid_from)
);

-- Index for querying currently active entitlements
CREATE INDEX IF NOT EXISTS entitlements_active_idx
    ON billing.feature_entitlements(account_id, feature_key)
    WHERE enabled = true;

-- Enable RLS
ALTER TABLE billing.feature_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Account members can view entitlements"
    ON billing.feature_entitlements FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- GRANT statements: run manually via supabase/snippets/imperative.sql

/**
 * -------------------------------------------------------
 * Section - Functions
 * -------------------------------------------------------
 */

/**
 * Calculate credit balance for an account
 * Returns: {balance, grants_total, spends_total, expires_soon}
 */
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

/**
 * Atomic credit spend with limit check
 * Prevents race conditions by locking account row during transaction.
 *
 * Returns: success, new_balance, limit_status
 * limit_status: 'ok', 'soft_cap_warning', 'soft_cap_exceeded', 'hard_limit_exceeded'
 */
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
    v_inserted BOOLEAN;
BEGIN
    -- Lock account row to prevent concurrent spends
    PERFORM 1 FROM accounts.accounts WHERE id = p_account_id FOR UPDATE;

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

    -- Insert spend event (idempotent via ON CONFLICT)
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
    ) ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING TRUE INTO v_inserted;

    -- If this was a duplicate, return current state without error
    IF v_inserted IS NULL THEN
        v_status := 'duplicate_ignored';
        RETURN QUERY SELECT TRUE, v_current_balance, v_status;
        RETURN;
    END IF;

    -- Determine status based on soft cap
    IF p_soft_limit > 0 THEN
        IF v_new_balance < -p_soft_limit * 0.2 THEN  -- 120% of limit
            v_status := 'soft_cap_exceeded';
        ELSIF v_new_balance < 0 THEN  -- 100% of limit
            v_status := 'soft_cap_warning';
        ELSIF v_current_balance - p_amount < p_soft_limit * 0.2 THEN  -- 80% threshold
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
        -- Duplicate detected
        RETURN QUERY SELECT TRUE, TRUE, NULL::UUID;
    ELSE
        RETURN QUERY SELECT TRUE, FALSE, v_ledger_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get monthly usage summary for an account
 * Used for billing dashboard display.
 */
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

-- GRANT statements: run manually via supabase/snippets/imperative.sql
