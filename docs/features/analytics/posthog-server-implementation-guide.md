# PostHog Server-Side Tracking: Implementation Guide

> **Canonical reference** for all PostHog server-side event tracking in UpSight.
>
> **For PLG strategy and user journey design**, see [`docs/70-PLG/strategy/instrumentation-plan.md`](/docs/70-PLG/strategy/instrumentation-plan.md).
>
> **For PostHog dashboard setup and monitoring**, see [`docs/60-ops-observability/posthog-setup-guide.md`](/docs/60-ops-observability/posthog-setup-guide.md).

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Conventions](#2-conventions)
3. [PostHog Client Setup](#3-posthog-client-setup)
4. [Implementation Patterns](#4-implementation-patterns)
5. [Implemented Events (21)](#5-implemented-events)
6. [Unimplemented Events -- Prioritized by PLG Impact](#6-unimplemented-events----prioritized-by-plg-impact)
7. [Person Properties and Computed Metrics](#7-person-properties-and-computed-metrics)
8. [Cohort Definitions](#8-cohort-definitions)
9. [Event-to-PLG Mapping](#9-event-to-plg-mapping)
10. [Testing and Validation](#10-testing-and-validation)

---

## 1. Architecture

All analytics events are captured **server-side** using the `posthog-node` SDK. This ensures:

- **Reliability**: No client-side JavaScript failures or ad blockers
- **Security**: Sensitive data stays on the server
- **Accuracy**: Every tracked action is captured

### Data Flow

```
User action in browser
  -> React Router action/loader (server)
    -> Business logic executes
    -> posthog.capture() (non-blocking)
    -> Response returned to browser

Daily at 2am UTC:
  updateUserMetricsTask (Trigger.dev)
    -> Queries Supabase for all users
    -> Computes lifecycle properties
    -> posthog.identify() for each user
    -> PostHog CDP pushes to Brevo (real-time)
```

### Key Files

| File | Purpose |
|------|---------|
| `app/lib/posthog.server.ts` | PostHog client singleton |
| `src/trigger/analytics/updateUserMetrics.ts` | Daily computed properties job |
| `app/routes/api.webhooks.brevo.tsx` | Brevo email events -> PostHog |

---

## 2. Conventions

### Event Naming

- **Pattern**: `{noun}_{verb_past_tense}` in `snake_case`
- **Examples**: `interview_added`, `task_completed`, `checkout_started`
- **Versioning**: Add `_v2` suffix if event semantics change (do not redefine an existing event name)

### Property Naming

- `snake_case` for all property keys
- Use `$groups: { account: accountId }` for B2B account grouping on every event
- Use `$set` for mutable properties, `$set_once` for immutable properties
- Prefix attribution properties with `source_` (e.g., `source_utm_source`)

### Error Handling

Every tracking call must be wrapped in try/catch. Tracking failures must never block the user flow:

```typescript
try {
  posthog.capture({ ... });
} catch (trackingError) {
  consola.warn("[CONTEXT] PostHog tracking failed:", trackingError);
}
```

---

## 3. PostHog Client Setup

### Getting the Client

```typescript
import { getPostHogServerClient } from "~/lib/posthog.server";

// In a loader or action:
const posthog = getPostHogServerClient();
if (!posthog) return; // Tracking disabled (missing POSTHOG_KEY)
```

### Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `POSTHOG_KEY` | Yes | -- |
| `POSTHOG_HOST` | No | `https://us.i.posthog.com` |

### Client Configuration

The client is configured with `flushAt: 1` and `flushInterval: 0` for immediate sending. For the daily metrics task, call `posthog.shutdown()` after processing all users to flush the batch.

---

## 4. Implementation Patterns

### Pattern A: Track in a Route Action (Most Common)

Use this when a user submits a form or triggers a mutation.

```typescript
import { getPostHogServerClient } from "~/lib/posthog.server";
import consola from "consola";

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context.get(userContext);
  const posthog = getPostHogServerClient();

  // 1. Business logic first
  const result = await doTheThing(ctx.supabase, data);

  // 2. Track event (non-blocking, wrapped in try/catch)
  try {
    posthog?.capture({
      distinctId: ctx.userId,
      event: "thing_done",
      properties: {
        thing_id: result.id,
        account_id: ctx.accountId,
        project_id: projectId,
        // domain-specific properties
        $groups: { account: ctx.accountId },
      },
    });
  } catch (trackingError) {
    consola.warn("[thing_done] PostHog tracking failed:", trackingError);
  }

  return { success: true };
}
```

### Pattern B: Track in a Route Loader (View Events)

Use this for page views and content consumption tracking.

```typescript
export async function loader({ context, params }: Route.LoaderArgs) {
  const ctx = context.get(userContext);
  const posthog = getPostHogServerClient();

  // 1. Load data
  const data = await loadData(ctx.supabase, params.id);

  // 2. Track view event
  try {
    posthog?.capture({
      distinctId: ctx.userId,
      event: "thing_detail_viewed",
      properties: {
        thing_id: params.id,
        account_id: ctx.accountId,
        project_id: params.projectId,
        $groups: { account: ctx.accountId },
      },
    });
  } catch (trackingError) {
    consola.warn("[thing_detail_viewed] PostHog tracking failed:", trackingError);
  }

  return data;
}
```

### Pattern C: Track in a Webhook Handler

Use this for events from external systems (Polar billing, Brevo email engagement).

```typescript
export async function action({ request }: Route.ActionArgs) {
  const payload = await request.json();
  const posthog = getPostHogServerClient();

  // Webhook logic...
  const userId = await resolveUserIdFromWebhook(payload);

  try {
    posthog?.capture({
      distinctId: userId,
      event: "external_thing_happened",
      properties: {
        // webhook-specific properties
        $groups: { account: accountId },
      },
    });
  } catch (trackingError) {
    consola.warn("[external_thing_happened] PostHog tracking failed:", trackingError);
  }

  return new Response("ok", { status: 200 });
}
```

### Pattern D: Track in a Background Task (Trigger.dev)

Use this for events that happen during async processing.

```typescript
import { getPostHogServerClient } from "~/lib/posthog.server";

export const myTask = task({
  id: "domain.my-task",
  run: async (payload) => {
    const posthog = getPostHogServerClient();

    // Task logic...

    try {
      posthog?.capture({
        distinctId: payload.userId,
        event: "async_thing_completed",
        properties: {
          // task-specific properties
          $groups: { account: payload.accountId },
        },
      });
    } catch (trackingError) {
      consola.warn("[async_thing_completed] PostHog tracking failed:", trackingError);
    }

    // Important: flush in background tasks
    await posthog?.flush();
  },
});
```

### Pattern E: Update Person Properties

Use `identify` to set user-level properties. Prefer doing this in the daily `updateUserMetricsTask` for computed properties rather than inline.

```typescript
posthog?.identify({
  distinctId: userId,
  properties: {
    interview_count: 5,
    lifecycle_stage: "activated",
  },
});
```

---

## 5. Implemented Events

Status: **21 events implemented** across 16 source files.

### A. Authentication and Account

#### `account_signed_up`

| | |
|---|---|
| **File** | `app/routes/(auth)+/login_success.tsx` |
| **Trigger** | First successful authentication (OAuth or email) |
| **PLG Stage** | Awareness -> Onboarding |

```typescript
{
  email: string,
  auth_provider: "google" | "email",
  account_id: string,
  plan: "free",
  utm_source?: string,
  utm_medium?: string,
  utm_campaign?: string,
  utm_term?: string,
  utm_content?: string,
  role?: string,
  company_name?: string,
  referral_source?: string,
  signup_source: "oauth_google" | "email_password",
  $set_once: { created_at: string }
}
```

**Also sets**: Person properties via `posthog.identify()` (email, role, company_name, lifecycle_stage) and group properties via `posthog.group("account", accountId, { plan, seats })`.

**Detection logic**: Checks `user_settings.created_at` -- if less than 10 seconds old, it is a new signup.

---

### B. Project Management

#### `project_created`

| | |
|---|---|
| **File** | `app/routes/api.create-project.tsx` |
| **Trigger** | New project successfully created |
| **PLG Stage** | Onboarding |

```typescript
{
  project_id: string,
  account_id: string,
  project_name: string,
  is_first_project: boolean,
  has_description: boolean
}
```

**Also sets**: `lifecycle_stage: "active"` and `first_project_created_at` (via `$set`) when `is_first_project` is true.

---

### C. Interview / Conversation Events

#### `interview_added`

| | |
|---|---|
| **File** | `app/utils/processInterview.server.ts` |
| **Trigger** | Interview processing completes successfully |
| **PLG Stage** | Onboarding -> Activation |

```typescript
{
  interview_id: string,
  project_id: string,
  account_id: string,
  source: "upload" | "record" | "paste",
  duration_s: number,
  file_type?: "audio" | "video" | "text",
  has_transcript: boolean,
  evidence_count: number,
  insights_count: number
}
```

#### `interview_detail_viewed`

| | |
|---|---|
| **File** | `app/features/interviews/pages/detail.tsx` |
| **Trigger** | User views an interview detail page |
| **PLG Stage** | Activation (key signal) |

```typescript
{
  interview_id: string,
  project_id: string,
  account_id: string,
  has_transcript: boolean,
  has_analysis: boolean,
  evidence_count: number,
  insights_count: number,
  $groups: { account: account_id }
}
```

#### `interview_shared`

| | |
|---|---|
| **File** | `app/routes/api.share.enable.tsx` |
| **Trigger** | User enables public sharing for an interview |
| **PLG Stage** | Expansion / Advocacy |

```typescript
{
  interview_id: string,
  project_id: string,
  account_id: string,
  share_type: "public_link",
  expiration_days: "7" | "30" | "never",
  $groups: { account: account_id }
}
```

#### `analyze_started`

| | |
|---|---|
| **File** | `app/routes/api.reprocess-interview.tsx` |
| **Trigger** | User triggers interview analysis/reprocessing |
| **PLG Stage** | Activation |

```typescript
{
  interview_id: string,
  project_id: string,
  account_id: string,
  needs_transcription: boolean,
  has_media: boolean,
  trigger_run_id: string,
  $groups: { account: account_id }
}
```

---

### D. Survey / Research Link Events

#### `survey_created`

| | |
|---|---|
| **File** | `app/features/research-links/pages/new.tsx` |
| **Trigger** | User creates a new survey (Ask link) |
| **PLG Stage** | Onboarding -> Activation |

```typescript
{
  survey_id: string,
  account_id: string,
  question_count: number,
  is_live: boolean,
  allow_chat: boolean,
  $groups: { account: account_id }
}
```

#### `survey_results_viewed`

| | |
|---|---|
| **File** | `app/features/research-links/pages/responses.$listId.tsx` |
| **Trigger** | User views survey results |
| **PLG Stage** | Activation (key signal) |

```typescript
{
  survey_id: string,
  project_id: string,
  account_id: string,
  response_count: number,
  question_count: number,
  has_ai_analysis: boolean,
  $groups: { account: account_id }
}
```

---

### E. Insight Events

#### `insight_viewed`

| | |
|---|---|
| **File** | `app/features/insights/pages/insight-detail.tsx` |
| **Trigger** | User views an insight detail page |
| **PLG Stage** | Activation -> Habit |

```typescript
{
  insight_id: string,
  project_id: string,
  account_id: string,
  evidence_count: number,
  people_affected_count: number,
  $groups: { account: account_id }
}
```

---

### F. Task / Priority Events

#### `task_created`

| | |
|---|---|
| **File** | `app/routes/api.tasks.tsx` |
| **Trigger** | User creates a new task |
| **PLG Stage** | Activation |

```typescript
{
  task_id: string,
  project_id: string,
  account_id: string,
  priority: number,
  source: "insight" | "manual",
  source_insight_id: string | null,
  $groups: { account: account_id }
}
```

#### `task_status_changed`

| | |
|---|---|
| **File** | `app/routes/api.tasks.tsx` |
| **Trigger** | Any task status transition |
| **PLG Stage** | Activation -> Habit |

```typescript
{
  task_id: string,
  project_id: string,
  account_id: string,
  previous_status: string | null,
  new_status: string,
  priority: number,
  $groups: { account: account_id }
}
```

#### `task_completed`

| | |
|---|---|
| **File** | `app/routes/api.tasks.tsx` |
| **Trigger** | Task status changes to "done" |
| **PLG Stage** | Activation (key signal -- completes activation criteria) |

```typescript
{
  task_id: string,
  project_id: string,
  account_id: string,
  priority: number,
  $groups: { account: account_id }
}
```

#### `task_due_date_changed`

| | |
|---|---|
| **File** | `app/routes/api.tasks.tsx` |
| **Trigger** | Task due date is set or changed |
| **PLG Stage** | Habit |

```typescript
{
  task_id: string,
  project_id: string,
  account_id: string,
  previous_due_date: string | null,
  new_due_date: string | null,
  days_until_due: number | null,
  $groups: { account: account_id }
}
```

#### `task_assigned`

| | |
|---|---|
| **File** | `app/routes/api.tasks.tsx` |
| **Trigger** | Task is assigned to a user |
| **PLG Stage** | Expansion (team collaboration signal) |

```typescript
{
  task_id: string,
  project_id: string,
  account_id: string,
  assignee_count: number,
  assigner_user_id: string,
  is_self_assign: boolean,
  $groups: { account: account_id }
}
```

---

### G. Collaboration Events

#### `invite_sent`

| | |
|---|---|
| **File** | `app/features/teams/pages/manage-members.tsx` (action) |
| **Trigger** | Team invitation sent |
| **PLG Stage** | Expansion |

```typescript
{
  account_id: string,
  invitee_email: string,
  role: "owner" | "member",
  invitation_type: "one_time"
}
```

#### `invite_accepted`

| | |
|---|---|
| **File** | `app/features/teams/pages/manage-members.tsx` (loader) |
| **Trigger** | User accepts a team invitation |
| **PLG Stage** | Expansion |

```typescript
{
  account_id: string,
  inviter_user_id: string | null,
  role: "owner" | "member" | "viewer"
}
```

**Also sets**: `team_member: true`, `last_team_joined_at` via identify.

#### `annotation_created`

| | |
|---|---|
| **File** | `app/features/annotations/api/annotations.tsx` |
| **Trigger** | Comment/annotation posted on any entity |
| **PLG Stage** | Habit / Expansion |

```typescript
{
  annotation_id: string,
  project_id: string,
  account_id: string,
  entity_type: "task" | "insight" | "evidence" | "interview" | "opportunity",
  entity_id: string,
  annotation_type: "comment",
  is_reply: boolean,
  has_mentions: boolean,
  $groups: { account: account_id }
}
```

---

### H. Billing Events

#### `billing_page_viewed`

| | |
|---|---|
| **File** | `app/features/billing/pages/index.tsx` |
| **Trigger** | User views the billing/subscription page |
| **PLG Stage** | Conversion |

```typescript
{
  account_id: string,
  current_plan: "free" | "starter" | "pro" | "team",
  has_active_subscription: boolean,
  subscription_status: string | null,
  $groups: { account: account_id }
}
```

#### `checkout_started`

| | |
|---|---|
| **File** | `app/routes/api.billing.checkout.tsx` |
| **Trigger** | User initiates a checkout session |
| **PLG Stage** | Conversion |

```typescript
{
  account_id: string,
  plan: "starter" | "pro" | "team",
  interval: "month" | "year",
  checkout_id: string,
  $groups: { account: account_id }
}
```

#### `checkout_completed`

| | |
|---|---|
| **File** | `app/routes/api.webhooks.polar.tsx` |
| **Trigger** | Subscription becomes active (Polar webhook) |
| **PLG Stage** | Conversion (success) |

```typescript
{
  account_id: string,
  plan: string,
  subscription_id: string,
  product_id: string,
  seats: number,
  is_trial: boolean,
  $groups: { account: account_id }
}
```

#### `subscription_canceled`

| | |
|---|---|
| **File** | `app/routes/api.webhooks.polar.tsx` |
| **Trigger** | Subscription canceled (Polar webhook) |
| **PLG Stage** | Churn |

```typescript
{
  account_id: string,
  subscription_id: string,
  cancel_at_period_end: boolean,
  $groups: { account: account_id }
}
```

---

### I. Email Engagement Events (Brevo Webhook)

These events are sent from Brevo to PostHog via the webhook at `app/routes/api.webhooks.brevo.tsx`. They use email address as `distinct_id`.

| Event | Brevo Trigger | Properties |
|-------|---------------|------------|
| `email_opened` | `opened`, `uniqueOpened` | email, campaign_name, campaign_id, timestamp |
| `email_clicked` | `click` | email, campaign_name, clicked_url, timestamp |
| `email_bounced` | `hardBounce`, `softBounce` | email, campaign_name, bounce_type, timestamp |
| `email_unsubscribed` | `unsubscribed` | email, campaign_name, timestamp |
| `email_spam` | `spam` | email, campaign_name, timestamp |

---

## 6. Unimplemented Events -- Prioritized by PLG Impact

Events are grouped by priority based on which PLG interventions they enable.

### Priority 1: Activation Blockers (Enables Stall-Point Nudges)

These events are required to detect users stuck at key activation stall points and trigger the corresponding Brevo nurture sequences.

| Event | PLG Intervention Enabled | Suggested File Location | Effort |
|-------|--------------------------|-------------------------|--------|
| `survey_response_received` | "Your responses are ready to analyze" nudge | Public submission handler (`app/routes/ask.$slug.tsx` or similar) | S |
| `survey_ai_analyzed` | "Analyze with AI" completion tracking | Analyze button action in research links | S |
| `agent_message_sent` | "Ask our AI what to do next" nudge | Chat submit handler in agent feature | S |
| `session_started` | Activity tracking for `days_since_last_activity` | Protected layout loader (`app/routes/_ProtectedLayout.tsx`) | S |

**Implementation template for `survey_response_received`:**

```typescript
// In the public survey submission action handler
export async function action({ request, params }: Route.ActionArgs) {
  const response = await saveResponse(data);

  // Get survey owner's user ID for attribution
  const survey = await getSurvey(params.slug);
  const posthog = getPostHogServerClient();

  try {
    posthog?.capture({
      distinctId: survey.owner_user_id,
      event: "survey_response_received",
      properties: {
        survey_id: survey.id,
        response_id: response.id,
        completion_time_sec: response.duration,
        question_count_answered: response.answeredCount,
        total_response_count: survey.response_count + 1,
        $groups: { account: survey.account_id },
      },
    });
  } catch (trackingError) {
    consola.warn("[survey_response_received] PostHog tracking failed:", trackingError);
  }

  return { success: true };
}
```

### Priority 2: Activation Signals (Refines Activation Definition)

These events make the activation definition more precise and enable feature adoption tracking.

| Event | PLG Intervention Enabled | Suggested File Location | Effort |
|-------|--------------------------|-------------------------|--------|
| `lens_applied` | Lens adoption measurement | Apply lens action | S |
| `lens_completed` | Lens value delivery tracking | Analysis job completion | S |
| `lens_results_viewed` | Lens engagement measurement | Results page loader | S |
| `custom_lens_created` | Power user identification | Lens create action | S |
| `contacts_imported` | "Add contacts to AI CRM" nudge | Import action handler | S |
| `opportunity_created` | CRM adoption tracking | Opportunity create action | S |

### Priority 3: Expansion and Engagement Signals

These events enable expansion campaigns and deeper engagement measurement.

| Event | PLG Intervention Enabled | Suggested File Location | Effort |
|-------|--------------------------|-------------------------|--------|
| `voice_memo_recorded` | Mobile/field user identification | Recording complete handler | S |
| `content_shared` | Advocacy identification | Any share action | M |
| `person_created` | CRM adoption tracking | Person create action | S |
| `person_viewed` | CRM engagement tracking | Person detail loader | S |
| `opportunity_updated` | Deal pipeline tracking | Opportunity update action | S |

### Priority 4: Onboarding and Lifecycle

These events improve onboarding flow measurement and lifecycle stage accuracy.

| Event | PLG Intervention Enabled | Suggested File Location | Effort |
|-------|--------------------------|-------------------------|--------|
| `onboarding_started` | Onboarding funnel measurement | First login detection | S |
| `onboarding_step_completed` | Onboarding dropoff analysis | Setup agent step completion | S |
| `onboarding_completed` | Onboarding success rate | Final step completion | S |
| `profile_completed` | Profile completeness tracking | Profile form submission | S |
| `project_goals_set` | Setup completion tracking | Setup agent saves | S |

### Priority 5: Conversion Enhancement

These events improve the billing/conversion funnel beyond current coverage.

| Event | PLG Intervention Enabled | Suggested File Location | Effort |
|-------|--------------------------|-------------------------|--------|
| `trial_started` | Trial funnel tracking | Trial grant logic | M |
| `trial_ended` | Trial conversion measurement | Expiry check (scheduled) | M |
| `plan_upgraded` | Upgrade path analysis | Polar webhook | S |
| `plan_downgraded` | Churn analysis | Polar webhook | S |
| `feature_viewed` | Feature discovery tracking | Key page loaders | M |

---

## 7. Person Properties and Computed Metrics

### Properties Set by `updateUserMetricsTask` (Daily at 2am UTC)

Source: `src/trigger/analytics/updateUserMetrics.ts`

| Property | Type | Description | Used By |
|----------|------|-------------|---------|
| `email` | string | User email | Brevo contact matching |
| `account_id` | string | Account UUID | Brevo attribute |
| `company_name` | string | Account name | Brevo personalization |
| `interview_count` | number | Total interviews created by user | Cohort filtering |
| `survey_count` | number | Total surveys (research links) | Cohort filtering |
| `insight_count` | number | Total insights in account | `lc-stalled-no-insight` cohort |
| `task_completed_count` | number | Tasks marked "done" | Power user identification |
| `opportunity_count` | number | Opportunities in account | Activation criteria |
| `person_count` | number | CRM contacts in account | `lc-no-contacts` cohort |
| `team_size` | number | Account members | Expansion cohort |
| `plan` | string | `free`/`starter`/`pro`/`team` | Brevo, billing cohorts |
| `has_pro_trial` | boolean | Currently in trial | Trial cohorts |
| `trial_end` | string (ISO) | Trial expiration date | Trial expiring cohort |
| `has_paid_subscription` | boolean | Has active paid plan | Exclude from nurture |
| `has_viewed_analysis` | boolean | Viewed interview detail or survey results | Activation criteria |
| `has_used_agent` | boolean | Used agent chat (TODO: currently hardcoded false) | Activation criteria |
| `data_ingested` | number | `interview_count + survey_count` | `lc-new-no-content` cohort |
| `insight_published` | boolean | `insight_count > 0` | `lc-stalled-no-insight` cohort |
| `is_activated` | boolean | Meets full activation criteria | Master activation flag |
| `is_power_user` | boolean | Activated + `task_completed_count >= 5` | Expansion targeting |
| `is_churn_risk` | boolean | Activated + inactive 14+ days | Churn rescue targeting |
| `days_since_last_activity` | number | Days since last interview/task update | Dormancy detection |
| `days_since_signup` | number | Days since account creation | Lifecycle cohort filtering |
| `lifecycle_stage` | string | `new`/`onboarding`/`activated`/`power_user`/`at_risk`/`churned` | Master lifecycle |
| `last_metrics_update` | string (ISO) | When properties were last computed | Debugging |

### Activation Definition (from `updateUserMetrics.ts`)

A user is **activated** when ALL of the following are true:

```typescript
const isActivated =
  (metrics.interviewCount > 0 || metrics.surveyCount > 0) &&  // Has content
  metrics.hasViewedAnalysis &&                                  // Viewed results
  (metrics.taskCompletedCount > 0 || metrics.opportunityCount > 0);  // Took action
```

### Lifecycle Stage Logic

```
if (isActivated && daysSinceLastActivity >= 90) -> "churned"
if (isActivated && daysSinceLastActivity >= 14) -> "at_risk"
if (isActivated && taskCompletedCount >= 5)     -> "power_user"
if (isActivated)                                 -> "activated"
if (daysSinceSignup <= 14 && hasContent)         -> "onboarding"
if (daysSinceSignup <= 7)                        -> "new"
else                                             -> "onboarding"
```

### Known Limitations

1. **`has_viewed_analysis`** is approximated as `interviewCount > 0 || surveyCount > 0`. It should ideally check whether the user has actually viewed the `interview_detail` or `survey_results` page (via PostHog event query). Fixing this requires either querying PostHog's API from the metrics task or maintaining a flag in the database.

2. **`has_used_agent`** is hardcoded to `false`. Requires `agent_message_sent` event implementation.

3. **`days_since_last_activity`** uses the most recent `interviews.updated_at` or `tasks.updated_at` as a proxy. It does not account for logins, page views, or other activity. Implementing `session_started` (Priority 1) would improve this significantly.

---

## 8. Cohort Definitions

These cohorts are defined in PostHog and drive both dashboard monitoring and Brevo email automation.

### Lifecycle Cohorts

| Cohort | Filter Definition | PLG Use |
|--------|-------------------|---------|
| `lc-new-no-content` | `days_since_signup >= 2` AND `data_ingested = 0` AND NOT `has_paid_subscription` | Welcome & First Data nurture sequence |
| `lc-content-not-viewed` | `data_ingested >= 1` AND `has_viewed_analysis = false` | "See what we found" nudge |
| `lc-stalled-no-insight` | `data_ingested >= 1` AND `insight_published = false` AND `days_since_signup >= 7` AND NOT `has_paid_subscription` | Aha Activation nurture sequence |
| `lc-survey-not-analyzed` | Has `survey_response_received` event AND NOT `survey_ai_analyzed` event | "Your responses are ready to analyze" nudge |
| `lc-insights-no-action` | `insight_viewed` 3+ times AND `task_completed_count = 0` | "Turn insights into action" nudge |
| `lc-no-contacts` | `days_since_signup >= 5` AND `person_count = 0` | "Add contacts to AI CRM" nudge |
| `lc-no-agent-chat` | `data_ingested >= 1` AND `has_used_agent = false` | "Ask our AI what to do next" nudge |
| `lc-activated` | `is_activated = true` | Success tracking |
| `lc-power-user` | `is_power_user = true` AND `team_size = 1` | Power User Expansion nurture sequence |
| `lc-dormant-14d` | `is_activated = true` AND `days_since_last_activity >= 14` AND NOT `has_paid_subscription` | Churn Rescue nurture sequence |

### Trial Cohorts

| Cohort | Filter Definition | PLG Use |
|--------|-------------------|---------|
| `trial-active` | `has_pro_trial = true` | Trial Conversion nurture sequence |
| `trial-expiring` | `has_pro_trial = true` AND `trial_end` within 3 days | Trial urgency emails |
| `trial-expired` | `has_pro_trial = true` AND `trial_end` in the past AND NOT `has_paid_subscription` | Trial ended email |

### Value Cohorts

| Cohort | Filter Definition | PLG Use |
|--------|-------------------|---------|
| `vl-survey-creator` | Has `survey_created` event | Lower-friction activation path |
| `vl-lens-user` | Has `lens_applied` event | Structured analysis adopter |
| `vl-custom-lens` | Has `custom_lens_created` event | Power user signal |
| `vl-crm-user` | Has `contacts_imported` OR `opportunity_created` event | CRM path adopter |
| `vl-team-builder` | Has `invite_sent` event | Expansion signal |
| `vl-sharer` | Has `interview_shared` OR `content_shared` event | Advocate potential |

---

## 9. Event-to-PLG Mapping

This table maps every implemented event to its PLG impact area, enabling developers to understand why each event matters.

### PLG Impact Key

- **ACT** = Activation (user reaches "aha moment")
- **ENG** = Engagement (user builds habit)
- **RET** = Retention (user keeps coming back)
- **EXP** = Expansion (user invites team, upgrades plan)
- **REV** = Revenue (user converts to paid)

### Implemented Events by PLG Impact

| Event | ACT | ENG | RET | EXP | REV | Activation Criteria? |
|-------|-----|-----|-----|-----|-----|---------------------|
| `account_signed_up` | x | | | | | |
| `project_created` | x | | | | | |
| `interview_added` | x | | | | | Yes (content gate) |
| `interview_detail_viewed` | x | x | | | | Yes (view gate) |
| `interview_shared` | | | | x | | |
| `analyze_started` | x | | | | | |
| `survey_created` | x | | | | | |
| `survey_results_viewed` | x | x | | | | Yes (view gate) |
| `insight_viewed` | | x | x | | | |
| `task_created` | x | x | | | | |
| `task_status_changed` | | x | | | | |
| `task_completed` | x | x | | | | Yes (action gate) |
| `task_due_date_changed` | | x | | | | |
| `task_assigned` | | x | | x | | |
| `invite_sent` | | | | x | | |
| `invite_accepted` | | | | x | | |
| `annotation_created` | | x | | x | | |
| `billing_page_viewed` | | | | | x | |
| `checkout_started` | | | | | x | |
| `checkout_completed` | | | | | x | |
| `subscription_canceled` | | | x | | x | |

### Missing Events with Highest PLG Impact

| Event | Primary Impact | Why Critical |
|-------|---------------|--------------|
| `survey_response_received` | ACT | Required for survey activation path -- cannot measure if survey-path users get stuck |
| `survey_ai_analyzed` | ACT | The "analyze with AI" action is a key activation moment for survey-path users |
| `agent_message_sent` | ACT, ENG | Agent usage is a strong engagement signal and alternative activation path |
| `session_started` | RET | Cannot accurately measure `days_since_last_activity` without session tracking |

---

## 10. Testing and Validation

### Manual Testing Workflow

For each new event implementation:

1. Trigger the action in the app (dev environment)
2. Go to PostHog -> **Activity** tab
3. Search for your event name
4. Click the event to verify:
   - Correct `distinct_id` (user UUID)
   - All expected properties present
   - `$groups.account` is set
5. Go to **People** -> search by email -> verify person properties

### Automated Testing

The codebase has integration tests that verify PostHog calls. See:
- `app/test/integration/billing-polar.integration.test.ts` -- example of testing webhook-triggered events

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| No events appearing | Missing `POSTHOG_KEY` env var | Check `.env` for `POSTHOG_KEY` |
| Events appear but no person properties | `identify()` not called | Ensure `updateUserMetricsTask` is running daily |
| Duplicate events | Tracking in both loader and action | Ensure each event fires from exactly one location |
| `$groups.account` missing | Forgot to include in properties | Add `$groups: { account: accountId }` to every capture call |
| PostHog data stale | `updateUserMetricsTask` not running | Check Trigger.dev dashboard for task status |

### Validation Checklist for New Events

- [ ] Event name follows `{noun}_{verb_past_tense}` convention
- [ ] Properties include `account_id` and `project_id` (where applicable)
- [ ] `$groups: { account: accountId }` included
- [ ] Wrapped in try/catch with `consola.warn`
- [ ] Does not block user flow on failure
- [ ] Added to this guide with file location, trigger, PLG stage, and properties
- [ ] Manually verified in PostHog Activity tab

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [`docs/70-PLG/strategy/instrumentation-plan.md`](/docs/70-PLG/strategy/instrumentation-plan.md) | PLG strategy: user journey stages, behavioral triggers, intervention matrix |
| [`docs/70-PLG/strategy/activation-strategy.md`](/docs/70-PLG/strategy/activation-strategy.md) | Reverse trial design, campaign flows, feature gates |
| [`docs/70-PLG/nurture/plan.md`](/docs/70-PLG/nurture/plan.md) | Unified nurture plan (PostHog + Brevo orchestration) |
| [`docs/70-PLG/nurture/brevo-setup.md`](/docs/70-PLG/nurture/brevo-setup.md) | Brevo configuration, webhook setup, email templates |
| [`docs/70-PLG/nurture/email-sequences.md`](/docs/70-PLG/nurture/email-sequences.md) | Full email content for all 18 nurture templates |
| [`docs/60-ops-observability/posthog-setup-guide.md`](/docs/60-ops-observability/posthog-setup-guide.md) | PostHog dashboard and funnel setup |
