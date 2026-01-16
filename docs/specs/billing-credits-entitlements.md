# Billing, Credits, and Entitlements Spec (Draft)

## 0) Spec-First Summary
This spec defines a modular billing system for individual and team accounts using Polar.sh (Stripe backend), a unified usage credits ledger, and a feature-entitlement layer that gates premium functionality by tier. It establishes a consistent usage metering strategy across LLM-heavy workflows, and introduces reusable authorization hooks for UI + API checks to enable/disable features and display upgrade prompts.

---

## 1) Goals & Non-Goals
### Goals
- Support **individual and team billing** (seat-based) with Polar + Stripe.
- Provide **usage credits** bundled with base plans, plus **recurring credit add-ons**.
- Enable **discounts and promo codes** (price reductions and/or credit grants).
- Add **tier-based entitlements** (feature gating and upgrade prompts).
- Centralize **usage metering** for LLM calls and other costly operations.
- Provide a **modular architecture** so billing, credits, and entitlements are cleanly integrated.

### Non-Goals (for initial phase)
- No full UI implementation of billing flows.
- No migration of legacy billing data beyond minimal syncing.
- No new payment provider beyond Stripe via Polar.

---

## 2) Core Concepts
### 2.1 Billing Plans & Tiers
Plans should be structured around **tiers**, each with:
- Base monthly price.
- Included monthly credits.
- Feature entitlements (SSO, secure environment, realtime voice/video, etc.).

**Default rule:** all current features are included in the base tier unless explicitly listed as premium.

**Examples** (illustrative only):
- **Starter (Individual)**: Base price + monthly credits + core features.
- **Pro (Individual)**: Higher price + more credits + premium features (e.g., realtime collaboration).
- **Team (Seats)**: Base team price + per-seat pricing + team-only features.

### 2.2 Credits
Credits abstract away “tokens” and can be marketed as a simple usage unit. Credits map internally to tokens or cost (see Section 8).

### 2.3 Entitlements
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
- Create a **base product** for each tier (Starter, Pro, Team).
- Create **add-on products** for recurring credits ($10, $20 tiers).
- Ensure **seat-based pricing** is supported for Team plans (quantity on subscription).

### 3.3 Billing Webhooks
- Subscribe to Polar webhooks:
  - `customer.created` / `customer.updated`
  - `subscription.created` / `subscription.updated` / `subscription.canceled`
  - `invoice.paid` / `invoice.failed`
- Sync these into local tables (`billing_customers`, `billing_subscriptions`) and trigger credit grants.

---

## 4) Credits Ledger (Usage Accounting)
### 4.1 Ledger Events
Implement an immutable ledger with event types:
- `credit_grant` (monthly plan credits, promo bonuses, manual credits)
- `credit_purchase` (recurring add-ons)
- `credit_spend` (usage consumption)
- `credit_expire` (optional, for expiring plan credits)

### 4.2 Credit Balance Calculation
- Balance = sum(grants + purchases − spends − expirations)
- Always compute from ledger, never store as a mutable number.

### 4.3 Plan Credit Grants
- On subscription renewal (invoice paid), grant monthly credits.
- If subscription is canceled, do not grant credits for that cycle.
- **Expiration:** plan-included credits expire monthly by default; purchased add-on credits can be non-expiring unless stated otherwise.

---

## 5) Usage Metering
### 5.1 Usage Events
Create a `usage_events` table to record metering events for each LLM call:
- `account_id`, `project_id`, `user_id`
- `provider`, `model`
- `input_tokens`, `output_tokens`, `total_tokens`
- `estimated_cost_usd`
- `feature_source` (e.g., interview pipeline, project status agent)
- `created_at`

### 5.2 Usage to Credits
Define a single conversion rule that works across LLM providers.

**Recommendation:** prefer a **cost-based bridge** so tokenization differences don’t matter.
- **1 credit = $0.01 of usage cost** (or similar), calculated per provider’s reported cost.
- Store both **token metrics** and **estimated_cost_usd** for analysis and internal auditing.

If a provider does not return cost, compute it from tokens and model pricing. The **credit ledger should only consume cost-based credits** to keep accounting consistent across models.

**Decision:** large monthly credit counts are acceptable (e.g., 1–2M credits/mo), and can feel generous without breaking accounting since credits map to cost.

### 5.4 Margin Target
- Pricing and credit grants should target **~70% gross margin on token/LLM usage** across providers.
- Maintain a provider cost table and periodically recalibrate credit bundles to preserve margin as model prices change.

### 5.3 Critical Paths to Meter
- Interview processing pipeline (Trigger.dev)
- Project status agent & onboarding agents
- Semantic search embeddings
- Media extraction LLM usage

---

## 6) Entitlements & Feature Gating
### 6.1 Entitlements Table
Create a `feature_entitlements` table:
- `account_id`
- `feature_key`
- `enabled` (boolean)
- `source` (plan, add-on, override)
- `metadata` (optional JSON, e.g., usage caps)

### 6.2 Entitlement Resolution
Entitlements should be resolved through a central module:
- `getEntitlementsForAccount(accountId)`
- `isFeatureEnabled(accountId, featureKey)`
- `requireFeature(accountId, featureKey)` (throws/blocks)

### 6.3 UI + API Usage
- **UI**: Hide/disable features + show upgrade prompt.
- **API**: Block access if entitlement missing.

### 6.5 Low-Credit Notifications
- Surface visible notifications when users reach **15% or less** of their monthly credits.
- Trigger UI banners and optional email alerts; include a direct upgrade/add-on CTA.

### 6.4 Discounts & Promotions
- Discount codes can apply up to **100%** of monthly price.
- Promo credits can be granted at **up to 100% of the monthly credit allotment** (or more for special cases), tracked via `credit_grant` events.

---

## 7) Teams & Seats
### 7.1 Team Billing
Team accounts should include:
- Base monthly subscription
- Seat count (quantity-based)
- Entitlements that scale with seats

### 7.2 Seat Enforcement
- Seats must be tracked and enforced in account membership logic.
- Billing sync updates seat count from Polar subscription quantity.
- **Overage policy:** soft overage by default (allow temporary over-seating, notify and prompt upgrade).

---

## 8) Credits vs Tokens: Pricing Psychology
### 8.1 Recommendation
Market “credits” instead of “tokens.” Credits feel more user-friendly and avoid exposing raw model complexity.

### 8.2 Token Count Strategy
- **Large numbers (e.g., 1,000,000 credits)** feel generous and unlimited, but can obscure true cost.
- **Smaller numbers (e.g., 100,000 credits)** feel more constrained but make usage feel tangible.

**Proposal**:
- Use **credits** in the UI, not tokens.
- Choose a credit size that makes typical usage look “healthy” but not infinite.
- Example: **1 credit = $0.01**, and plans grant 200–1,000 credits per month.

This keeps numbers meaningful while mapping directly to spend, even when tokenization differs by provider.

---

## 9) Modular Architecture
### 9.1 Modules
- `billing/` — Polar integration, webhooks, subscription sync
- `credits/` — ledger, balance calculations, credit grant/spend
- `usage/` — usage event recording, token-to-credit conversion
- `entitlements/` — feature gating and resolution

### 9.2 Integration Points
- **Trigger.dev** tasks should log usage events and spend credits.
- **Mastra agents** should log usage events.
- **Embeddings + media extraction** should route through the usage module.

---

## 10) Unknowns & Decisions Needed
1. Credit unit mapping (confirm final $ per credit).
2. Purchased credit expiration (expire or roll over).
3. Feature catalog: which features are explicitly premium vs base.
4. Survey response cost model assumptions (see Section 12).

---

## 11) Next Steps
- Confirm pricing tiers and included credits.
- Define a feature catalog with keys + tier mapping.
- Implement usage_events + credit ledger schema.
- Build entitlements resolution + UI gating helpers.
- Wire billing webhooks to update subscriptions + credit grants.

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

### 12.3 Tier Suggestions (Example)
- **Starter ($10)**: survey + lightweight analysis, limited LLM-heavy features.
- **Pro ($20)**: higher credits, enables realtime chat/voice, richer analysis.
- **Team ($30 base + seats)**: seat-based, includes shared workspace + premium entitlements (SSO, secure environments).

Users doing chat/voice/video should expect to consume credits faster; include UX warnings and upgrade prompts when crossing thresholds.

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

## 14) Realtime Voice Chat: Incremental Cost Per Minute
### 14.1 Cost Formula (per minute)
Estimate based on **tokens/minute** and provider pricing:
- **tokens/minute** ≈ (user speech + model response) tokens.
- **cost/minute** = (tokens/minute ÷ 1,000) × model $/1k tokens.
- **credits/minute** = cost/minute ÷ $0.01.
- **price/minute** to maintain **70% margin**: cost/minute ÷ 0.30.

### 14.2 Example Range (light usage)
If **tokens/minute ≈ 400–800** and **$0.003–$0.01 per 1k tokens**:
- **cost/minute** ≈ $0.0012–$0.0080
- **credits/minute** ≈ 0.12–0.80
- **price/minute** (70% margin) ≈ $0.004–$0.027

Use actual provider pricing and runtime token counts to finalize.

---

## 15) Required User Flows (Billing + Entitlements)
1. **Plan selection** (individual vs team, tier comparison).
2. **Checkout** (Polar hosted checkout + seat quantity).
3. **Upgrade/downgrade** (proration + credit adjustments).
4. **Add-on credits** (recurring $10/$20).
5. **Low-credit alert** (15% remaining → CTA to upgrade/add-on).
6. **Feature gating** (attempt gated feature → upgrade prompt).
7. **Team seat management** (add/remove seats, soft overage notice).
8. **Promo code application** (price discounts + optional credit grants).

---

## 16) Wireframe Proposals (Textual)
### 16.1 Billing Overview
- **Header**: current plan, renewal date, credits remaining, usage trend.
- **Cards**: Starter / Pro / Team with monthly price, credits, feature list.
- **CTA**: Upgrade / Manage Seats / Buy Credits.

### 16.2 Checkout
- **Plan summary** + seat quantity selector.
- **Promo code input** with applied discount summary.
- **Credits preview**: monthly credits + add-on credits.

### 16.3 Low-Credit Alert
- **Banner**: “You’ve used 85% of your credits.”
- **Actions**: “Add $10 credits” / “Upgrade plan”.

### 16.4 Feature Gate Modal
- **Title**: “Upgrade to access Realtime Voice.”
- **Body**: short value prop + credit impact note.
- **CTA**: “Upgrade to Pro” / “Contact sales (Team)”.

### 16.5 Team Seats
- **Seat usage bar**: used vs purchased seats.
- **Soft overage notice**: “3 over seats, billing next cycle.”
- **CTA**: “Add seats”.
