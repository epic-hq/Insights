# Email Campaigns: PostHog + Brevo Implementation

## Overview

This document details how to implement automated email campaigns using PostHog cohorts for segmentation and Brevo (formerly Sendinblue) for delivery.
For the canonical plan, see `/docs/70-PLG/nurture/plan.md`.

**Why Brevo:**
- **Cost-effective**: Free tier (300 emails/day), then $25/mo for 20k emails vs $99/mo alternatives
- **All-in-one**: Transactional + marketing emails in one platform
- **Features**: Email, SMS, automation workflows, CRM, forms, landing pages
- **Proven scale**: Used by major companies (IBM, Microsoft, Toyota)
- **Strong API**: Easy cohort sync with webhooks for event tracking

**Related docs:**
- [Activation Strategy](../strategy/activation-strategy.md) - Campaign strategy and messaging
- [PostHog Tracking](../../60-ops-observability/posthog-tracking.md) - Event definitions and cohorts
- [Email Setup](../../20-features-prds/features/email.md) - DNS and deliverability

---

## Architecture

```
┌─────────────┐                          ┌─────────────┐
│  PostHog    │──────────────────────────▶│   Brevo     │
│  Events     │   Native CDP Destination │   Contacts  │
└─────────────┘                          └─────────────┘
       │                                         │
       │ cohorts                                 │ lists
       ▼                                         ▼
┌─────────────┐                          ┌─────────────┐
│  Cohorts    │                          │Automations  │
│  (filters)  │                          │ (workflows) │
└─────────────┘                          └─────────────┘
```

**Flow:**
1. PostHog tracks user behavior → fires events
2. **PostHog CDP sends events to Brevo** (native destination, real-time)
3. Brevo creates/updates contacts automatically
4. Brevo automation workflows trigger based on contact attributes or list membership
5. Emails sent via Brevo with tracking (opens, clicks, bounces)

**Why use PostHog's native Brevo destination:**
- ✅ Real-time updates (not batch sync)
- ✅ Zero code to maintain
- ✅ Built-in by PostHog, more reliable
- ✅ Automatic person property mapping

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

## PostHog → Brevo Integration Setup

### ✅ Already Configured!

The PostHog native Brevo destination is already set up and working (39 triggers in last 7 days).

**Current configuration:**
- **Status:** Enabled
- **Email field:** `{person.properties.email}`
- **Attributes mapped:**
  - FIRSTNAME → `{person.properties.firstname}`
  - LASTNAME → `{person.properties.lastname}`
  - EMAIL → `{person.properties.email}`
- **Filters:** Internal and test users filtered out
- **Trigger:** On "Identify" and "Set person properties" events

### Adding More Attribute Mappings

To add more attributes for email personalization:

1. Go to PostHog → **Data Pipeline** → **Destinations** → **Brevo**
2. Click **Edit** next to the Brevo destination
3. Under **Attributes** section, click **+ Add entry**
4. Add mappings for:

| Brevo Attribute | PostHog Property | Purpose |
|-----------------|------------------|---------|
| `USER_ID` | `{person.properties.user_id}` | Unique user identifier |
| `ACCOUNT_ID` | `{person.properties.account_id}` | Account grouping |
| `PLAN` | `{person.properties.plan}` | Current subscription plan |
| `TRIAL_END` | `{person.properties.trial_end}` | Trial expiration date |
| `COMPANY_NAME` | `{person.properties.company_name}` | Company for B2B personalization |
| `LIFECYCLE_STAGE` | `{person.properties.lifecycle_stage}` | new/activated/power_user/at_risk/churned |
| `INTERVIEW_COUNT` | `{person.properties.interview_count}` | Total interviews created |
| `TASK_COMPLETED_COUNT` | `{person.properties.task_completed_count}` | Tasks completed |

**Note:** These properties are set by the `updateUserMetricsTask` (runs daily at 2am UTC). New users will have these attributes populated within 24 hours of signup.

---

## Brevo → PostHog Webhook (Email Events)

To track email engagement (opens, clicks, bounces) in PostHog, configure a webhook in Brevo.

### Setup Instructions

1. Go to Brevo Dashboard → **Settings** → **Webhooks** (or visit https://app.brevo.com/settings/webhooks)
2. Click **Add a new webhook**
3. Configure webhook:
   - **URL:** `https://getupsight.com/api/webhooks/brevo`
   - **Description:** "PostHog email engagement tracking"
   - **Events to track:**
     - ✅ `opened` - Email opened
     - ✅ `click` - Link clicked
     - ✅ `hardBounce` - Hard bounce (invalid email)
     - ✅ `softBounce` - Soft bounce (temporary failure)
     - ✅ `unsubscribed` - User unsubscribed
     - ✅ `spam` - Marked as spam
   - **Webhook type:** Both Marketing and Transactional (to track nurture campaigns + Supabase auth emails)
4. Save webhook

### Events Sent to PostHog

| Brevo Event | PostHog Event | Properties |
|-------------|---------------|------------|
| `opened`, `uniqueOpened` | `email_opened` | email, campaign_name, timestamp |
| `click` | `email_clicked` | email, campaign_name, clicked_url, timestamp |
| `hardBounce`, `softBounce` | `email_bounced` | email, campaign_name, bounce_type, timestamp |
| `unsubscribed` | `email_unsubscribed` | email, campaign_name, timestamp |
| `spam` | `email_spam` | email, campaign_name, timestamp |

**Note:** Events use email address as `distinct_id` in PostHog. PostHog will automatically merge these events with existing user profiles created by the native Brevo destination.

### Testing

After configuring the webhook:

1. Send a test email from Brevo (Campaigns → Test emails)
2. Open the email and click a link
3. Check PostHog → Events → Live events (within 1-2 minutes)
4. Verify `email_opened` and `email_clicked` events appear

### Troubleshooting

**Webhook not receiving events:**
- Check webhook status in Brevo dashboard (should show "Active")
- Verify URL is correct: `https://getupsight.com/api/webhooks/brevo`
- Check application logs for webhook errors: `fly logs -a insights-app`

**Events not appearing in PostHog:**
- Verify POSTHOG_API_KEY and POSTHOG_HOST are configured
- Check application logs for PostHog capture errors
- Ensure email address matches a user in PostHog

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
- [ ] Set up custom contact attributes in Brevo
- [ ] Add attribute mappings to PostHog Brevo destination
- [ ] Create all cohorts in PostHog dashboard
- [ ] Configure Brevo → PostHog webhook for email events
- [ ] Test webhook with a test email (verify events in PostHog)
- [ ] Create email templates in Brevo
- [ ] Set up automation workflows
- [ ] Send test emails to internal team
- [ ] Verify unsubscribe links work
- [ ] Check email renders in Gmail, Outlook, Apple Mail

### After Launch

- [ ] Monitor webhook activity in Brevo dashboard (Settings → Webhooks)
- [ ] Check email events appearing in PostHog (Events → Live events)
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
