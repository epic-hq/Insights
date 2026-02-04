# PLG Nurture Plan (Single Source of Truth)

## Purpose
Unify PLG instrumentation, segmentation, and nurture execution into one coherent system. This document is the canonical plan that supersedes overlapping notes across:
- `/docs/70-PLG/nurture/brevo-setup.md`
- `/docs/70-PLG/strategy/instrumentation-plan.md`
- `/docs/60-ops-observability/posthog-implementation-summary.md`
- `/docs/60-ops-observability/posthog-events-implemented.md`
- `/docs/60-ops-observability/posthog-tracking.md`
- `/docs/60-ops-observability/posthog-setup-guide.md`

---

## 1) System Architecture (What Does What)

**PostHog = behavior + segmentation**
- Capture events and user properties server-side.
- Build cohorts for lifecycle and activation states.
- Provide analytics: funnels, retention, and behavioral drop-offs.

**Brevo = delivery + automation**
- Store contacts and attributes for personalization.
- Manage lists and automation workflows.
- Send email sequences and track engagement (opens, clicks, bounces, unsubscribes).

**Email delivery source of truth**: All nurture email is sent from Brevo. PostHog Workflows are not used for delivery.

**Integration**
- **PostHog → Brevo** via native destination. PostHog pushes person properties and email to create/update contacts and manage lists.
- **Brevo → PostHog** via webhooks. Email engagement events are sent back to PostHog to close the loop for cohorting and conversion analysis.

This keeps analytics and segmentation in PostHog while using Brevo for the heavy-lift of deliverability and automation.

---

## 2) Data Contracts (Shared Definitions)

### Contact Attributes (Brevo)
These are the attributes we keep in Brevo for personalization and automation rules. They are written from PostHog person properties:

- `USER_ID`
- `ACCOUNT_ID`
- `PLAN`
- `TRIAL_END`
- `COMPANY_NAME`
- `LIFECYCLE_STAGE`
- `INTERVIEW_COUNT`
- `TASK_COMPLETED_COUNT`

Source of truth for these values is PostHog’s person properties updated by `updateUserMetricsTask`.

### Canonical Events (PostHog)
Use the PostHog tracking guide for naming and current implementation status.

**Activation-critical events**
- `account_signed_up`
- `project_created`
- `interview_added`
- `survey_created`
- `survey_response_received`
- `survey_ai_analyzed`
- `interview_detail_viewed`
- `survey_results_viewed`
- `task_created`
- `task_completed`
- `checkout_started`
- `checkout_completed`

**Email engagement (from Brevo)**
- `email_opened`
- `email_clicked`
- `email_bounced`
- `email_unsubscribed`
- `email_spam`

---

## 3) Cohort Definitions (PostHog)

These cohorts are the activation engine. They control Brevo list membership and automation entry points.

**Activation/Lifecycle**
- `lc-new-no-content` (D2+, no interviews and no surveys)
- `lc-content-not-viewed` (analysis ready, no view)
- `lc-survey-not-analyzed` (responses exist, no AI analysis)
- `lc-insights-no-action` (3+ insights viewed, 0 actions)
- `lc-dormant-14d` (no events for 14 days)

**Trial**
- `trial-active`
- `trial-expiring-soon` (trial end within 3 days)
- `trial-expired`

**Power / Expansion**
- `lc-power-user` (3+ sessions/week, 5+ tasks completed)
- `vl-team-builder` (invited teammates)

---

## 4) Email Sequences (Brevo)

### A. Trial Welcome
Entry: `trial-active`
- Day 0: trial welcome
- Day 3: feature highlight
- Day 7: social proof / weekly recap

### B. Trial Ending
Entry: `trial-expiring-soon`
- Day 0: 3 days left
- Day 2: last day reminder

### C. Trial Expired Win-back
Entry: `trial-expired`
- Day 0: features paused
- Day 7: feedback request
- Day 14: new feature update

### D. Activation Nurture
Entry: `activation-eligible` (and/or lifecycle cohorts)
- D2 no content → “Create a survey”
- D4 no content → “Upload your first conversation”
- Analysis ready → “See what we found”
- Responses ready → “Your responses are ready to analyze”

### E. Dormant Win-back
Entry: `lc-dormant-14d`
- Day 0: “We miss you”
- Day 7: success story

---

## 5) Integration Checklist

### PostHog → Brevo
- Use native Brevo destination
- Filter to users with email
- Map person properties to Brevo attributes

### Brevo → PostHog
- Configure webhooks (marketing + transactional)
- Track opened, clicked, bounced, unsubscribed, spam
- Distinct ID = email address

---

## 6) Measurement Plan

**Top-level PLG metrics**
- Activation rate (D14)
- Time to activation
- Trial → paid conversion
- 30-day retention
- Team expansion rate

**Email performance**
- Delivery rate
- Open rate
- Click rate
- Unsubscribe rate
- Bounce rate

**Attribution**
- Link email engagement events to cohort transitions and conversion events.
- Track uplift by cohort and sequence.

**Dashboard build**
- See `/docs/70-PLG/nurture/dashboard-spec.md` for the first-pass PostHog nurture dashboard setup.

---

## 7) Next Actions

1. Validate cohort definitions in PostHog
2. Confirm all contact attributes exist in Brevo
3. Verify the PostHog → Brevo destination mapping
4. Turn on Brevo → PostHog webhooks
5. Launch the Trial and Activation sequences first
6. Add A/B testing after 100+ sends per sequence

---

## 8) Notes on Sources of Truth

- For event naming and properties, see `/docs/60-ops-observability/posthog-tracking.md`.
- For implemented events and current coverage, see `/docs/60-ops-observability/posthog-events-implemented.md`.
- For setup and dashboard steps, see `/docs/60-ops-observability/posthog-setup-guide.md`.
- For Brevo config and template examples, see `/docs/70-PLG/nurture/brevo-setup.md`.
