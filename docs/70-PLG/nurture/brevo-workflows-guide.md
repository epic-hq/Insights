# Brevo Workflows Setup Guide

> **Why Workflows, not Sequences:** Brevo "Sequences" is a sales CRM feature ($65/mo Sales Advanced).
> Brevo "Automations / Workflows" is the email automation engine — available on Free and Starter ($9/mo).
> This guide uses Workflows only.

**Related docs:**
- [Email content (all 18 templates)](./email-sequences.md)
- [Full system architecture + PostHog cohorts](./brevo-setup.md)
- [Canonical plan](./plan.md)

---

## Prerequisites

Complete these before building workflows:

- [ ] PostHog → Brevo native destination is active (already confirmed: 39 triggers in last 7 days)
- [ ] Add missing attribute mappings in PostHog → Data Pipeline → Destinations → Brevo → Edit:
  - `LIFECYCLE_STAGE` → `{person.properties.lifecycle_stage}`
  - `INTERVIEW_COUNT` → `{person.properties.interview_count}`
  - `TASK_COMPLETED_COUNT` → `{person.properties.task_completed_count}`
  - `PLAN` → `{person.properties.plan}`
  - `TRIAL_END` → `{person.properties.trial_end}`
  - `IS_ACTIVATED` → `{person.properties.is_activated}`
  - `DAYS_SINCE_LAST_ACTIVITY` → `{person.properties.days_since_last_activity}`
  - `IS_POWER_USER` → `{person.properties.is_power_user}`
  - `TEAM_SIZE` → `{person.properties.team_size}`
  - `DATA_INGESTED` → `{person.properties.data_ingested}`
  - `HAS_PRO_TRIAL` → `{person.properties.has_pro_trial}`
  - `HAS_PAID_SUBSCRIPTION` → `{person.properties.has_paid_subscription}`
- [ ] Create those attributes first in Brevo: Contacts → Settings → Contact Attributes → + New Attribute

---

## How Brevo Workflows Work

```
Entry condition met?
    ↓ yes
Contact enters workflow
    ↓
Step 1: Send Email
    ↓
Wait X days
    ↓
Check exit condition → if met, remove from workflow
    ↓
Step 2: Send Email
    ↓
...
```

**Key settings per workflow:**
- **Entry condition** — what triggers a contact entering
- **Re-entry** — set to NO (contacts should only enter once per sequence)
- **Exit condition** — stop the sequence when goal is met (e.g. user activates)
- **Unsubscribe** — Brevo handles automatically

---

## Workflow 1: Welcome & First Data

**Path:** Automations → Create a workflow → Start from scratch

### Entry
- Trigger: **"Contact attribute is updated"**
- Condition: `DAYS_SINCE_SIGNUP` is greater than or equal to `0`
- Re-entry: **No**

### Exit condition
Add an exit rule: `DATA_INGESTED` greater than or equal to `1`
(Contact exits if they add an interview or survey — sequence achieved its goal)

### Steps

```
[ENTRY: days_since_signup >= 0]
    ↓
[SEND EMAIL] "welcome-context-setup"
  Subject: Welcome to UpSight — let's capture your first insight
  (content: email-sequences.md § Email 1.1)
    ↓
[WAIT] 2 days
    ↓
[CONDITION] DATA_INGESTED >= 1?
  → Yes: END (goal achieved)
  → No: continue
    ↓
[SEND EMAIL] "welcome-survey-cta"
  Subject: The fastest way to get insights? A 2-minute survey
  (content: email-sequences.md § Email 1.2)
    ↓
[WAIT] 2 days
    ↓
[CONDITION] DATA_INGESTED >= 1?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "welcome-concierge-import"
  Subject: Need help importing your existing research?
  (content: email-sequences.md § Email 1.3)
    ↓
[WAIT] 1 day
    ↓
[SEND EMAIL] "welcome-video-demo"
  Subject: See UpSight in action (90-second demo)
  (content: email-sequences.md § Email 1.4)
    ↓
[END]
```

---

## Workflow 2: Aha Activation

**Path:** Automations → Create a workflow → Start from scratch

### Entry
- Trigger: **"Contact attribute is updated"**
- Condition: `DATA_INGESTED` >= 1 AND `IS_ACTIVATED` = false AND `DAYS_SINCE_SIGNUP` >= 7
- Re-entry: **No**

### Exit condition
`INSIGHT_COUNT` >= 1

### Steps

```
[ENTRY: data_ingested >= 1, is_activated = false, days_since_signup >= 7]
    ↓
[SEND EMAIL] "aha-insight-checklist"
  Subject: You're one step away from your first insight
  (content: email-sequences.md § Email 2.1)
    ↓
[WAIT] 3 days
    ↓
[CONDITION] INSIGHT_COUNT >= 1?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "aha-ai-draft-offer"
  Subject: Let AI write your first insight (you just approve)
  (content: email-sequences.md § Email 2.2)
    ↓
[WAIT] 4 days
    ↓
[CONDITION] INSIGHT_COUNT >= 1?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "aha-success-story"
  Subject: How [Company] turned 5 interviews into a product decision
  (content: email-sequences.md § Email 2.3)
    ↓
[END]
```

---

## Workflow 3: Power User Expansion

**Path:** Automations → Create a workflow → Start from scratch

### Entry
- Trigger: **"Contact attribute is updated"**
- Condition: `IS_POWER_USER` = true AND `TEAM_SIZE` = 1
- Re-entry: **No**

### Exit condition
`TEAM_SIZE` >= 2

### Steps

```
[ENTRY: is_power_user = true, team_size = 1]
    ↓
[WAIT] 21 days   ← let them be a power user for a bit first
    ↓
[CONDITION] TEAM_SIZE >= 2?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "expansion-impact-stats"
  Subject: You've saved time this month — here's your impact
  (content: email-sequences.md § Email 3.1)
    ↓
[WAIT] 7 days
    ↓
[CONDITION] TEAM_SIZE >= 2?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "expansion-team-roi"
  Subject: What if everyone on your team could search customer conversations?
  (content: email-sequences.md § Email 3.2)
    ↓
[WAIT] 7 days
    ↓
[CONDITION] TEAM_SIZE >= 2?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "expansion-invite-offer"
  Subject: Invite 2 teammates — we'll extend your trial
  (content: email-sequences.md § Email 3.3)
    ↓
[END]
```

---

## Workflow 4: Churn Rescue

**Path:** Automations → Create a workflow → Start from scratch

### Entry
- Trigger: **"Contact attribute is updated"**
- Condition: `IS_ACTIVATED` = true AND `DAYS_SINCE_LAST_ACTIVITY` >= 14
- Re-entry: **No** (don't re-enter if they go dormant again within same period)

### Exit condition
`DAYS_SINCE_LAST_ACTIVITY` = 0 (any activity resets this)

### Steps

```
[ENTRY: is_activated = true, days_since_last_activity >= 14]
    ↓
[SEND EMAIL] "rescue-friendly-checkin"
  Subject: Quick question, {{ contact.FIRSTNAME | default: "there" }}
  (content: email-sequences.md § Email 4.1)
    ↓
[WAIT] 4 days
    ↓
[CONDITION] DAYS_SINCE_LAST_ACTIVITY = 0?
  → Yes: END (they came back)
  → No: continue
    ↓
[SEND EMAIL] "rescue-meeting-bot"
  Subject: What if insights captured themselves?
  (content: email-sequences.md § Email 4.2)
    ↓
[WAIT] 6 days
    ↓
[CONDITION] DAYS_SINCE_LAST_ACTIVITY = 0?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "rescue-last-project"
  Subject: Your research project is waiting
  (content: email-sequences.md § Email 4.3)
    ↓
[WAIT] 4 days
    ↓
[CONDITION] DAYS_SINCE_LAST_ACTIVITY = 0?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "rescue-final-offer"
  Subject: Before we stop emailing you...
  (content: email-sequences.md § Email 4.4)
    ↓
[END]
```

---

## Workflow 5: Trial Conversion

**Path:** Automations → Create a workflow → Start from scratch

### Entry
- Trigger: **"Contact attribute is updated"**
- Condition: `HAS_PRO_TRIAL` = true
- Re-entry: **No**

### Exit condition
`HAS_PAID_SUBSCRIPTION` = true

### Steps

```
[ENTRY: has_pro_trial = true]
    ↓
[WAIT until date] TRIAL_END - 7 days
  (use "Wait until a specific date" with offset: -7 days from TRIAL_END attribute)
    ↓
[CONDITION] HAS_PAID_SUBSCRIPTION = true?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "trial-value-recap"
  Subject: Your Pro trial: Here's what you've unlocked
  (content: email-sequences.md § Email 5.1)
    ↓
[WAIT] 4 days   ← now 3 days before TRIAL_END
    ↓
[CONDITION] HAS_PAID_SUBSCRIPTION = true?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "trial-urgency-discount"
  Subject: 3 days left — save 25% on Pro
  (content: email-sequences.md § Email 5.2)
    ↓
[WAIT] 2 days   ← now 1 day before TRIAL_END
    ↓
[CONDITION] HAS_PAID_SUBSCRIPTION = true?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "trial-last-chance"
  Subject: Tomorrow: Your Pro features pause
  (content: email-sequences.md § Email 5.3)
    ↓
[WAIT] 1 day   ← trial ended
    ↓
[CONDITION] HAS_PAID_SUBSCRIPTION = true?
  → Yes: END
  → No: continue
    ↓
[SEND EMAIL] "trial-ended"
  Subject: Your Pro features are now paused
  (content: email-sequences.md § Email 5.4)
    ↓
[END]
```

---

## Building an Email Template in Brevo

For each `[SEND EMAIL]` step above:

1. Go to **Email Templates → + New Template**
2. Name it exactly as shown (e.g. `welcome-context-setup`) — for your own reference
3. Choose **Drag & Drop Editor** or **Code Editor** (paste HTML from `email-sequences.md`)
4. Set subject line, sender name (`UpSight`), sender email (`hello@getupsight.com`)
5. Add `{{ contact.FIRSTNAME | default: "there" }}` for personalization
6. **Always include** `{{ unsubscribe }}` link in footer — Brevo requires it
7. Save → Preview → Send test to yourself

---

## Priority Build Order (by Wednesday)

| Day | Workflows to build | Rationale |
|-----|--------------------|-----------|
| Mon | Prerequisites + Welcome (W1) | Fires immediately for all new signups |
| Tue | Trial Conversion (W5) | Highest revenue impact |
| Wed | Churn Rescue (W4) | Stop the bleeding on dormant users |
| Later | Aha Activation (W2), Power User (W3) | Lower urgency, smaller cohorts right now |

---

## Testing Each Workflow

Before activating:

1. **Pause workflow** (keep in draft)
2. Create a test contact in Brevo with your email
3. Manually set the entry condition attributes (e.g. `DAYS_SINCE_SIGNUP = 0`)
4. Click **"Test workflow"** → enters the contact immediately
5. Verify email arrives, check rendering on mobile + dark mode
6. Check unsubscribe link works
7. **Activate workflow**

---

## Common Brevo Workflow Gotchas

- **"Contact attribute updated" trigger fires on ANY attribute update** — make sure your entry conditions are specific enough or contacts will enter prematurely
- **Date-based waits (TRIAL_END)** require the attribute to be type `Date` in Brevo, not `Text`
- **Re-entry = No** is critical — without it, daily PostHog property syncs can re-enter contacts every day
- **Free tier cap: 300 emails/day** — at ~30 users this is fine, but monitor as you grow
- **Condition blocks don't exit the workflow** — they just skip the next email. Use the workflow-level exit condition to fully remove a contact
