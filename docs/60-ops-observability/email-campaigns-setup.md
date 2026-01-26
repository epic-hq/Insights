# Email Campaigns: PostHog + Brevo Implementation

## Overview

This document details how to implement automated email campaigns using PostHog cohorts for segmentation and Brevo (formerly Sendinblue) for delivery.

**Why Brevo:**
- **Cost-effective**: Free tier (300 emails/day), then $25/mo for 20k emails vs $99/mo alternatives
- **All-in-one**: Transactional + marketing emails in one platform
- **Features**: Email, SMS, automation workflows, CRM, forms, landing pages
- **Proven scale**: Used by major companies (IBM, Microsoft, Toyota)
- **Strong API**: Easy cohort sync with webhooks for event tracking

**Related docs:**
- [Activation Strategy](./activation-strategy.md) - Campaign strategy and messaging
- [PostHog Tracking](./posthog-tracking.md) - Event definitions and cohorts
- [Email Setup](../20-features-prds/features/email.md) - DNS and deliverability

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PostHog    │────▶│   Sync      │────▶│   Brevo     │
│  Cohorts    │     │   Task      │     │   Lists     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Supabase   │
                    │  (source)   │
                    └─────────────┘
```

**Flow:**
1. PostHog tracks user behavior → creates cohorts
2. Scheduled Trigger.dev task syncs cohort members → updates Brevo lists
3. Brevo automation workflows trigger based on list membership
4. Emails sent via Brevo with tracking (opens, clicks, bounces)

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

## Brevo Configuration

### 1. Account Setup

1. Sign up at https://www.brevo.com
2. Verify email and add sending domain (`mail.getupsight.com`)
3. Configure DNS records (SPF, DKIM, DMARC) - see [Email Setup](../20-features-prds/features/email.md)
4. Create API key: Account → SMTP & API → API Keys → Create new key

### 2. Lists to Create

Navigate to Contacts → Lists, create:

| List Name | Description | Update Frequency |
|-----------|-------------|------------------|
| `all-users` | All registered users | Daily |
| `activation-eligible` | Can receive activation emails | Daily |
| `activation-stalled` | Need feature guidance | Daily |
| `activation-dormant` | Win-back targets | Daily |
| `trial-active` | In Pro trial | Every 6 hours |
| `trial-expiring` | Trial ends in 3 days | Every 6 hours |
| `trial-expired` | Trial ended, not paid | Daily |

### 3. Contact Attributes

Set up custom attributes for personalization (Contacts → Settings → Contact Attributes):

| Attribute | Type | Description |
|-----------|------|-------------|
| `USER_ID` | Text | User ID |
| `ACCOUNT_ID` | Text | Account ID |
| `PLAN` | Text | Current plan (free/starter/pro/team) |
| `TRIAL_END` | Date | Trial end date |
| `COMPANY_NAME` | Text | Company name |
| `LIFECYCLE_STAGE` | Text | new/activated/power_user/at_risk/churned |
| `INTERVIEW_COUNT` | Number | Total interviews |
| `TASK_COMPLETED_COUNT` | Number | Tasks completed |

### 4. Automation Workflows

Navigate to Automation → Create a new workflow:

#### Workflow 1: Trial Welcome Sequence

**Entry condition:** Contact added to `trial-active` list

**Steps:**
1. **Day 0 (Immediate):** Send "Your Pro trial is active"
   - Template: `trial-welcome`
   - Subject: "Welcome to UpSight Pro - Your trial starts now"

2. **Day 3:** Send "Discover Smart Personas"
   - Delay: 3 days after entry
   - Template: `trial-day-3-feature-highlight`
   - Subject: "Unlock Smart Personas with 3+ interviews"

3. **Day 7:** Send "Your week in review"
   - Delay: 7 days after entry
   - Template: `trial-day-7-social-proof`
   - Subject: "See how teams are using UpSight"

**Exit condition:** Contact added to list `trial-expired` OR `has_paid_subscription = true`

#### Workflow 2: Trial Ending Sequence

**Entry condition:** Contact added to `trial-expiring` list

**Steps:**
1. **Day 0 (Immediate):** Send "Your trial ends in 3 days"
   - Template: `trial-ending-3-days`
   - Subject: "3 days left - Save 25% with EARLYBIRD25"

2. **Day 2:** Send "Last day of Pro access"
   - Delay: 2 days after entry
   - Template: `trial-ending-last-day`
   - Subject: "Tomorrow: Your Pro features pause"

**Exit condition:** Contact added to list `trial-expired` OR removed from `trial-expiring`

#### Workflow 3: Trial Expired Win-back

**Entry condition:** Contact added to `trial-expired` list

**Steps:**
1. **Day 0 (Immediate):** Send "Your Pro features are paused"
   - Template: `trial-expired-day-0`
   - Subject: "Your Pro features are now paused"

2. **Day 7:** Send "We'd love your feedback"
   - Delay: 7 days after entry
   - Template: `trial-expired-day-7-feedback`
   - Subject: "Quick question: What stopped you from upgrading?"

3. **Day 14:** Send "New feature announcement"
   - Delay: 14 days after entry
   - Template: `trial-expired-day-14-final`
   - Subject: "New: Calendar sync + voice chat improvements"

#### Workflow 4: Dormant User Win-back

**Entry condition:** Contact added to `activation-dormant` list

**Steps:**
1. **Day 0 (Immediate):** Send "We miss you"
   - Template: `dormant-day-0-winback`
   - Subject: "We miss you at UpSight"

2. **Day 7:** Send "See what you're missing"
   - Delay: 7 days after entry
   - Template: `dormant-day-7-success-story`
   - Subject: "How teams are saving 10 hours/week with UpSight"

**Exit condition:** Contact performs any event (tracked via webhook)

---

## Sync Implementation

### Environment Variables

Add to `.env`:

```bash
# Brevo API
BREVO_API_KEY=xkeysib-xxx
BREVO_SENDER_EMAIL=notify@mail.getupsight.com
BREVO_SENDER_NAME="UpSight Team"

# PostHog (already set)
POSTHOG_API_KEY=phc_xxx
POSTHOG_PROJECT_ID=12345
```

### Trigger.dev Scheduled Task

Create `src/trigger/analytics/syncPostHogBrevo.ts`:

```typescript
/**
 * Sync PostHog Cohorts to Brevo Lists
 *
 * Scheduled task that syncs user cohorts from PostHog to Brevo contact lists
 * for automated email campaigns.
 */

import { schedules, schemaTask } from "@trigger.dev/sdk/v3";
import consola from "consola";
import wretch from "wretch";
import { z } from "zod";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY!;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID!;

// PostHog Cohort ID → Brevo List ID mapping
// Get cohort IDs from PostHog dashboard URLs
const COHORT_MAPPINGS: Record<string, number> = {
  // Update these after creating cohorts in PostHog
  // "cohort_abc123": 2,  // activation-eligible
  // "cohort_def456": 3,  // trial-active
  // "cohort_ghi789": 4,  // trial-expiring
};

interface PostHogPerson {
  id: string;
  properties: {
    email: string;
    [key: string]: any;
  };
}

interface BrevoContact {
  email: string;
  attributes: Record<string, any>;
  listIds?: number[];
  updateEnabled?: boolean;
}

/**
 * Fetch members of a PostHog cohort
 */
async function getPostHogCohortMembers(
  cohortId: string,
): Promise<PostHogPerson[]> {
  const url = `https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/cohorts/${cohortId}/persons`;

  const response = await wretch(url)
    .auth(`Bearer ${POSTHOG_API_KEY}`)
    .get()
    .json<{ results: PostHogPerson[] }>();

  return response.results.filter((person) => person.properties.email);
}

/**
 * Add or update contact in Brevo list
 */
async function syncContactToBrevo(
  contact: BrevoContact,
): Promise<{ success: boolean; error?: string }> {
  try {
    await wretch("https://api.brevo.com/v3/contacts")
      .headers({ "api-key": BREVO_API_KEY })
      .post({
        email: contact.email,
        attributes: contact.attributes,
        listIds: contact.listIds || [],
        updateEnabled: true, // Update if exists
      })
      .res();

    return { success: true };
  } catch (error: any) {
    // 400 with "duplicate_parameter" means contact exists - that's ok
    if (
      error?.json?.code === "duplicate_parameter" ||
      error?.status === 400
    ) {
      // Try update instead
      try {
        await wretch(`https://api.brevo.com/v3/contacts/${contact.email}`)
          .headers({ "api-key": BREVO_API_KEY })
          .put({
            attributes: contact.attributes,
            listIds: contact.listIds || [],
          })
          .res();

        return { success: true };
      } catch (updateError: any) {
        return {
          success: false,
          error: updateError?.message || "Update failed",
        };
      }
    }

    return { success: false, error: error?.message || "Unknown error" };
  }
}

/**
 * Sync a single cohort to Brevo list
 */
async function syncCohortToList(
  cohortId: string,
  listId: number,
): Promise<{ synced: number; failed: number }> {
  consola.info(`Syncing cohort ${cohortId} to Brevo list ${listId}...`);

  const members = await getPostHogCohortMembers(cohortId);
  consola.info(`Found ${members.length} members in cohort`);

  let synced = 0;
  let failed = 0;

  for (const person of members) {
    const contact: BrevoContact = {
      email: person.properties.email,
      attributes: {
        USER_ID: person.id,
        ACCOUNT_ID: person.properties.account_id || "",
        PLAN: person.properties.plan || "free",
        TRIAL_END: person.properties.trial_end || null,
        COMPANY_NAME: person.properties.company_name || "",
        LIFECYCLE_STAGE: person.properties.lifecycle_stage || "new",
        INTERVIEW_COUNT: person.properties.interview_count || 0,
        TASK_COMPLETED_COUNT: person.properties.task_completed_count || 0,
      },
      listIds: [listId],
    };

    const result = await syncContactToBrevo(contact);

    if (result.success) {
      synced++;
    } else {
      failed++;
      consola.warn(
        `Failed to sync ${contact.email}: ${result.error}`,
      );
    }

    // Rate limit: Brevo free tier allows 300 requests/day
    // Wait 100ms between requests to be safe
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  consola.success(
    `Cohort sync complete: ${synced} synced, ${failed} failed`,
  );

  return { synced, failed };
}

/**
 * Main sync task - runs every 6 hours
 */
export const syncPostHogBrevoTask = schedules.task({
  id: "analytics.sync-posthog-brevo",
  cron: "0 */6 * * *", // Every 6 hours
  run: async () => {
    consola.info("[sync-posthog-brevo] Starting cohort sync to Brevo");

    if (Object.keys(COHORT_MAPPINGS).length === 0) {
      consola.warn(
        "[sync-posthog-brevo] No cohort mappings configured. Update COHORT_MAPPINGS in syncPostHogBrevo.ts",
      );
      return {
        success: false,
        error: "No cohort mappings configured",
      };
    }

    const results: Array<{
      cohortId: string;
      listId: number;
      synced: number;
      failed: number;
    }> = [];

    for (const [cohortId, listId] of Object.entries(COHORT_MAPPINGS)) {
      try {
        const result = await syncCohortToList(cohortId, listId);
        results.push({ cohortId, listId, ...result });
      } catch (error) {
        consola.error(
          `[sync-posthog-brevo] Error syncing cohort ${cohortId}:`,
          error,
        );
        results.push({
          cohortId,
          listId,
          synced: 0,
          failed: -1,
        });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    consola.success(
      `[sync-posthog-brevo] Sync complete: ${totalSynced} synced, ${totalFailed} failed`,
    );

    return {
      success: true,
      totalSynced,
      totalFailed,
      results,
    };
  },
});
```

### Update Analytics Index

Add to `src/trigger/analytics/index.ts`:

```typescript
export { syncPostHogBrevoTask } from "./syncPostHogBrevo";
```

---

## Email Templates

### Template Variables

Available in all Brevo templates (use `{{ contact.ATTRIBUTE_NAME }}`):

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ contact.FIRSTNAME }}` | First name | "Sarah" |
| `{{ contact.EMAIL }}` | Email address | "sarah@acme.com" |
| `{{ contact.PLAN }}` | Current plan | "free" |
| `{{ contact.TRIAL_END }}` | Trial end date | "2026-02-01" |
| `{{ contact.COMPANY_NAME }}` | Company name | "Acme Inc" |
| `{{ contact.INTERVIEW_COUNT }}` | Total interviews | "5" |
| `{{ contact.TASK_COMPLETED_COUNT }}` | Completed tasks | "3" |

### Sample Template: Trial Welcome (Day 0)

**Template name:** `trial-welcome`
**Subject:** Welcome to UpSight Pro - Your trial starts now

**HTML Body:**
```html
<p>Hi {{ contact.FIRSTNAME | default: "there" }},</p>

<p>Welcome to UpSight Pro! For the next 14 days, you have full access to:</p>

<ul>
  <li>✅ Unlimited AI analyses (vs 5/month on Free)</li>
  <li>✅ Smart Personas generation</li>
  <li>✅ 60 minutes of voice chat with AI</li>
  <li>✅ Custom Conversation Lenses</li>
</ul>

<h3>Quick wins to try today:</h3>

<ol>
  <li><strong>Upload an interview</strong> and watch themes emerge automatically</li>
  <li><strong>Generate your first Smart Persona</strong> from 3+ interviews</li>
  <li><strong>Try voice chat</strong> for a customer call recording</li>
</ol>

<p>Your trial ends on <strong>{{ contact.TRIAL_END | date: "%B %d, %Y" }}</strong>. Upgrade anytime to keep Pro features.</p>

<p style="margin-top: 30px;">
  <a href="https://getupsight.com/app" style="background: #0066ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Exploring →</a>
</p>

<p style="margin-top: 40px; color: #666; font-size: 14px;">
  — The UpSight Team<br>
  <a href="mailto:support@getupsight.com">support@getupsight.com</a>
</p>

<p style="margin-top: 20px; color: #999; font-size: 12px;">
  Don't want these emails? <a href="{{ unsubscribe }}">Unsubscribe</a>
</p>
```

---

## Testing Checklist

### Before Launch

- [ ] Create Brevo account and verify domain
- [ ] Configure DNS records (SPF, DKIM, DMARC)
- [ ] Create all contact lists in Brevo
- [ ] Set up custom contact attributes
- [ ] Create all cohorts in PostHog dashboard
- [ ] Get cohort IDs from PostHog URLs and update `COHORT_MAPPINGS`
- [ ] Test sync script with 1-2 test users
- [ ] Create email templates in Brevo
- [ ] Set up automation workflows
- [ ] Send test emails to internal team
- [ ] Verify unsubscribe links work
- [ ] Check email renders in Gmail, Outlook, Apple Mail

### After Launch

- [ ] Monitor sync task logs in Trigger.dev
- [ ] Check email delivery rates in Brevo dashboard
- [ ] Review PostHog cohort sizes trending
- [ ] Track conversion metrics weekly
- [ ] A/B test subject lines after 100+ sends

---

## Monitoring & Optimization

### Key Metrics (Track in Brevo)

| Metric | Target | Where to Find |
|--------|--------|---------------|
| Delivery rate | >98% | Statistics → Email campaigns |
| Open rate | >25% | Statistics → Email campaigns |
| Click rate | >5% | Statistics → Email campaigns |
| Unsubscribe rate | <0.5% | Statistics → Email campaigns |
| Bounce rate | <2% | Contacts → Invalid contacts |

### Weekly Tasks

1. Review Brevo statistics dashboard
2. Check for hard bounces and remove invalid emails
3. Monitor automation workflow performance
4. Update cohort definitions if needed

### Monthly Tasks

1. Review email content based on feedback
2. A/B test subject lines and CTAs
3. Analyze conversion funnel (email → upgrade)
4. Deprecate underperforming workflows

---

## Troubleshooting

### Sync Issues

**Problem:** Cohort returns 0 members
- Check cohort definition in PostHog
- Verify events are being tracked
- Check person properties are set correctly (run `updateUserMetricsTask` manually)

**Problem:** Brevo API errors
- Verify API key is correct
- Check rate limits (free tier: 300 emails/day)
- Ensure email format is valid
- Check Trigger.dev logs for detailed errors

### Email Delivery Issues

**Problem:** Emails going to spam
- Verify DNS records (SPF, DKIM, DMARC) in Brevo dashboard
- Review email content for spam triggers (too many links, all caps subject)
- Warm up sending domain gradually (start with 50 emails/day, increase 20% daily)
- Check sender reputation with mail-tester.com

**Problem:** Low open rates
- Test different subject lines (A/B test in Brevo)
- Check send times (best: Tue-Thu 10am-2pm)
- Verify emails aren't being clipped (keep <100KB)
- Ensure "from" name is recognizable ("UpSight Team" not "noreply")

**Problem:** High unsubscribe rate
- Review email frequency (max 2/week per user)
- Check content relevance (wrong cohort targeting?)
- Ensure value in every email (not just "upgrade now")

---

## Cost Planning

### Brevo Pricing Tiers

| Plan | Monthly Cost | Emails/Month | Contacts | Features |
|------|-------------|--------------|----------|----------|
| Free | $0 | 300/day (9k/month) | Unlimited | Email + automations |
| Starter | $25 | 20,000 | Unlimited | + A/B testing, advanced stats |
| Business | $65 | 20,000 | Unlimited | + Send time optimization, phone support |

### Recommendation

Start with **Free tier** until you exceed 300 emails/day, then upgrade to **Starter** ($25/mo).

**Estimated costs:**
- 100 users × 3 emails/week = 1,200 emails/month → Free tier
- 500 users × 3 emails/week = 6,000 emails/month → Free tier
- 1,000 users × 3 emails/week = 12,000 emails/month → Starter ($25/mo)

---

## Next Steps

1. **Set up Brevo account** (~30 min)
   - Sign up, verify domain, configure DNS

2. **Create PostHog cohorts** (~20 min)
   - Use definitions above

3. **Implement sync task** (~1 hour)
   - Copy code above, update mappings, test

4. **Create email templates** (~3 hours)
   - Write 10 emails based on sample above

5. **Set up automations** (~1 hour)
   - Configure workflows in Brevo

6. **Test end-to-end** (~1 hour)
   - Add yourself to test cohort, verify emails send

**Total setup time:** ~7 hours to go live
