# Activation Strategy: Existing User Monetization

## Executive Summary

Convert 30 existing signups to paid plans through a **reverse trial + early adopter discount** strategy, leveraging PostHog cohorts for segmentation and Engage.so for automated email campaigns.

---

## 1. User Segmentation

Based on PostHog data, segment the 30 users into actionable cohorts:

| Segment | Definition | Estimated % | Primary Intervention |
|---------|-----------|-------------|---------------------|
| **Active Light** | Used in last 14 days, <5 events | ~30% | Feature discovery emails |
| **Stalled** | Created project, no insights | ~25% | Aha-moment acceleration |
| **Dormant** | No events in 14+ days | ~35% | Win-back campaign |
| **Never Activated** | Signed up, 0 meaningful actions | ~10% | Fresh start onboarding |

Use PostHog cohorts already defined:
- `lc-active-7d` → Active Light
- `lc-stalled-no-insight` → Stalled
- `lc-dormant-14d` → Dormant
- `lc-stalled-no-project` → Never Activated

---

## 2. Reverse Trial Strategy

### What Is Reverse Trial?
Unlike traditional free trials (full access → paywall), reverse trials:
1. Keep users on free tier initially
2. **Grant temporary Pro access** after demonstrating engagement
3. Let them experience premium value
4. Convert at trial end

### Why Reverse Trial Works

| Traditional Trial | Reverse Trial |
|------------------|---------------|
| 3-5% conversion | 15-25% conversion |
| Users forget to use | Users already engaged |
| "I'll try it later" | "I'm losing this" |

**Industry evidence:**
- Airtable: Reverse trial increased conversion 3x vs immediate trial
- Notion: "Earned" trial after team collaboration doubled retention
- Miro: Triggered trial after 5th board creation = 40% higher conversion

### UpSight Reverse Trial Design

**Trigger conditions** (grant Pro trial when user hits ANY):
- Creates 2nd project
- Uploads 3rd interview
- Views themes/insights 5+ times
- Invites a team member

**Trial duration:** 14 days

**What they unlock:**
- Unlimited AI analyses (vs 5/month)
- Smart Personas
- Voice chat (60 min)
- Custom Lenses

---

## 3. Early Adopter Discount

### Discount Structure

| Tier | Discount | Conditions |
|------|----------|------------|
| **Founding Member** | 40% lifetime | First 20 to upgrade |
| **Early Adopter** | 25% first year | Within launch week |
| **Standard** | 0% | After launch |

### Why This Works

1. **Scarcity** - Limited founding slots create urgency
2. **Social proof** - "Join 15 other founding members"
3. **Lifetime value** - 40% discount still profitable at scale
4. **Lock-in** - Discount contingent on annual billing

### Discount Code Implementation

Create in Polar:
- `FOUNDING40` - 40% off, limited to 20 uses, annual only
- `EARLYBIRD25` - 25% off first year, expires in 7 days

---

## 4. Activation Campaign Flow

### Phase 1: Pre-Launch Warm-Up (Days -7 to -1)

**Goal:** Build anticipation, gather feedback

| Day | Email | Cohort | CTA |
|-----|-------|--------|-----|
| -7 | "We're launching something new" | All 30 | Reply with feedback |
| -3 | "Sneak peek: Pro features" | Active + Stalled | Watch video |
| -1 | "Tomorrow: Founding member spots" | All 30 | Mark calendar |

### Phase 2: Launch (Day 0)

**Goal:** Drive immediate upgrades

| Hour | Email | Cohort | Offer |
|------|-------|--------|-------|
| 0 | "Pro is live - Founding spots open" | All 30 | FOUNDING40 |
| +6 | "Only 12 founding spots left" | Non-openers | FOUNDING40 |
| +24 | "48 hours left for founding rate" | Non-converters | FOUNDING40 |

### Phase 3: Reverse Trial Activation (Days 2-14)

**Goal:** Get dormant users to experience value

| Trigger | Email | Action |
|---------|-------|--------|
| User logs in | "Your Pro trial is ready" | Auto-grant 14-day Pro |
| Day 3 of trial | "Try Smart Personas" | Feature tutorial |
| Day 7 of trial | "You've saved 2 hours this week" | Usage stats |
| Day 12 of trial | "Your trial ends in 2 days" | EARLYBIRD25 offer |
| Trial expired | "Pro features paused" | Downgrade + offer |

### Phase 4: Win-Back (Days 15-30)

**Goal:** Recover non-converters

| Day | Email | Cohort | Angle |
|-----|-------|--------|-------|
| 15 | "We noticed you didn't upgrade" | Trial expired | Ask why (survey) |
| 21 | "New feature: [highlight]" | All dormant | Product update |
| 30 | "Last chance: 25% off" | Non-converters | Final EARLYBIRD25 |

---

## 5. Metrics & Success Criteria

### Primary KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Upgrade rate** | 25% (7-8 users) | Paid subs / 30 users |
| **Trial activation** | 60% | Started trial / eligible |
| **Trial → Paid** | 40% | Converted / trial users |
| **Email open rate** | >40% | Opens / delivered |
| **Click rate** | >8% | Clicks / delivered |

### Secondary KPIs

- Average discount used (lower = better)
- Time to upgrade from trial start
- Churn rate at 30 days post-upgrade
- Feature adoption during trial

---

## 6. Risk Mitigation

### Risk: Users wait for discount
**Mitigation:** Clear expiration, genuine scarcity (track codes in Polar)

### Risk: Reverse trial fatigue
**Mitigation:** Only trigger once per user, require real engagement

### Risk: Discount attracts low-value users
**Mitigation:** Require annual billing for FOUNDING40, monthly gets 25% max

### Risk: Email fatigue / unsubscribes
**Mitigation:** Max 2 emails/week, easy frequency controls, segment by engagement

---

## 7. Technical Implementation

### PostHog Setup

1. Create cohorts:
   ```
   lc-trial-eligible: (lc-active-7d OR lc-stalled-no-insight) AND NOT has_paid_subscription
   lc-trial-active: has_pro_trial = true AND trial_end > now()
   lc-trial-expired: has_pro_trial = true AND trial_end < now() AND NOT has_paid_subscription
   ```

2. Set person properties on trial grant:
   ```typescript
   posthog.capture('trial_started', { plan: 'pro', duration_days: 14 })
   posthog.people.set({
     has_pro_trial: true,
     trial_start: new Date().toISOString(),
     trial_end: addDays(new Date(), 14).toISOString()
   })
   ```

### Engage.so Campaigns

1. **Lists:** Sync from PostHog cohorts via API or CSV export
2. **Automations:**
   - Trial welcome sequence (3 emails)
   - Trial ending sequence (2 emails)
   - Win-back sequence (3 emails)
3. **Broadcasts:** Launch day, weekly product updates

### Database Changes

Add to `accounts` table:
```sql
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'pro';
```

---

## 8. Timeline

| Week | Activity |
|------|----------|
| **Week 1** | Set up PostHog cohorts, create Engage campaigns |
| **Week 2** | Create discount codes in Polar, test trial flow |
| **Week 3** | Pre-launch warm-up emails |
| **Week 4** | Launch, monitor metrics daily |
| **Week 5-6** | Reverse trial phase, iterate on messaging |
| **Week 7** | Win-back phase, final analysis |

---

## 9. Critique & Improvements

### Potential Weaknesses

1. **30 users is small sample** - Statistical significance is limited
   - **Improvement:** Focus on qualitative feedback alongside metrics; use this as learning for larger cohorts

2. **Reverse trial requires engagement** - Dormant users won't trigger
   - **Improvement:** For true dormant, send "Here's what you're missing" email with direct trial grant link

3. **Email-only approach** - Ignores in-app
   - **Improvement:** Add in-app upgrade prompts, trial countdown banner

4. **No personalization** - Generic messaging
   - **Improvement:** Personalize based on user role (from onboarding), industry, usage patterns

5. **40% lifetime discount is aggressive** - May devalue product
   - **Improvement:** Limit to 20 truly founding users, make it annual-only, frame as "investment" in product

### Industry Benchmarks to Beat

| Metric | Industry Average | Our Target |
|--------|-----------------|------------|
| Free → Paid | 2-5% | 25% |
| Trial → Paid | 15-25% | 40% |
| Email open | 20-25% | 40% |
| Churn (30-day) | 5-8% | <5% |

---

## 10. Feature Gate Implementation

Feature gates control access to premium features based on the account's plan. This is critical for the monetization strategy.

### Existing Infrastructure

| Component | Purpose | Location |
|-----------|---------|----------|
| `PLANS` config | Plan definitions, limits, features | `app/config/plans.ts` |
| `hasFeature()` | Check boolean features | `app/config/plans.ts` |
| `<FeatureGate>` | Client-side UI wrapper | `app/components/feature-gate/FeatureGate.tsx` |
| `useFeatureGate()` | Client-side hook | `app/hooks/useFeatureGate.ts` |
| `checkFeatureAccess()` | Server-side feature check | `app/lib/feature-gate/check-feature.server.ts` |
| `checkLimitAccess()` | Server-side usage limits | `app/lib/feature-gate/check-limit.server.ts` |
| `FeatureGateError` | Error handling | `app/lib/feature-gate/errors.ts` |

### Current Gate Implementations

| Feature | Type | Location | Implementation |
|---------|------|----------|----------------|
| Calendar Sync | Boolean | `api.calendar.connect.tsx:64` | `hasFeature(planId, "calendar_sync")` |
| Smart Personas | Boolean | `personas/pages/index.tsx:182` | `useFeatureGate("smart_personas", planId)` |
| AI CRM | Boolean | `accounts/pages/settings.tsx` | Checks for `ai_crm` feature |
| Embed Links | Boolean | `embed.$slug.tsx` | Plan check for survey embeds |
| Welcome Upgrade | Boolean | `welcome-upgrade.tsx:48` | `hasFeature(planId, "calendar_sync")` |

### Gates to Implement

#### Boolean Features (Gate on/off)

| Feature | Where to Gate | Plan Required | Priority |
|---------|---------------|---------------|----------|
| **Smart Personas** | Generate button | Starter+ | ✅ Done |
| **Calendar Sync** | Connect flow | Starter+ | ✅ Done |
| **Team Workspace** | Invite members | Pro+ | P1 |
| **SSO/SAML** | Settings page | Team | P2 |
| **White Label** | Settings/embed | Team | P2 |
| **Custom Lenses** | Lens creation | Pro+ | P1 |
| **Interview Guide** | Guide feature | Free+ | N/A (always on) |

#### Usage Limits (Gate at threshold)

| Limit | Where to Gate | Free | Starter | Pro | Team |
|-------|---------------|------|---------|-----|------|
| **AI Analyses** | Upload/process flow | 5/mo | 30/mo | Unlimited | Unlimited |
| **Voice Minutes** | Voice chat start | 5 min | 60 min | 180 min | Unlimited |
| **Survey Responses** | Embed submission | 10/mo | 100/mo | 500/mo | Unlimited |
| **Projects** | Project creation | 1 | 3 | 10 | Unlimited |

### Implementation Pattern

#### Client-Side (UI)

```tsx
// For showing/hiding features
import { FeatureGate } from "~/components/feature-gate"

<FeatureGate feature="smart_personas" planId={currentPlan}>
  <PersonaGenerator />
</FeatureGate>

// For conditional logic
import { useFeatureGate } from "~/hooks/useFeatureGate"

const { isEnabled, upgradeUrl } = useFeatureGate("calendar_sync", planId)
if (!isEnabled) {
  return <UpgradeBadge href={upgradeUrl} />
}
```

#### Server-Side (API)

```tsx
// For feature checks in API routes
import { checkFeatureAccess } from "~/lib/feature-gate/check-feature.server"

const result = await checkFeatureAccess({ planId, accountId }, "smart_personas")
if (!result.allowed) {
  return json({ error: "upgrade_required", ...result }, { status: 403 })
}

// For usage limit checks
import { checkLimitAccess } from "~/lib/feature-gate/check-limit.server"

const result = await checkLimitAccess({ planId, accountId }, "ai_analyses")
if (!result.allowed) {
  return json({ error: "limit_exceeded", ...result }, { status: 403 })
}
```

### Priority Implementation Tasks

1. **P0 - AI Analysis Limit**
   - Gate at interview upload/processing
   - Show warning at 80% usage
   - Block new analyses at 100%

2. **P0 - Project Limit**
   - Gate at project creation
   - Show upgrade prompt when limit reached

3. **P1 - Team Workspace Gate**
   - Gate at member invite
   - Show upgrade for teams features

4. **P2 - Voice Minutes Tracking**
   - Track duration in `billing.usage_events`
   - Gate when minutes exhausted

---

## Next Steps

1. [ ] Export 30 users with engagement data from PostHog
2. [ ] Create cohort segments in PostHog dashboard
3. [ ] Set up discount codes in Polar (FOUNDING40, EARLYBIRD25)
4. [ ] Draft email copy for each campaign phase
5. [ ] Configure Engage.so lists and automations
6. [ ] Add trial columns to database schema
7. [ ] Build trial grant/revoke logic in app
8. [ ] Schedule pre-launch emails
