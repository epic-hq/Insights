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

-- Functions moved to 11_billing_usage_functions.sql (Supabase schema seeder
-- cannot handle multiple CREATE FUNCTION statements in a single file)

-- GRANT statements: run manually via supabase/snippets/imperative.sql
