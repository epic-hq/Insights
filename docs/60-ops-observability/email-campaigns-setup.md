# Email Campaigns: PostHog + Engage.so Implementation

## Overview

This document details how to implement automated email campaigns using PostHog cohorts for segmentation and Engage.so for delivery.

**Related docs:**
- [Activation Strategy](./activation-strategy.md) - Campaign strategy and messaging
- [PostHog Tracking](./posthog-tracking.md) - Event definitions and cohorts
- [Email Setup](../20-features-prds/features/email.md) - DNS and deliverability

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PostHog    │────▶│   Sync      │────▶│  Engage.so  │
│  Cohorts    │     │   Script    │     │   Lists     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Supabase   │
                    │  (backup)   │
                    └─────────────┘
```

**Flow:**
1. PostHog tracks user behavior → creates cohorts
2. Daily sync script exports cohort members → updates Engage lists
3. Engage.so triggers automations based on list membership
4. Transactional emails sent via existing `sendEmail()` function

---

## PostHog Cohort Configuration

### Required Cohorts for Activation Campaign

Create these in PostHog Dashboard → People → Cohorts:

#### 1. `activation-eligible`
Users who can receive activation campaign emails.

```
Matching users who:
- Signed up more than 7 days ago
- AND do NOT have person property "has_paid_subscription" = true
- AND do NOT have person property "unsubscribed" = true
```

#### 2. `activation-active-light`
Engaged but not power users.

```
Matching users who:
- Performed any event in last 14 days
- AND event count in last 7 days < 10
- AND are in cohort "activation-eligible"
```

#### 3. `activation-stalled`
Created content but not deriving value.

```
Matching users who:
- Performed "interview_added" event ever
- AND have NOT performed "insight_created" event ever
- AND are in cohort "activation-eligible"
```

#### 4. `activation-dormant`
No recent activity.

```
Matching users who:
- Have NOT performed any event in last 14 days
- AND are in cohort "activation-eligible"
```

#### 5. `trial-active`
Currently in Pro trial.

```
Matching users who:
- Have person property "has_pro_trial" = true
- AND person property "trial_end" > now
```

#### 6. `trial-expiring-soon`
Trial ending within 3 days.

```
Matching users who:
- Are in cohort "trial-active"
- AND person property "trial_end" is within 3 days of now
```

#### 7. `trial-expired`
Trial ended, not converted.

```
Matching users who:
- Have person property "has_pro_trial" = true
- AND person property "trial_end" < now
- AND do NOT have person property "has_paid_subscription" = true
```

---

## Engage.so Configuration

### Lists to Create

| List Name | Description | Sync Frequency |
|-----------|-------------|----------------|
| `all-users` | All registered users | Daily |
| `activation-eligible` | Can receive activation emails | Daily |
| `activation-stalled` | Need feature guidance | Daily |
| `activation-dormant` | Win-back targets | Daily |
| `trial-active` | In Pro trial | Hourly |
| `trial-expiring` | Trial ends in 3 days | Hourly |
| `trial-expired` | Trial ended, not paid | Daily |

### Automations to Create

#### Automation 1: Trial Welcome Sequence

**Trigger:** Added to `trial-active` list

**Emails:**
1. **Immediately:** "Your Pro trial is active"
   - Welcome, what's unlocked
   - Quick wins to try today

2. **Day 3:** "Discover Smart Personas"
   - Feature spotlight
   - Step-by-step guide

3. **Day 7:** "Your week in review"
   - Usage stats if available
   - Testimonial/social proof

#### Automation 2: Trial Ending Sequence

**Trigger:** Added to `trial-expiring` list

**Emails:**
1. **Immediately:** "Your trial ends in 3 days"
   - What they'll lose
   - EARLYBIRD25 code

2. **Day 2:** "Last day of Pro access"
   - Urgency
   - Direct upgrade CTA

#### Automation 3: Trial Expired Win-back

**Trigger:** Added to `trial-expired` list

**Emails:**
1. **Day 1:** "Your Pro features are paused"
   - What's now limited
   - Upgrade CTA

2. **Day 7:** "We'd love your feedback"
   - Survey link
   - Alternative: schedule call

3. **Day 14:** "New feature announcement"
   - Product update
   - Final EARLYBIRD25 offer

#### Automation 4: Dormant User Win-back

**Trigger:** Added to `activation-dormant` list

**Emails:**
1. **Immediately:** "We miss you"
   - What's new since they left
   - Quick start CTA

2. **Day 7:** "See what you're missing"
   - Customer success story
   - Trial offer

---

## Sync Script Implementation

Create `scripts/sync-posthog-engage.ts`:

```typescript
/**
 * Sync PostHog cohorts to Engage.so lists
 *
 * Run daily via cron or Trigger.dev scheduled task
 */

import { PostHog } from 'posthog-node'
import wretch from 'wretch'

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const ENGAGE_API_KEY = process.env.ENGAGE_API_KEY
const ENGAGE_API_SECRET = process.env.ENGAGE_API_SECRET

// Cohort ID → Engage List ID mapping
const COHORT_MAPPINGS: Record<string, string> = {
  // Get cohort IDs from PostHog dashboard
  'cohort_123': 'engage_list_abc', // activation-eligible
  'cohort_456': 'engage_list_def', // trial-active
  // ... etc
}

async function getPostHogCohortMembers(cohortId: string): Promise<Array<{email: string, properties: Record<string, unknown>}>> {
  const response = await wretch(`https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/cohorts/${cohortId}/persons`)
    .auth(`Bearer ${POSTHOG_API_KEY}`)
    .get()
    .json()

  return response.results.map((person: any) => ({
    email: person.properties.email,
    properties: person.properties
  })).filter((p: any) => p.email)
}

async function updateEngageList(listId: string, members: Array<{email: string, properties: Record<string, unknown>}>) {
  const credentials = Buffer.from(`${ENGAGE_API_KEY}:${ENGAGE_API_SECRET}`).toString('base64')

  // Engage.so list update API
  await wretch(`https://api.engage.so/v1/lists/${listId}/members`)
    .auth(`Basic ${credentials}`)
    .put({
      members: members.map(m => ({
        email: m.email,
        first_name: m.properties.first_name,
        last_name: m.properties.last_name,
        // Add relevant properties for personalization
        plan: m.properties.plan,
        trial_end: m.properties.trial_end,
        company_name: m.properties.company_name,
      }))
    })
    .json()
}

async function syncCohorts() {
  console.log('Starting PostHog → Engage sync...')

  for (const [cohortId, listId] of Object.entries(COHORT_MAPPINGS)) {
    try {
      const members = await getPostHogCohortMembers(cohortId)
      await updateEngageList(listId, members)
      console.log(`Synced ${members.length} members to list ${listId}`)
    } catch (err) {
      console.error(`Failed to sync cohort ${cohortId}:`, err)
    }
  }

  console.log('Sync complete')
}

// Run
syncCohorts()
```

### Trigger.dev Scheduled Task

Create `src/trigger/sync/posthog-engage-sync.ts`:

```typescript
import { schedules } from "@trigger.dev/sdk/v4"

export const posthogEngageSync = schedules.task({
  id: "posthog-engage-sync",
  cron: "0 */6 * * *", // Every 6 hours
  run: async () => {
    // Import and run sync logic
    const { syncCohorts } = await import("./sync-posthog-engage")
    await syncCohorts()
  }
})
```

---

## Email Templates

### Template Variables Available

From sync, these variables are available in Engage templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{first_name}}` | User's first name | "Sarah" |
| `{{email}}` | User's email | "sarah@acme.com" |
| `{{plan}}` | Current plan | "free" |
| `{{trial_end}}` | Trial end date | "Jan 28, 2026" |
| `{{company_name}}` | Company name | "Acme Inc" |
| `{{days_until_trial_end}}` | Days remaining | "3" |

### Sample Email: Trial Starting

**Subject:** Your 14-day Pro trial is active

**Body:**
```html
Hi {{first_name}},

Welcome to UpSight Pro! For the next 14 days, you have full access to:

✅ Unlimited AI analyses (vs 5/month)
✅ Smart Personas
✅ 60 minutes of voice chat
✅ Custom Lenses

**Quick wins to try today:**

1. Upload an interview and watch themes emerge automatically
2. Generate your first Smart Persona from 3+ interviews
3. Try voice chat for a customer call

Your trial ends on {{trial_end}}. Upgrade anytime to keep Pro features.

[Start Exploring →]

— The UpSight Team
```

---

## Testing Checklist

### Before Launch

- [ ] Create all cohorts in PostHog dashboard
- [ ] Verify cohort logic with test users
- [ ] Create all lists in Engage.so
- [ ] Test sync script with dry-run
- [ ] Create email templates in Engage
- [ ] Set up automations with test triggers
- [ ] Send test emails to internal team
- [ ] Verify unsubscribe links work
- [ ] Check email renders in Gmail, Outlook, Apple Mail

### After Launch

- [ ] Monitor daily sync logs
- [ ] Check email delivery rates in Engage
- [ ] Review PostHog cohort sizes trending
- [ ] Track conversion metrics weekly
- [ ] A/B test subject lines after 100+ sends

---

## Troubleshooting

### Sync Issues

**Problem:** Cohort returns 0 members
- Check cohort definition in PostHog
- Verify events are being tracked
- Check person properties are set correctly

**Problem:** Engage API errors
- Verify API keys are correct
- Check rate limits (Engage has 100 req/min)
- Ensure email format is valid

### Email Delivery Issues

**Problem:** Emails going to spam
- Check DNS records (SPF, DKIM, DMARC)
- Review email content for spam triggers
- Warm up sending domain gradually

**Problem:** Low open rates
- Test subject lines
- Check send times
- Verify emails aren't being clipped (keep <100KB)

---

## Maintenance

### Weekly
- Review email metrics in Engage dashboard
- Check for bounces/complaints
- Update cohort definitions if needed

### Monthly
- Audit list hygiene (remove invalid emails)
- Review automation performance
- Update email content based on feedback

### Quarterly
- Review overall campaign ROI
- Deprecate underperforming automations
- Plan new campaigns based on learnings
