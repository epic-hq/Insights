# Billing, Credits, and Entitlements Spec (v2)

## 0) Spec-First Summary
This spec defines a **hybrid billing model** that combines simple user-facing messaging ("Unlimited AI") with robust internal usage tracking (credits). The system uses Polar.sh (Stripe backend), a unified usage credits ledger for internal accounting, and a feature-entitlement layer that gates premium functionality by tier.

**Key insight:** Users see simple counts and "unlimited" messaging (like Fathom/Grain). Internally, we track everything via credits for cost control and abuse prevention.

**Architecture principles:**
- **Single source of truth:** Plan definitions live in `app/config/plans.ts`, imported everywhere
- **Idempotent operations:** All credit grants/spends use idempotency keys to prevent duplicates
- **Atomic checks:** Credit spend operations use database-level atomic check-and-spend
- **Audit trail:** All ledger events include `created_by` and `metadata` for compliance
- **Temporal entitlements:** Feature access includes `valid_from`/`valid_until` for promos

---

## 1) Goals & Non-Goals
### Goals
- Support **individual and team billing** (seat-based) with Polar + Stripe.
- Provide **simple user-facing limits** (analyses, surveys, voice minutes) instead of exposing credits.
- Track **usage internally via credits** for cost control without burdening users with a new currency.
- Enable **soft caps** on "unlimited" plans to catch abuse while not punishing normal users.
- Add **tier-based entitlements** (feature gating and upgrade prompts).
- Centralize **usage metering** for LLM calls and other costly operations.
- Provide a **modular architecture** so billing, credits, and entitlements are cleanly integrated.
- **Ensure idempotency** for all credit operations (prevent double-grants on webhook retries).
- **Atomic credit checks** to prevent race conditions on parallel requests.
- **Full audit trail** for compliance and debugging.

### Non-Goals (for initial phase)
- No full UI implementation of billing flows.
- No migration of legacy billing data beyond minimal syncing.
- No new payment provider beyond Stripe via Polar.

---

## 2) Core Concepts

### 2.1 The Hybrid Model (Recommended Approach)

We evaluated three approaches:

| Approach | User Sees | Pros | Cons |
|----------|-----------|------|------|
| **A: No Credits** | "5 AI analyses" / "Unlimited" | Dead simple, matches competitors | No cost control, power users could cost $500/mo |
| **B: Credits Only** | "1,500 credits/month" | Full cost control, natural upsell | "Credits" feel less generous, users learn new currency |
| **C: Hybrid** | "Unlimited AI" (soft cap internally) | Best of both: simple messaging + cost control | Slightly more complex to implement |

**Decision: Hybrid approach (Option C)**

- **External messaging:** Simple counts for Free tier, "Unlimited" for paid tiers (Fathom-style)
- **Internal tracking:** Credits system for accounting, soft caps for abuse prevention
- **Exception:** Realtime voice is always metered (too expensive to be "unlimited")

### 2.2 How the Hybrid Works

| Tier | User Sees | Internal Reality |
|------|-----------|------------------|
| Free | "5 AI analyses/month" | 500 credits, ~100 credits/analysis |
| Starter | "Unlimited AI" | 2,000 credits, soft cap at 100% |
| Pro | "Unlimited AI" | 5,000 credits, soft cap at 100% |
| Team | "Unlimited AI" | 4,000 credits/user, pooled |

**Soft cap behavior:**
- Warn at 80% of internal credit limit
- At 100%, show upgrade prompt but don't hard-block (grace period)
- At 120%, throttle or require upgrade

### 2.3 Billing Plans & Tiers

| Tier | Price | AI Analysis | Voice Chat | Surveys |
|------|-------|-------------|------------|---------|
| **Free** | $0 | 5 analyses/mo | — | 50 responses (no AI) |
| **Starter** | $15/user/mo | Unlimited* | 60 min/mo | 500 responses + AI |
| **Pro** | $30/user/mo | Unlimited* | 180 min/mo | 2,000 responses + AI |
| **Team** | $25/user/mo | Unlimited* | 300 min/user/mo | 5,000 responses + AI |

*Fair use policy applies (soft cap ~20-50 analyses/month equivalent)

**Default rule:** All current features are included in the base tier unless explicitly listed as premium.

### 2.4 Single Source of Truth: Plan Configuration

**Critical DRY requirement:** All plan definitions MUST be imported from a single config file.

```typescript
// app/config/plans.ts - THE ONLY PLACE PLANS ARE DEFINED
export const PLAN_IDS = ['free', 'starter', 'pro', 'team'] as const;
export type PlanId = typeof PLAN_IDS[number];

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, annual: 0 },
    // User-facing limits (shown in UI)
    limits: {
      ai_analyses: 5,
      voice_minutes: 0,
      survey_responses: 50,
      projects: 1,
    },
    // Internal credit allocation (hidden from users)
    credits: {
      monthly: 500,
      softCapEnabled: false, // Hard limit for free tier
    },
    // Feature entitlements
    features: {
      survey_ai_analysis: false,
      team_workspace: false,
      sso: false,
    },
  },
  starter: { /* ... */ },
  pro: { /* ... */ },
  team: { /* ... */ },
} as const;
```

**Import this everywhere:**
- `PricingTableV4.jsx` → marketing pricing display
- `billing/pages/index.tsx` → billing dashboard
- `lib/entitlements/` → feature gating logic
- `lib/credits/` → credit allocation logic

### 2.5 Credits (Internal Only)
Credits are **internal accounting only**—never shown to users in the UI.

- **1 credit = $0.01 USD** of actual provider cost
- Credits map to estimated_cost_usd from usage events
- Users see "analyses used" or "voice minutes remaining," not credits

### 2.6 Entitlements
An entitlement is a named feature flag that can be enabled at:
- **Account level** (individual or team)
- **User level** (rare, but useful for internal overrides)

Entitlements are derived from:
- Subscription tier
- Seat count or plan add-ons
- Promotional overrides

---

## 3) Billing System (Polar + Stripe)
### 3.1 Billing Provider
- **Polar.sh** handles checkout, subscriptions, invoices, and discounts.
- **Stripe** is the payment processor behind Polar.

### 3.2 Plan Modeling
In Polar:
- Create a **base product** for each tier (Free, Starter, Pro, Team).
- Create **add-on products** for voice minutes or extra capacity.
- Ensure **seat-based pricing** is supported for Team plans (quantity on subscription).

### 3.3 Billing Webhooks
- Subscribe to Polar webhooks:
  - `customer.created` / `customer.updated`
  - `subscription.created` / `subscription.updated` / `subscription.canceled`
  - `invoice.paid` / `invoice.failed`
- Sync these into local tables (`billing_customers`, `billing_subscriptions`) and trigger credit grants.

---

## 4) Credits Ledger (Internal Usage Accounting)

**Important:** The credits ledger is for internal tracking only. Users never see "credits" in the UI.

### 4.1 Ledger Events
Implement an immutable ledger with event types:
- `grant` (monthly plan credits, promo bonuses, manual credits)
- `purchase` (add-on purchases)
- `spend` (usage consumption)
- `expire` (for expiring plan credits)
- `refund` (reversals for failed operations)

### 4.2 Credit Balance Calculation
- Balance = sum(grants + purchases + refunds − spends − expirations)
- Always compute from ledger, never store as a mutable number.

### 4.3 Idempotency (Critical)

**Problem:** Webhook retries and task retries can cause duplicate credit operations.

**Solution:** Every ledger event requires an `idempotency_key`:

```sql
-- Unique constraint prevents duplicate operations
CREATE UNIQUE INDEX credit_ledger_idempotency_idx
  ON billing.credit_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Idempotency key patterns:**
- Webhook grant: `webhook:{event_id}:{subscription_id}`
- Task spend: `task:{task_run_id}:{step_name}`
- Manual adjustment: `manual:{admin_user_id}:{timestamp}`

```typescript
// Example: Idempotent credit grant
async function grantCredits(params: {
  accountId: string;
  amount: number;
  source: 'plan' | 'purchase' | 'promo' | 'manual';
  idempotencyKey: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}) {
  // Upsert with ON CONFLICT DO NOTHING
  const { data, error } = await supabase
    .from('credit_ledger')
    .upsert({
      account_id: params.accountId,
      event_type: 'grant',
      amount: params.amount,
      source: params.source,
      idempotency_key: params.idempotencyKey,
      expires_at: params.expiresAt,
      metadata: params.metadata,
      created_by: params.createdBy,
    }, {
      onConflict: 'idempotency_key',
      ignoreDuplicates: true,
    });

  return { data, isDuplicate: !data };
}
```

### 4.4 Atomic Credit Spend (Race Condition Prevention)

**Problem:** Parallel requests can pass soft cap check before any spend is recorded.

**Solution:** Database-level atomic check-and-spend function:

```sql
-- Atomic credit spend with limit check
CREATE OR REPLACE FUNCTION billing.spend_credits_atomic(
  p_account_id UUID,
  p_amount INTEGER,
  p_soft_limit INTEGER,
  p_hard_limit INTEGER,
  p_idempotency_key TEXT,
  p_usage_event_id UUID,
  p_feature_source TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  new_balance INTEGER,
  limit_status TEXT -- 'ok', 'soft_cap_warning', 'soft_cap_exceeded', 'hard_limit_exceeded'
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_status TEXT;
BEGIN
  -- Lock account row to prevent concurrent spends
  PERFORM 1 FROM accounts.accounts WHERE id = p_account_id FOR UPDATE;

  -- Calculate current balance (grants - spends - expires + refunds)
  SELECT COALESCE(SUM(
    CASE WHEN event_type IN ('grant', 'purchase', 'refund') THEN amount
         WHEN event_type IN ('spend', 'expire') THEN -amount
         ELSE 0 END
  ), 0) INTO v_current_balance
  FROM billing.credit_ledger
  WHERE account_id = p_account_id
    AND (expires_at IS NULL OR expires_at > NOW());

  v_new_balance := v_current_balance - p_amount;

  -- Check limits
  IF v_new_balance < -p_hard_limit THEN
    v_status := 'hard_limit_exceeded';
    RETURN QUERY SELECT FALSE, v_current_balance, v_status;
    RETURN;
  END IF;

  -- Insert spend event (idempotent)
  INSERT INTO billing.credit_ledger (
    account_id, event_type, amount, idempotency_key,
    usage_event_id, feature_source, metadata
  ) VALUES (
    p_account_id, 'spend', p_amount, p_idempotency_key,
    p_usage_event_id, p_feature_source, p_metadata
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  -- Determine status
  IF v_new_balance < 0 THEN
    v_status := 'soft_cap_exceeded';
  ELSIF v_current_balance - p_amount < p_soft_limit * 0.8 THEN
    v_status := 'soft_cap_warning';
  ELSE
    v_status := 'ok';
  END IF;

  RETURN QUERY SELECT TRUE, v_new_balance, v_status;
END;
$$ LANGUAGE plpgsql;
```

### 4.5 Plan Credit Grants
- On subscription renewal (invoice paid), grant monthly credits.
- If subscription is canceled, do not grant credits for that cycle.
- **Billing cycle:** Use `current_period_start` and `current_period_end` from `billing_subscriptions` table (synced from Polar/Stripe).
- **Expiration:** all credits expire. Plan-included credits expire at the end of each billing cycle; purchased add-on credits expire 12 months after grant; promo credits default to 90 days (override per campaign).

### 4.6 Refunds and Reversals

**Policy for failed operations:**
- **Full refund:** If task fails before producing any user-visible output
- **No refund:** If task produced partial results visible to user
- **Manual review:** Edge cases flagged for admin decision

```typescript
// Refund on task failure
async function refundCreditsOnFailure(params: {
  accountId: string;
  originalSpendId: string;
  amount: number;
  reason: string;
}) {
  await supabase.from('credit_ledger').insert({
    account_id: params.accountId,
    event_type: 'refund',
    amount: params.amount,
    idempotency_key: `refund:${params.originalSpendId}`,
    metadata: {
      original_spend_id: params.originalSpendId,
      reason: params.reason,
    },
  });
}
```

### 4.7 Internal Credit Allocations

| Tier | Internal Credits/Month | Soft Cap Threshold |
|------|------------------------|-------------------|
| Free | 500 | Hard limit (5 analyses) |
| Starter | 2,000 | 80% warn, 100% prompt, 120% throttle |
| Pro | 5,000 | 80% warn, 100% prompt, 120% throttle |
| Team | 4,000/user (pooled) | 80% warn, 100% prompt, 120% throttle |

### 4.8 Team Pooled Credits (Clarified)

**Definition:** Team credits are **truly pooled** across all team members.

```typescript
// Team of 5 users on Team plan
const teamCredits = seatCount * 4000; // 5 * 4000 = 20,000 credits shared

// Any team member can use from the pool
// No per-user allocation within team
```

**Guardrails:**
- Track `user_id` on each spend for visibility into individual usage
- Alert if single user consumes >50% of team pool (potential abuse)
- No automatic per-user throttling (team admins manage internally)

### 4.9 Audit Trail

All ledger events include:
- `created_by`: UUID of user/system that initiated the action
- `metadata`: JSONB for context (reason, approval, source event, etc.)

```sql
-- Required for compliance and debugging
ALTER TABLE billing.credit_ledger ADD COLUMN
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}';
```

---

## 5) Usage Metering

### 5.1 Usage Events
Create a `usage_events` table to record metering events for each LLM call:
- `id` (UUID, primary key)
- `account_id`, `project_id`, `user_id`
- `provider`, `model`
- `input_tokens`, `output_tokens`, `total_tokens`
- `estimated_cost_usd` (decimal)
- `credits_charged` (integer, derived from cost)
- `feature_source` (e.g., interview_analysis, project_status_agent, survey_analysis)
- `resource_type`, `resource_id` (what was being processed)
- `idempotency_key` (for linking to credit ledger)
- `created_at`

```sql
-- Full schema in supabase/schemas/04_billing_usage.sql
CREATE TABLE billing.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts(id),
  project_id UUID REFERENCES public.projects(id),
  user_id UUID REFERENCES auth.users(id),

  -- LLM call details
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost tracking
  estimated_cost_usd DECIMAL(10,6) NOT NULL,
  credits_charged INTEGER NOT NULL, -- floor(estimated_cost_usd * 100)

  -- Context
  feature_source TEXT NOT NULL,
  resource_type TEXT, -- 'interview', 'survey_response', 'chat_message'
  resource_id UUID,

  -- Idempotency
  idempotency_key TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for account usage queries
CREATE INDEX usage_events_account_created_idx
  ON billing.usage_events(account_id, created_at DESC);
```

### 5.2 Usage to Credits
**Decision:** Use a **cost-based bridge** so tokenization differences don't matter.
- **1 credit = $0.01 USD of usage cost**, calculated per provider's reported cost.
- Store both **token metrics** and **estimated_cost_usd** for analysis and internal auditing.

If a provider does not return cost, compute it from tokens and model pricing.

### 5.3 Margin Target
- Pricing and credit grants should target **~70% gross margin on token/LLM usage** across providers.
- Maintain a provider cost table and periodically recalibrate credit bundles to preserve margin as model prices change.

### 5.4 Critical Paths to Meter
- Interview processing pipeline (Trigger.dev)
- Project status agent & onboarding agents
- Survey response analysis
- Semantic search embeddings
- Media extraction LLM usage
- **Realtime voice chat** (always metered, always shown to user)

### 5.5 Feature-to-Credit Estimates

| Feature | Typical Credits | User Sees |
|---------|-----------------|-----------|
| Interview analysis (30 min) | ~100-200 | "1 analysis" |
| Survey response analysis | ~5-10 | Included in response count |
| Project chat message | ~2-5 | Unlimited (within soft cap) |
| Realtime voice (per minute) | ~1-2 | "X minutes remaining" |

### 5.6 Integration Pattern: Trigger.dev Tasks

**Every LLM call in Trigger.dev tasks must record usage and spend credits.**

```typescript
// src/trigger/interview/v2/extractEvidenceCore.ts
import { recordUsageAndSpendCredits } from "~/lib/billing/usage";

export const extractEvidenceCore = schemaTask({
  id: "extract-evidence-core",
  // ...
  run: async (payload, { ctx }) => {
    const { projectId, interviewId, accountId } = payload;

    // Get BAML collector for token tracking
    const collector = createBamlCollector();

    try {
      // Execute LLM call
      const result = await b.ExtractEvidence(transcript, { collector });

      // Record usage and spend credits (atomic)
      const usageResult = await recordUsageAndSpendCredits({
        accountId,
        projectId,
        userId: null, // System task
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        inputTokens: collector.inputTokens,
        outputTokens: collector.outputTokens,
        estimatedCostUsd: collector.estimatedCost,
        featureSource: 'interview_analysis',
        resourceType: 'interview',
        resourceId: interviewId,
        idempotencyKey: `task:${ctx.run.id}:extract-evidence`,
      });

      if (usageResult.limitStatus === 'hard_limit_exceeded') {
        throw new Error('Account has exceeded usage limits');
      }

      return result;
    } catch (error) {
      // Refund on failure if credits were spent
      // (handled by recordUsageAndSpendCredits internally)
      throw error;
    }
  },
});
```

### 5.7 Integration Pattern: Mastra Agents

```typescript
// app/mastra/agents/project-status-agent.ts
import { recordUsageAndSpendCredits } from "~/lib/billing/usage";

// After each agent turn that uses LLM
async function onAgentResponse(params: {
  accountId: string;
  projectId: string;
  userId: string;
  usage: { inputTokens: number; outputTokens: number; cost: number };
  turnId: string;
}) {
  await recordUsageAndSpendCredits({
    accountId: params.accountId,
    projectId: params.projectId,
    userId: params.userId,
    provider: 'openai',
    model: 'gpt-4o',
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    estimatedCostUsd: params.usage.cost,
    featureSource: 'project_status_agent',
    resourceType: 'chat_message',
    resourceId: null,
    idempotencyKey: `agent:${params.turnId}`,
  });
}
```

---

## 6) Entitlements & Feature Gating

### 6.1 User-Facing Limits (Shown in UI)

```typescript
// Free tier - shown to user
const FREE_TIER_LIMITS = {
  ai_analyses: 5,              // "5 AI analyses/month"
  survey_responses: 50,        // "50 survey responses"
  realtime_voice_minutes: 0,   // "Upgrade to unlock"
};

// Paid tiers - shown to user
const STARTER_LIMITS = {
  ai_analyses: Infinity,       // "Unlimited"
  survey_responses: 500,       // "500 survey responses"
  realtime_voice_minutes: 60,  // "60 minutes/month"
};

const PRO_LIMITS = {
  ai_analyses: Infinity,       // "Unlimited"
  survey_responses: 2000,      // "2,000 survey responses"
  realtime_voice_minutes: 180, // "180 minutes/month"
};
```

### 6.2 Internal Credit Tracking (Hidden from User)

```typescript
// Internal tracking - never shown to user
const FREE_TIER_CREDITS = 500;
const STARTER_CREDITS = 2000;
const PRO_CREDITS = 5000;

// Check internal limits
async function checkUsageLimit(accountId: string, feature: string) {
  const plan = await getPlan(accountId);

  // Free tier: hard limits
  if (plan === 'free') {
    const count = await getMonthlyFeatureCount(accountId, feature);
    if (count >= FREE_TIER_LIMITS[feature]) {
      throw new UpgradeRequiredError(feature);
    }
  }

  // Paid tiers: soft caps via credits
  const creditUsage = await getMonthlyCredits(accountId);
  const creditLimit = PLAN_CREDITS[plan];

  if (creditUsage >= creditLimit * 1.2) {
    // 120% - throttle
    throw new UsageLimitError('Please upgrade for continued access');
  } else if (creditUsage >= creditLimit) {
    // 100% - prompt but allow
    showUpgradePrompt();
  } else if (creditUsage >= creditLimit * 0.8) {
    // 80% - warn
    showUsageWarning();
  }
}
```

### 6.3 Entitlements Table (with Temporal Support)
Create a `feature_entitlements` table with time-bounded access:

```sql
CREATE TABLE billing.feature_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts(id),
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL, -- 'plan', 'addon', 'promo', 'override'

  -- Temporal bounds (for promos, trials, time-limited access)
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ, -- NULL = forever

  -- Limits (if feature has quantity limit)
  quantity_limit INTEGER, -- e.g., voice_minutes: 60
  quantity_used INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',

  -- Unique per account/feature/valid_from (allows history)
  UNIQUE(account_id, feature_key, valid_from)
);

-- Query for currently active entitlements
CREATE INDEX entitlements_active_idx ON billing.feature_entitlements(
  account_id, feature_key
) WHERE enabled = true
  AND valid_from <= now()
  AND (valid_until IS NULL OR valid_until > now());
```

**Key fields:**
- `account_id`: The account with this entitlement
- `feature_key`: Feature identifier (e.g., `voice_chat`, `sso`, `team_workspace`)
- `enabled`: Whether currently enabled
- `source`: How this entitlement was granted (plan, add-on, promo, manual override)
- `valid_from`/`valid_until`: Time bounds for promos or trials
- `quantity_limit`/`quantity_used`: For metered features like voice minutes
- `metadata`: Additional context (promo code, admin notes, etc.)

### 6.4 Entitlement Resolution
Entitlements should be resolved through a central module:
- `getEntitlementsForAccount(accountId)`
- `isFeatureEnabled(accountId, featureKey)`
- `requireFeature(accountId, featureKey)` (throws/blocks)

### 6.5 UI + API Usage
- **UI**: Show simplified limits (analyses, minutes), hide credits
- **API**: Block access if entitlement missing

### 6.6 Initial Feature Catalog (Entitlements)

| Feature Key | Free | Starter | Pro | Team |
|-------------|------|---------|-----|------|
| `ai_analysis` | 5/mo | Unlimited* | Unlimited* | Unlimited* |
| `voice_chat` | No | Yes (60 min) | Yes (180 min) | Yes (300 min/user) |
| `survey_responses` | 50 | 500 | 2,000 | 5,000 |
| `survey_ai_analysis` | No | Yes | Yes | Yes |
| `team_workspace` | No | No | No | Yes |
| `sso` | No | No | No | Yes |

*Fair use policy applies

### 6.7 Soft Cap Strategy

**Phase 1 (Launch - Month 3): Alerts to Team, Not Users**
- **60% threshold:** Log internally
- **80% threshold:** Slack alert to team
- **100%+ threshold:** Manual review queue
- **Do not auto-throttle.** Watch and learn usage patterns first.

**Phase 2 (Month 3+): User-Facing Notifications**
- **80% warning:** "You're approaching your plan limits" (subtle banner)
- **100% prompt:** "You've reached your plan's fair use limit" (upgrade CTA)
- **120% throttle:** "Please upgrade to continue" (blocks new analyses)

See [Billing Margin Operations Guide](./billing-margin-operations.md) for detailed operational framework.

### 6.8 Discounts & Promotions
- Discount codes can apply up to **100%** of monthly price.
- Promo credits can be granted internally, tracked via `credit_grant` events.
- Promos can also grant temporary feature access (e.g., "30 days of voice chat free").

---

## 7) Teams & Seats
### 7.1 Team Billing
Team accounts should include:
- Base monthly subscription
- Seat count (quantity-based)
- Pooled credits across team (4,000/user)
- Entitlements that scale with seats

### 7.2 Seat Enforcement
- Seats must be tracked and enforced in account membership logic.
- Billing sync updates seat count from Polar subscription quantity.
- **Overage policy:** soft overage by default (allow temporary over-seating, notify and prompt upgrade).

---

## 8) Pricing Psychology: Why Hybrid Works

### 8.1 Competitive Comparison
Fathom, Grain, Fireflies all use "X analyses free, unlimited on paid" messaging. This works because:
- "Unlimited" feels generous
- Users don't have to learn a new currency
- Most users won't hit reasonable limits

### 8.2 Why Not Pure Unlimited
"Unlimited" without internal tracking is risky:
- One power user could cost $500/mo in API calls
- No upsell path for heavy users
- Realtime voice is 10-50x more expensive than async analysis

### 8.3 The Hybrid Advantage
- **Marketing:** "Unlimited AI" wins vs "1,500 credits"
- **Cost control:** Internal credit tracking catches abuse
- **Fair use:** Soft caps catch outliers without punishing normal users
- **Realtime voice:** Always metered because it's expensive

### 8.4 What Users See vs Reality

| What User Sees | What's Actually Happening |
|----------------|---------------------------|
| "Unlimited AI analysis" | 2,000-5,000 credits/mo soft cap |
| "60 minutes voice chat" | Hard limit, always shown |
| "You're approaching limits" | 80% of internal credit cap |
| "Upgrade for continued access" | 100%+ of internal credit cap |

---

## 9) Modular Architecture
### 9.1 Modules
- `billing/` — Polar integration, webhooks, subscription sync
- `credits/` — ledger, balance calculations, credit grant/spend (internal only)
- `usage/` — usage event recording, token-to-credit conversion
- `entitlements/` — feature gating and resolution
- `limits/` — user-facing limit checks and messaging

### 9.2 Integration Points
- **Trigger.dev** tasks should log usage events and spend credits.
- **Mastra agents** should log usage events.
- **Embeddings + media extraction** should route through the usage module.

---

## 10) Unknowns & Decisions Needed

### 10.1 Provider Pricing Snapshot (2026-01-16)
Prices below reflect current list rates for models used in this codebase (OpenAI standard pricing, Anthropic API pricing, Exa pay-as-you-go). Units are USD unless noted.

| Provider | Model / SKU | Usage | Input | Output | Notes |
| --- | --- | --- | --- | --- | --- |
| OpenAI | gpt-5.1 | LLM | $1.25 / 1M tokens | $10.00 / 1M tokens | Standard pricing. |
| OpenAI | gpt-5 | LLM | $1.25 / 1M tokens | $10.00 / 1M tokens | Standard pricing. |
| OpenAI | gpt-5-mini | LLM | $0.25 / 1M tokens | $2.00 / 1M tokens | Standard pricing. |
| OpenAI | gpt-4.1 | LLM | $2.00 / 1M tokens | $8.00 / 1M tokens | Standard pricing. |
| OpenAI | gpt-4o | LLM | $2.50 / 1M tokens | $10.00 / 1M tokens | Standard pricing. |
| OpenAI | gpt-4o-mini | LLM | $0.15 / 1M tokens | $0.60 / 1M tokens | Standard pricing. |
| OpenAI | text-embedding-3-small | Embeddings | $0.02 / 1M tokens | - | Embedding input only. |
| OpenAI | gpt-4o-mini-transcribe | Speech-to-text | $0.003 / minute | - | Also priced by text/audio tokens. |
| Anthropic | claude-sonnet-4-20250514 (Sonnet 4) | LLM | $3.00 / 1M tokens | $15.00 / 1M tokens | API pricing. |
| Exa | Search (1-25 results) | Web search | $5 / 1k requests | - | Used for `/search` + `/findSimilar`. |
| Google | (none detected) | - | - | - | No Gemini model configured in repo. |

Sources: OpenAI API pricing (standard) https://platform.openai.com/docs/pricing, Anthropic pricing https://www.anthropic.com/pricing, Google Gemini API pricing https://ai.google.dev/gemini-api/docs/pricing, Exa pricing https://exa.ai/pricing

### 10.2 Resolved Decisions
1. **Billing model:** Hybrid (simple user messaging + internal credit tracking).
2. **Credit unit mapping:** 1 credit = $0.01 USD (internal only).
3. **Credits expire:** All credits expire (plan credits at billing cycle end; purchased credits 12 months; promos default 90 days).
4. **Premium features:** Voice chat always metered, shown to user.
5. **Soft caps:** 80% warn, 100% prompt, 120% throttle for paid plans.

### 10.3 Still Open
1. Exact credit-to-analysis conversion (need real usage data).
2. Team pooled credit allocation strategy.
3. Grace period duration for soft cap overages.

---

## 11) Next Steps

### Implementation
- Confirm pricing tiers ($15/$30/$25 per seat).
- Implement `usage_events` + credit ledger schema.
- Build user-facing limit display (analyses, voice minutes).
- Build internal credit tracking (hidden from UI).
- Wire billing webhooks to update subscriptions + credit grants.

### Operations (Phased)
1. **Launch:** Instrument all AI calls with cost tracking
2. **Month 1-3:** Alert team on soft cap hits (no user-facing throttling)
3. **Month 3+:** Add user-facing warnings and upgrade prompts
4. **At 100 users:** Review margin distribution, adjust if >10% unprofitable

See [Billing Margin Operations Guide](./billing-margin-operations.md) for detailed margin math and operational playbook.

---

## 12) Survey Responses: Cost Model & Tier Suggestions
### 12.1 Assumptions
This is a first-pass model; refine with real usage data.
- Average response length: **120–250 tokens** (short-form surveys).
- Analysis per response: **~300–800 tokens** (summarization + tagging).
- Total per response (survey-only): **~600–1,200 tokens**.
- Cost equivalence: use **credits = cost**, where **1 credit = $0.01**.

### 12.2 Rough Estimates
If **1 credit = $0.01**, then **$10–$20** includes **1,000–2,000 credits**.
- **Low analysis case** (600 tokens/response): ~0.0006M tokens per response.
- **Moderate analysis case** (1,200 tokens/response): ~0.0012M tokens per response.

At ~$0.01/credit, if we assume **$0.01 ≈ 1–3k tokens** (provider-dependent), then:
- **$10 plan (1,000 credits)** ≈ **1M–3M tokens**.
- **$20 plan (2,000 credits)** ≈ **2M–6M tokens**.

**Survey-only capacity (ballpark):**
- **$10 plan:** ~800–2,500 responses/month.
- **$20 plan:** ~1,600–5,000 responses/month.

---

## 13) Team Plan Cost Model: 30-Min Interview Capacity
### 13.1 Assumptions (update with real telemetry)
- Speech rate: **150 wpm** → **~4,500 words** per 30 minutes.
- Tokenization: **~1.3 tokens/word** → **~5,850 tokens** raw transcript.
- Processing multiplier: **3–6×** transcript tokens for extraction + analysis + summaries.
- **Total per 30-min interview**: **~18k–35k tokens** (light Q&A + standard pipeline).
- Cost conversion: **1 credit = $0.01**, so credits are cost-based and provider-agnostic.

### 13.2 Capacity Estimates (per month)
If a plan includes **1M–2M credits/month**:
- **1M credits (~$10 in usage cost)** → **~28–55 interviews/month**.
- **2M credits (~$20 in usage cost)** → **~57–110 interviews/month**.

### 13.3 Capacity Estimates (per year)
Multiply monthly capacity by 12:
- **1M credits** → **~336–660 interviews/year**.
- **2M credits** → **~684–1,320 interviews/year**.

These are directional; adjust with real cost telemetry per provider/model.

---

## 14) Realtime Voice Chat: Always Metered

**Important:** Unlike async AI analysis, realtime voice is always metered and shown to the user.

### 14.1 Why Voice is Different
- **10-50x more expensive** than async analysis per interaction
- Costs accumulate per minute, not per analysis
- Users expect to see minutes remaining (like phone plans)

### 14.2 Cost Formula (per minute)
Estimate based on **tokens/minute** and provider pricing:
- **tokens/minute** ≈ (user speech + model response) tokens.
- **cost/minute** = (tokens/minute ÷ 1,000) × model $/1k tokens.
- **credits/minute** = cost/minute ÷ $0.01.
- **price/minute** to maintain **70% margin**: cost/minute ÷ 0.30.

### 14.3 Example Range (light usage)
If **tokens/minute ≈ 400–800** and **$0.003–$0.01 per 1k tokens**:
- **cost/minute** ≈ $0.0012–$0.0080
- **credits/minute** ≈ 0.12–0.80
- **price/minute** (70% margin) ≈ $0.004–$0.027

### 14.4 Voice Minute Allocations

| Tier | Voice Minutes/Month | User Sees |
|------|---------------------|-----------|
| Free | 0 | "Upgrade to unlock voice chat" |
| Starter | 60 | "47 minutes remaining" |
| Pro | 180 | "156 minutes remaining" |
| Team | 300/user | "Team: 892 minutes remaining" |

### 14.5 Real-Time Voice Tracking Strategy

**Challenge:** Voice usage must be tracked in real-time during calls, not async after.

**Integration with LiveKit:**

```typescript
// On room.participant.connected
async function onVoiceSessionStart(params: {
  accountId: string;
  userId: string;
  roomId: string;
}) {
  // Check remaining minutes before allowing connection
  const entitlement = await getActiveEntitlement(
    params.accountId,
    'voice_chat'
  );

  if (!entitlement || entitlement.quantity_used >= entitlement.quantity_limit) {
    throw new Error('No voice minutes remaining');
  }

  // Store session start time
  await redis.set(`voice:session:${params.roomId}`, {
    accountId: params.accountId,
    userId: params.userId,
    startedAt: Date.now(),
  });
}

// On room.participant.disconnected (or periodic heartbeat)
async function onVoiceSessionEnd(roomId: string) {
  const session = await redis.get(`voice:session:${roomId}`);
  if (!session) return;

  const durationMinutes = Math.ceil(
    (Date.now() - session.startedAt) / 60000
  );

  // Update entitlement quantity_used
  await supabase.rpc('increment_voice_minutes', {
    p_account_id: session.accountId,
    p_minutes: durationMinutes,
  });

  // Also record in usage_events for cost tracking
  await recordUsageEvent({
    accountId: session.accountId,
    userId: session.userId,
    featureSource: 'voice_chat',
    resourceType: 'voice_session',
    resourceId: roomId,
    // Voice cost calculated separately
  });

  await redis.del(`voice:session:${roomId}`);
}
```

**Guardrails:**
- **30-second grace:** Don't hard-cut at exactly 0 minutes; allow 30s buffer
- **Periodic sync:** Every 60 seconds during call, sync used minutes to DB
- **Disconnect recovery:** If connection drops, use last heartbeat to calculate duration
- **Prevent abuse:** Max session duration = remaining minutes + 5 minute grace

---

## 15) Required User Flows (Billing + Entitlements)
1. **Plan selection** (individual vs team, tier comparison).
2. **Checkout** (Polar hosted checkout + seat quantity).
3. **Upgrade/downgrade** (proration + limit adjustments).
4. **Soft cap warning** (80% → banner: "Approaching limits").
5. **Soft cap prompt** (100% → modal: "Upgrade for continued access").
6. **Feature gating** (attempt gated feature → upgrade prompt).
7. **Team seat management** (add/remove seats, soft overage notice).
8. **Promo code application** (price discounts + optional feature grants).

---

## 16) Wireframe Proposals (Textual)

### 16.1 Billing Overview (User Dashboard)
- **Header**: Current plan, renewal date.
- **Usage cards** (no credits shown):
  - "AI Analyses: Unlimited" (or "3 of 5 used" for Free)
  - "Voice Chat: 47 minutes remaining"
  - "Survey Responses: 234 of 500 used"
- **CTA**: Upgrade / Manage Seats.

### 16.2 Checkout
- **Plan summary** + seat quantity selector.
- **Promo code input** with applied discount summary.
- **Features preview**: what's included, voice minutes, survey limits.

### 16.3 Soft Cap Warning (80%)
- **Banner** (subtle): "You're approaching your plan's usage limits."
- **Actions**: "View usage" / "Upgrade plan".

### 16.4 Soft Cap Prompt (100%)
- **Modal**: "You've reached your plan's fair use limit."
- **Body**: "Your plan includes generous AI usage. For teams with higher needs, upgrade to Pro."
- **CTA**: "Upgrade to Pro" / "Continue for now" (grace period).

### 16.5 Feature Gate Modal
- **Title**: "Upgrade to access Voice Chat."
- **Body**: "Real-time voice conversations with AI are available on Starter and above."
- **CTA**: "Upgrade to Starter ($15/mo)" / "Maybe later".

### 16.6 Team Seats
- **Seat usage bar**: "8 of 10 seats used."
- **Soft overage notice**: "2 over limit, billing next cycle."
- **CTA**: "Add seats".
