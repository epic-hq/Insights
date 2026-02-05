-- Billing Schema - Part 3: Tables

-- Usage Events Table
CREATE TABLE billing.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    estimated_cost_usd DECIMAL(10,6) NOT NULL,
    credits_charged INTEGER NOT NULL,
    feature_source TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_account_created_idx ON billing.usage_events(account_id, created_at DESC);
CREATE INDEX usage_events_account_feature_idx ON billing.usage_events(account_id, feature_source, created_at DESC);
CREATE INDEX usage_events_project_idx ON billing.usage_events(project_id, created_at DESC) WHERE project_id IS NOT NULL;

ALTER TABLE billing.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view usage events"
    ON billing.usage_events FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- Credit Ledger Table
CREATE TABLE billing.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    event_type billing.credit_event_type NOT NULL,
    amount INTEGER NOT NULL,
    source billing.credit_source,
    idempotency_key TEXT,
    usage_event_id UUID REFERENCES billing.usage_events(id) ON DELETE SET NULL,
    feature_source TEXT,
    expires_at TIMESTAMPTZ,
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX credit_ledger_idempotency_idx ON billing.credit_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX credit_ledger_account_created_idx ON billing.credit_ledger(account_id, created_at DESC);
CREATE INDEX credit_ledger_account_expires_idx ON billing.credit_ledger(account_id, expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE billing.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view credit ledger"
    ON billing.credit_ledger FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- Feature Entitlements Table
CREATE TABLE billing.feature_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    source billing.entitlement_source NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,
    quantity_limit INTEGER,
    quantity_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(account_id, feature_key, valid_from)
);

CREATE INDEX entitlements_active_idx ON billing.feature_entitlements(account_id, feature_key) WHERE enabled = true;

ALTER TABLE billing.feature_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view entitlements"
    ON billing.feature_entitlements FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));
