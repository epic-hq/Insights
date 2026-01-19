# Billing Margin Math & Operations Guide

This document covers the financial modeling and operational framework for managing "unlimited" AI plans while maintaining healthy margins.

---

## 1) Cost Per Activity

Estimates based on current provider pricing. Adjust with actual telemetry.

| Activity | Token Usage | Estimated Cost |
|----------|-------------|----------------|
| 30-min interview transcription | ~6,000 tokens | ~$0.02 (Whisper/Deepgram) |
| Interview AI analysis (extraction, summary) | ~15,000-30,000 tokens | $0.15–0.40 |
| Survey response AI analysis | ~500-1,500 tokens | $0.01–0.03 |
| Realtime voice (per minute) | ~400-800 tokens/min | $0.05–0.15/min |

---

## 2) Margin Scenarios by Tier

### Starter Tier ($15/mo)

| User Type | Monthly Usage | Your Cost | Margin |
|-----------|---------------|-----------|--------|
| Light | 5 analyses | ~$1.50 | **90%** |
| Normal | 15 analyses | ~$4.50 | **70%** |
| Heavy | 40 analyses | ~$12 | **20%** |
| Abuser | 150 analyses | ~$45 | **-200%** |

### Pro Tier ($30/mo)

| User Type | Monthly Usage | Your Cost | Margin |
|-----------|---------------|-----------|--------|
| Light | 10 analyses | ~$3 | **90%** |
| Normal | 30 analyses | ~$9 | **70%** |
| Heavy | 80 analyses | ~$24 | **20%** |
| Abuser | 300 analyses | ~$90 | **-200%** |

---

## 3) The "Unlimited" Bet

You're betting on distribution. Typical SaaS usage follows a power law:

```
~60% of users: Light (< 10/month)     → Highly profitable
~30% of users: Normal (10-30/month)   → Target margin (70%)
~8% of users:  Heavy (30-60/month)    → Low margin but okay
~2% of users:  Extreme (60+/month)    → Unprofitable
```

If your mix looks like this, blended margin is ~65-70%. That's healthy.

### Early Adopter Risk

Early adopters skew heavy. Your first 100 users might be 40% heavy users, not 8%. **Revisit distribution after you have real data.**

---

## 4) Operational Framework

### Phase 1: Instrument Everything (Now)

Log every AI call with cost:

```typescript
await logUsageEvent({
  account_id,
  feature_source: 'interview_analysis',
  model: 'claude-sonnet-4-20250514',
  input_tokens: 12000,
  output_tokens: 3500,
  estimated_cost_usd: 0.28,  // ← Track actual cost
  created_at: new Date()
});
```

Build a simple dashboard showing:
- Cost per account per month
- Cost per feature
- Distribution curve (what % of users are in each bucket)

### Phase 2: Set Internal Thresholds (Launch)

Don't show these to users. Just track internally.

```typescript
const SOFT_CAPS = {
  free: {
    ai_analyses: 5,        // Hard cap (shown to user)
    cost_usd: 2
  },
  starter: {
    ai_analyses: null,     // "Unlimited" to user
    cost_usd: 12,          // Internal soft cap (~80% of revenue)
    warning_usd: 8         // Alert you at this point
  },
  pro: {
    ai_analyses: null,
    cost_usd: 25,
    warning_usd: 18
  }
};
```

### Phase 3: Alerts, Not Blocks (Month 1-3)

```typescript
// Daily job
for (const account of accounts) {
  const monthlyUsage = await getMonthlyUsageCost(account.id);
  const plan = account.plan;

  if (monthlyUsage > SOFT_CAPS[plan].warning_usd) {
    // Alert YOU, not the user
    await notifySlack(`⚠️ ${account.name} at ${monthlyUsage}/${SOFT_CAPS[plan].cost_usd}`);
  }

  if (monthlyUsage > SOFT_CAPS[plan].cost_usd * 2) {
    // Definitely look at this one
    await notifySlack(`🚨 ${account.name} 2x over soft cap`);
  }
}
```

**Do not auto-throttle yet.** Just watch.

### Phase 4: Human Intervention (When Needed)

When you see an outlier:

1. **Check the use case** — Are they doing something valuable or gaming the system?
2. **Reach out personally** — "Hey, I noticed you're getting a ton of value from Insights. Love to hear what you're working on."
3. **Offer Enterprise** — Heavy users often have budget. "For your usage level, our Team plan might be a better fit."
4. **Only throttle bad actors** — Someone running automated scripts to abuse your API

Most "abusers" are actually your best customers in disguise. They'll pay more if you ask.

### Phase 5: Codify Fair Use (Month 3+)

Once you have data, write a fair use policy:

> "Unlimited AI analysis is subject to fair use. Accounts consistently exceeding 50 analyses/month may be contacted to discuss Team plans better suited to high-volume workflows."

This gives you cover to act without surprising users.

---

## 5) Decision Tree

```
User hits soft cap
       │
       ▼
Is this their first month?
       │
  Yes ─┴─ No
   │      │
   ▼      ▼
 Watch   What's the pattern?
         │
    ┌────┴────┐
    ▼         ▼
 Growing    Steady high
    │         │
    ▼         ▼
 Reach out  Reach out
 "Love the   "Team plan
  usage!"    might fit"
```

---

## 6) Recommendations

### Launch Strategy

1. **Track cost per account from day 1**
2. **Set soft caps at 80% of plan revenue** (internal only)
3. **Alert yourself at 60% threshold**
4. **Do not auto-throttle for first 3 months**
5. **Manually review anyone over 100% of cap**
6. **Add Enterprise tier for users who need more**

### Review Triggers

**Revisit at 100 paying users.** If more than 10% are unprofitable, either:
- Raise prices
- Lower soft caps
- Make caps visible ("50 analyses/month")

You're not "running it until overuse"—you're **instrumenting it so you can see overuse coming** and respond intelligently.

---

## 7) Hard Limit: Realtime Voice

Don't make this unlimited. Ever. It's 10-50x more expensive per minute than async analysis.

| Tier | Voice Minutes/Month | Overage |
|------|---------------------|---------|
| Starter | 60 min | Block or $0.10/min |
| Pro | 180 min | Block or $0.10/min |
| Team | 300 min/user | Block or $0.10/min |

**Show this limit to users.** They'll understand—they're used to Zoom/phone minute limits.

---

## 8) Key Metrics to Track

### Per Account (Monthly)
- Total AI cost (USD)
- Analysis count
- Voice minutes used
- Cost as % of plan price

### Aggregate (Weekly)
- Median cost per account by tier
- % of accounts over soft cap
- Distribution curve (light/normal/heavy/extreme)
- Blended margin by tier

### Alerts
- Account hits 60% of soft cap → Log
- Account hits 80% of soft cap → Slack notification
- Account hits 100% of soft cap → Manual review queue
- Account hits 200% of soft cap → Urgent review

---

## 9) Margin Target Summary

| Tier | Price | Target Cost | Target Margin |
|------|-------|-------------|---------------|
| Starter | $15 | ≤$4.50 | 70% |
| Pro | $30 | ≤$9.00 | 70% |
| Team | $25/seat | ≤$7.50/seat | 70% |

If blended margin drops below 60%, take action (raise prices, lower caps, or throttle).
