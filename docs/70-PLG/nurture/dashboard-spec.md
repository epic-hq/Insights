# PostHog Nurture Dashboard (First Pass)

## Goal
Give a single view of:
- Who is entering nurture cohorts
- Email engagement by cohort and sequence
- Nurture impact on activation and conversion

This dashboard is built in PostHog using existing events and cohorts. It complements Brevo’s campaign stats by adding behavioral context and conversion impact.

---

## Dashboard: "PLG Nurture"

### 1) Cohort Size Trends
**Insight type:** Trends
- Event: `Person` (cohort size)
- Cohorts: `lc-new-no-content`, `lc-content-not-viewed`, `lc-survey-not-analyzed`, `lc-dormant-14d`, `trial-expiring-soon`
- Interval: Weekly
- Goal: Are cohorts shrinking as nurture improves?

### 2) Email Engagement (Overall)
**Insight type:** Trends
- Events: `email_opened`, `email_clicked`, `email_unsubscribed`, `email_bounced`
- Breakdown: `campaign_name`
- Interval: Weekly
- Goal: Identify best/worst performing campaigns.

### 3) Email Engagement by Cohort
**Insight type:** Trends
- Event: `email_clicked`
- Filters: `campaign_name` contains nurture sequences
- Breakdown: Cohort membership (filter by cohort)
- Interval: Weekly
- Goal: Which cohort is most responsive?

### 4) Activation Funnel (Conversation Path)
**Insight type:** Funnel
- Steps:
  - `account_signed_up`
  - `interview_added`
  - `interview_detail_viewed`
  - `task_completed`
- Breakdown: `cohort` (activation-related cohorts)
- Goal: See where nurture cohorts drop off.

### 5) Activation Funnel (Survey Path)
**Insight type:** Funnel
- Steps:
  - `account_signed_up`
  - `survey_created`
  - `survey_response_received`
  - `survey_ai_analyzed`
  - `survey_results_viewed`
  - `task_completed`
- Breakdown: `cohort`

### 6) Trial Conversion Funnel
**Insight type:** Funnel
- Steps:
  - `checkout_started`
  - `checkout_completed`
- Filter: Cohorts `trial-active`, `trial-expiring-soon`, `trial-expired`

### 7) Time to Activation (Trend)
**Insight type:** Trends
- Event: `task_completed`
- Filter: users who also have `interview_detail_viewed` OR `survey_results_viewed`
- Breakdown: `campaign_name` (email clicked)
- Goal: Does engagement speed up activation?

---

## Naming Conventions
- Dashboard name: `PLG Nurture`
- Insights naming: `Nurture: <metric>` (e.g., `Nurture: Email Clicked by Cohort`)

---

## Notes
- Use Brevo for deliverability and sequence-level stats. This dashboard is for behavioral impact.
- If campaign names differ across Brevo sequences, standardize them before building the breakdowns.
- If `campaign_name` isn’t flowing into PostHog, update Brevo webhook parsing to include it.
