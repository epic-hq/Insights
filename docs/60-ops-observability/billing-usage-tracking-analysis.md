# Billing & Usage Tracking: Architecture Analysis

**Date:** January 2026
**Purpose:** Critical analysis of the current in-app billing/usage tracking system vs. external platforms (Langfuse, PostHog)

---

## Executive Summary

The Insights platform has a **custom-built billing and usage tracking system** that stores all LLM cost data in Supabase (`billing.usage_events`, `billing.credit_ledger`). This was a pragmatic "MVP" approach to get billing data in-house quickly.

**Key Question:** Should this data be pushed to external platforms (Langfuse, PostHog) for better analysis capabilities?

**Recommendation:** **Hybrid approach** - Keep the in-app system for billing operations while adding Langfuse for LLM observability and cost analytics. PostHog should remain focused on product analytics, not LLM costs.

---

## Current Architecture Overview

### What We Have Today

| Component | Location | Purpose |
|-----------|----------|---------|
| **billing.usage_events** | Supabase | Every LLM call with tokens, cost, model, feature |
| **billing.credit_ledger** | Supabase | Immutable ledger of credit grants/spends |
| **billing.feature_entitlements** | Supabase | Feature gating per account |
| **Admin Usage Dashboard** | `/admin/usage` | Recharts-based visualization |
| **Langfuse** | External (optional) | LLM tracing/debugging |
| **PostHog** | External (optional) | Product analytics, feature flags |

### Data Flow

```
LLM Call (BAML/OpenAI)
    │
    ├──► billing.usage_events (Supabase)
    │       └── tokens, cost, model, feature_source, account_id
    │
    ├──► billing.credit_ledger (Supabase)
    │       └── credit spend/grant events
    │
    └──► Langfuse (optional)
            └── trace/generation for debugging
```

### Admin Dashboard Capabilities

The `/admin/usage` page currently provides:

- **Summary metrics**: Total events, cost, credits, active accounts
- **Cost metrics**: Avg cost per day/week/month/user
- **Daily trends**: Stacked bar chart by feature
- **Per-account breakdown**: Top accounts by consumption
- **Per-feature breakdown**: Credit consumption by feature type
- **Per-user breakdown**: Individual user consumption

---

## Option Analysis

### Option 1: Current System (In-App Supabase)

**What it is:** Custom tables in Supabase with SQL functions for aggregation, React dashboard for visualization.

#### Pros

| Benefit | Details |
|---------|---------|
| **Zero additional cost** | No external service fees |
| **Data ownership** | All data in your database, exportable anytime |
| **Low latency queries** | Direct SQL, no API round-trips |
| **Custom billing logic** | Tight integration with credit ledger, atomic operations |
| **Idempotency built-in** | Database-level unique constraints prevent duplicates |
| **Privacy/compliance** | No PII leaving your infrastructure |
| **Simple debugging** | Query data directly with SQL |
| **Offline capability** | Works if external services are down |

#### Cons

| Limitation | Impact |
|------------|--------|
| **Limited visualization** | Recharts is basic vs. dedicated analytics tools |
| **No automatic insights** | No anomaly detection, forecasting, or alerts |
| **Manual dashboard building** | Every new view requires React code |
| **No drill-down exploration** | Fixed views, can't ad-hoc explore |
| **No retention analysis** | Hard to build cohort/retention charts |
| **Scale concerns** | Large event volumes may need partitioning |
| **No comparison benchmarks** | Can't compare to industry/similar apps |

#### Best For
- Billing operations (credit checking, limits, atomic spends)
- Audit trail / compliance requirements
- Simple cost monitoring during early stage

---

### Option 2: Langfuse (LLM Observability Platform)

**What it is:** Purpose-built platform for LLM observability, tracing, evals, and cost tracking.

#### Pricing (as of Jan 2026)

| Plan | Cost | Included |
|------|------|----------|
| **Hobby** | Free | 50K observations/month |
| **Pro** | $59/month | 1M observations/month |
| **Team** | $499/month | 5M observations/month |
| **Self-hosted** | Free | Unlimited (you host) |

#### Pros

| Benefit | Details |
|---------|---------|
| **LLM-specific analytics** | Cost per model, latency distributions, token analysis |
| **Trace visualization** | See full conversation flows with timing |
| **Prompt versioning** | Track prompt changes and their impact |
| **Evaluation framework** | Built-in scoring and human feedback |
| **Model comparison** | A/B test different models easily |
| **Anomaly detection** | Alerts on unusual cost/latency patterns |
| **User segments** | Group traces by metadata for analysis |
| **Self-host option** | Keep data in your infra if needed |
| **Already integrated** | Langfuse client exists in codebase |

#### Cons

| Limitation | Impact |
|------------|--------|
| **Not a billing system** | Can't do credit limits, atomic operations |
| **Additional cost** | $59-$499/month for meaningful volume |
| **Duplicate data** | Would store similar data to usage_events |
| **Vendor dependency** | API changes, uptime concerns |
| **Learning curve** | Team needs to learn new tool |
| **Privacy concerns** | Prompts/responses may contain PII |
| **No product analytics** | Only understands LLM calls, not user flows |

#### Best For
- LLM debugging and optimization
- Model performance comparison
- Prompt engineering iteration
- Quality scoring and evals

---

### Option 3: PostHog (Product Analytics)

**What it is:** Product analytics platform with event tracking, funnels, cohorts, and feature flags.

#### Pricing (as of Jan 2026)

| Plan | Cost | Included |
|------|------|----------|
| **Free** | $0 | 1M events/month |
| **Paid** | ~$0.00045/event | Pay as you go after 1M |
| **Self-hosted** | Free | Unlimited (you host) |

#### Pros

| Benefit | Details |
|---------|---------|
| **Rich analytics** | Funnels, retention, user paths, cohorts |
| **Session replay** | See exactly what users do |
| **Feature flags** | Already using for rollouts |
| **SQL access** | Query raw events with HogQL |
| **Generous free tier** | 1M events/month free |
| **Already integrated** | PostHog client exists in codebase |
| **Product context** | Correlate LLM costs with user behavior |
| **Alerts & dashboards** | Built-in visualization and alerting |

#### Cons

| Limitation | Impact |
|------------|--------|
| **Not LLM-aware** | Doesn't understand tokens, models, traces |
| **No billing operations** | Can't do credit limits, atomic spends |
| **Event-based pricing** | High LLM volume = high cost |
| **Not purpose-built** | Would need custom properties for LLM data |
| **Overhead per LLM call** | Adding events for every API call is expensive |
| **Privacy concerns** | Would need to sanitize prompts/responses |

#### Cost Projection for LLM Events

| Monthly LLM Calls | PostHog Events | Est. Cost |
|-------------------|----------------|-----------|
| 10,000 | 10,000 | Free |
| 100,000 | 100,000 | Free |
| 500,000 | 500,000 | ~$180/month |
| 1,000,000 | 1,000,000 | ~$450/month |

#### Best For
- Product analytics (user behavior, funnels)
- Feature flag management
- User segmentation for marketing
- **NOT for LLM cost tracking**

---

### Option 4: Hybrid Approach (Recommended)

**What it is:** Use each tool for its strength, avoid duplication.

```
┌────────────────────────────────────────────────────────────────┐
│                     DATA FLOW ARCHITECTURE                      │
└────────────────────────────────────────────────────────────────┘

LLM Call
    │
    ├──► Supabase (billing.usage_events)      [BILLING OPERATIONS]
    │       • Credit limits & atomic spends
    │       • Audit trail
    │       • Account-level cost tracking
    │       • Admin dashboard basics
    │
    ├──► Langfuse (traces)                     [LLM OBSERVABILITY]
    │       • Prompt debugging
    │       • Latency analysis
    │       • Model comparison
    │       • Quality evals
    │       • Cost analytics (secondary)
    │
    └──► PostHog (high-level events only)      [PRODUCT ANALYTICS]
            • interview_processed (not every LLM call!)
            • lens_applied
            • voice_session_completed
            • User behavior correlation
```

#### Why This Works

| System | Responsibility | Data Volume |
|--------|----------------|-------------|
| **Supabase** | Billing operations, audit trail | Every LLM call |
| **Langfuse** | LLM debugging, optimization | Every LLM call (traces) |
| **PostHog** | User behavior, product metrics | Aggregate events only |

#### Key Principle: Don't Send Every LLM Call to PostHog

Instead of:
```typescript
// ❌ BAD: Every LLM call → PostHog
posthog.capture('llm_call', { model, tokens, cost })
```

Do this:
```typescript
// ✅ GOOD: Aggregate events → PostHog
posthog.capture('interview_processed', {
  interview_id,
  total_cost_usd,  // Sum of all LLM calls
  total_tokens,
  duration_ms,
  feature: 'interview_analysis'
})
```

---

## Decision Matrix

| Criterion | Supabase | Langfuse | PostHog |
|-----------|----------|----------|---------|
| **Billing operations** | ✅ Required | ❌ Can't do | ❌ Can't do |
| **Credit limits** | ✅ Atomic checks | ❌ No support | ❌ No support |
| **LLM cost tracking** | ✅ Good | ✅ Excellent | ⚠️ Possible but expensive |
| **Prompt debugging** | ❌ Manual SQL | ✅ Excellent | ❌ Not designed for this |
| **Model comparison** | ⚠️ Manual | ✅ Built-in | ❌ Manual |
| **Quality evals** | ❌ Not built | ✅ Built-in | ❌ Not built |
| **Product analytics** | ❌ Not built | ❌ Not designed for this | ✅ Excellent |
| **User funnels** | ❌ Not built | ❌ Not designed for this | ✅ Excellent |
| **Retention analysis** | ❌ Manual | ❌ Not designed for this | ✅ Excellent |
| **Anomaly detection** | ❌ Manual | ✅ Built-in | ✅ Built-in |
| **Self-host option** | ✅ Already self-hosted | ✅ Available | ✅ Available |
| **Additional cost** | $0 | $59-$499/mo | $0-$450/mo |

---

## Cost Comparison (Monthly)

### Scenario: 500 interviews/month, 200 users

| Approach | External Cost | Implementation Effort |
|----------|--------------|----------------------|
| **Supabase only** | $0 | Low (already built) |
| **+ Langfuse Pro** | $59/month | Medium (enhance integration) |
| **+ PostHog (LLM events)** | ~$200/month | Medium |
| **Hybrid (recommended)** | $59/month | Low |

### Why Langfuse is Worth $59/month

At 500 interviews × $1.50 avg cost = **$750/month in LLM spend**.

Langfuse helps you:
- Identify 20% cost savings through model comparison → **$150/month saved**
- Debug failed extractions faster → **Engineer time saved**
- Track quality regressions before users complain

**ROI: 2-3x the subscription cost in savings.**

---

## Recommendations

### Short-term (This Month)

1. **Keep Supabase as the billing system** - It's working, handles atomic operations
2. **Enhance Langfuse integration** for LLM observability:
   - Add trace context to all BAML calls
   - Include cost estimates in traces
   - Set up cost dashboards in Langfuse
3. **Do NOT send LLM events to PostHog** - Too expensive, wrong tool

### Medium-term (Next Quarter)

4. **Add aggregate events to PostHog** for product correlation:
   - `interview_processed` with total cost
   - `voice_session_ended` with duration/cost
   - Correlate LLM costs with user retention
5. **Build cost anomaly alerts** in Langfuse
6. **Consider Langfuse self-hosting** if costs grow significantly

### Long-term (6+ Months)

7. **Evaluate Langfuse vs Supabase deduplication** - If Langfuse becomes primary for cost analytics, consider reducing Supabase tracking to billing operations only
8. **Consider data warehouse** (BigQuery/Snowflake) if you need cross-platform analytics at scale

---

## Implementation Checklist

### Enhance Langfuse Integration

```typescript
// Current (basic tracing)
const trace = langfuse.trace({ name: 'interview.extract' })
const gen = trace.generation({ name: 'baml.ExtractEvidence' })
// ... run LLM
gen.end({ output })

// Enhanced (with cost tracking)
const trace = langfuse.trace({
  name: 'interview.extract',
  metadata: {
    accountId,
    interviewId,
    projectId
  }
})
const gen = trace.generation({
  name: 'baml.ExtractEvidence',
  model: 'gpt-4o',
  usage: {
    input: inputTokens,
    output: outputTokens,
    totalCost: estimatedCostUsd
  }
})
```

### Add Aggregate Events to PostHog

```typescript
// After interview processing completes
posthog.capture('interview_processed', {
  interview_id: interviewId,
  account_id: accountId,
  total_cost_usd: sumOfAllLlmCosts,
  total_tokens: sumOfAllTokens,
  processing_duration_ms: endTime - startTime,
  evidence_count: extractedEvidence.length,
  model_distribution: { 'gpt-4o': 5, 'gpt-4o-mini': 3 }
})
```

---

## Conclusion

**Your instinct is right:** Rolling your own billing/usage tracking was a smart MVP move to get base data quickly. But it's not the right long-term home for all LLM analytics.

**The answer isn't to migrate everything** - it's to use each tool for its strength:

| Tool | Use For | Don't Use For |
|------|---------|---------------|
| **Supabase** | Billing ops, credit limits, audit trail | Advanced analytics |
| **Langfuse** | LLM debugging, model comparison, cost analytics | Billing operations, product analytics |
| **PostHog** | User behavior, funnels, retention | Per-LLM-call tracking |

**Bottom line:** Add $59/month of Langfuse for LLM observability. Keep Supabase for billing. Keep PostHog for product analytics. Don't over-engineer.

---

## Appendix: What Each Platform Excels At

### Langfuse Dashboard Examples

What you can see in Langfuse that's hard to build:
- Token usage heatmap by model over time
- P50/P95/P99 latency distributions
- Cost per trace with full prompt visibility
- A/B model comparison with quality scores
- Prompt version tracking

### PostHog Dashboard Examples

What you can see in PostHog that's hard to build:
- Conversion funnel: Signup → First Interview → First Insight
- Retention cohorts: Users who processed 5+ interviews
- Feature flag impact on activation rates
- User paths through the application
- Session recordings of confused users

### Supabase Strengths

What Supabase does that others can't:
- `SELECT FOR UPDATE` row locking for credit limits
- Idempotency via unique constraints
- Foreign key relationships to accounts/users
- Real-time subscriptions for live dashboards
- Full SQL flexibility for custom queries
