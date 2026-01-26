# PLG Instrumentation & Control Plan

> **Epic**: Comprehensive server-side PostHog event capture for PLG optimization
>
> **Goal**: Capture key user actions to gain visibility into the customer journey and enable data-driven PLG interventions

---

## 1. Business Objectives

### Primary Goals
1. **Increase Activation Rate**: Users reaching "activated" state within 14 days
2. **Improve Conversion**: Free/trial users converting to paid
3. **Reduce Churn**: Early identification and intervention for at-risk users
4. **Enable PLG Automation**: Data-driven nudges at critical journey moments

### Key Metrics to Optimize
| Metric | Current State | Target | Measurement |
|--------|---------------|--------|-------------|
| Activation Rate (D14) | Unknown | 35%+ | % signups reaching "activated" |
| Time to Activation | Unknown | <7 days | Median days to first insight |
| Trial → Paid Conversion | Unknown | 25%+ | % trial users upgrading |
| 30-Day Retention | Unknown | 40%+ | % users active at D30 |
| Team Expansion Rate | Unknown | 30%+ | % users inviting teammates |

---

## 2. Key Terminology

### What is a "Stall Point"?

A **stall point** is a moment in the user journey where users commonly stop progressing toward activation. These are high-friction moments where intervention (email, in-app nudge, or product improvement) can dramatically improve conversion.

**Example stall points in UpSight:**
- After signup: User has account but hasn't added any content (no interviews, no surveys)
- After content: User uploaded an interview but never viewed the analysis results
- After analysis: Results are ready but user hasn't pressed "Analyze with AI" on survey responses
- After insights: User sees insights but never creates a task or takes action

**Why track stall points?**
- Identify where users get stuck
- Trigger automated interventions at the right moment
- Measure impact of product/messaging changes

---

## 3. User Journey Stages

### Stage Progression Model

```
AWARENESS → ONBOARDING → ACTIVATION → HABIT → EXPANSION → ADVOCACY
   Day 0       D0-3         D1-14      D15-60    D60+        D90+
```

### Stage Definitions

| Stage | Definition | Key Behaviors | Exit Criteria |
|-------|------------|---------------|---------------|
| **Awareness** | User discovers UpSight | Signs up | `account_signed_up` |
| **Onboarding** | Initial setup | Project auto-created, adds first content | `interview_added` OR `survey_created` |
| **Activation** | Experiences core value | Views results, takes action | `analysis_viewed` + `task_completed` |
| **Habit** | Regular engagement | Weekly usage, multiple projects | 3+ sessions/week |
| **Expansion** | Team adoption | Invites teammates, upgrades | `invite_sent` + `plan_upgraded` |
| **Advocacy** | Champions product | Shares externally, provides feedback | Content shared externally |

### Multiple Paths to Activation

Users can activate through different paths. All are valid activation signals:

| Path | Actions | Activation Signal |
|------|---------|-------------------|
| **Conversation Path** | Upload interview → View insights → Complete task | `task_completed` from interview insights |
| **Survey Path** | Create survey → Get responses → Analyze with AI | `survey_ai_analyzed` |
| **Video Path** | Record video/screen share → View analysis | `video_recorded` + `analysis_viewed` |
| **CRM Path** | Import contacts → Enrich with AI → Create opportunity | `opportunity_created` |
| **Agent Path** | Ask agent "what to do next" (non-onboarding) | `agent_question_asked` with `context: "guidance"` |

---

## 4. Core User Flows to Instrument

### Flow 1: Conversation Analysis (Primary)
```
signup → [project auto-created] → upload_interview → transcription_complete →
analysis_complete → view_interview_detail → create_task → complete_task
```

**Stall Points:**
- D2+ with no content added → Nudge: "Add your first conversation"
- Analysis complete, D1+ without viewing → Nudge: "See what we found"
- Viewed insights, no action → Nudge: "Turn insights into action"

### Flow 2: Survey/Research Link (Easier Entry Point)
```
signup → [project auto-created] → create_survey → configure_questions →
publish_link → [responses arrive] → press "Analyze with AI" → view_results
```

**Stall Points:**
- D3+ with no content → Nudge: "Surveys are the fastest way to get started"
- Responses received, no AI analysis triggered → Nudge: "Your responses are ready to analyze"
- AI analysis complete, no viewing → Nudge: "See what your respondents are saying"

### Flow 3: Insight to Action
```
view_insight → create_task → complete_task
       OR
view_insight → create_opportunity → update_opportunity
       OR
view_insight → share_externally
```

**Note:** Some insights are auto-generated (AI), some are manual. Track `source: "ai" | "manual"` on all insight events.

**Stall Points:**
- 3+ insights viewed, 0 actions → Nudge: "Turn insights into next steps"
- Tasks created but not completed → Nudge: "You have outstanding action items"

### Flow 4: CRM & Contacts
```
import_contacts → view_person_detail → record_voice_memo →
create_opportunity → update_opportunity_status
```

**Stall Points:**
- D5+ with 0 contacts → Nudge: "Add contacts to your AI-powered CRM for enrichment"
- Contacts added, no opportunities → Nudge: "Create opportunities to track deals"

### Flow 5: Team Collaboration
```
invite_member → member_accepts → member_adds_content → collaborative_work
```

**Stall Points:**
- Power user, solo, D21+ → Nudge: "Expand to your team"
- Invite sent, D7+ not accepted → Nudge: "Your teammate hasn't joined yet"

### Flow 6: Conversation Lenses (Structured Analysis)
```
select_lens_template → apply_to_interview → view_lens_results
       OR
create_custom_lens → define_framework → apply_to_interview
```

**Stall Points:**
- 3+ interviews, 0 lenses applied → Nudge: "Get structured insights with Conversation Lenses"

---

## 5. Behavioral Triggers & PLG Actions

### Intervention Matrix (Refined)

Since projects are auto-created on signup, we use "content added" as the first meaningful trigger.

| User State | Days Since Signup | Condition | Intervention |
|------------|-------------------|-----------|--------------|
| New, no content | 2 | No interviews AND no surveys | "Create a survey - fastest way to start" |
| New, no content | 4 | Still no content | "Upload your first conversation" |
| Has content, no agent chat | 3 | Content added, never used agent | "Ask our AI what to do next" |
| Analysis ready, not viewed | 1 | `analysis_complete` but no `interview_detail_viewed` | "See what we found" email |
| Survey responses, no AI | 1 | `survey_response_received` but no `survey_ai_analyzed` | "Your responses are ready to analyze" |
| Insights viewed, no action | 5 | `insight_viewed` 3+ times, 0 `task_created` | "Turn insights into action" |
| No CRM contacts | 5 | `person_count` = 0 | "Add contacts to your AI CRM" |
| Solo power user | 21 | `is_power_user` AND `team_size` = 1 | "Expand to your team" |
| Trial ending | -3 days | `trial_end_date` approaching | "Your trial ends soon" |
| Inactive, was active | 14 | Was activated, no events in 14d | "We miss you" |

### Working Backward: Required Data for Each Action

| Desired Action | Required Events | Required Properties |
|----------------|-----------------|---------------------|
| "Create a survey" nudge | `account_signed_up` | `interview_count=0`, `survey_count=0`, `days_since_signup>=2` |
| "See what we found" nudge | `analysis_completed` | `interview_detail_viewed=false`, `days_since_analysis>=1` |
| "Analyze with AI" nudge | `survey_response_received` | `survey_ai_analyzed=false`, `response_count>=1` |
| "Add contacts" nudge | `account_signed_up` | `person_count=0`, `days_since_signup>=5` |
| "Ask the agent" nudge | `interview_added` OR `survey_created` | `agent_question_count=0`, `days_since_content>=3` |
| Reverse trial grant | `interview_added` (3rd) | `interview_count>=3` |
| Upgrade prompt | Various | `usage_percent>=80`, `current_plan=free` |

---

## 6. Event Taxonomy

### Naming Convention
- **Pattern**: `{noun}_{verb_past_tense}` in `snake_case`
- **Examples**: `interview_uploaded`, `survey_analyzed`, `task_completed`
- **Backend-first**: All events captured server-side for reliability

### Feasibility Assessment

For each event, we assess:
- **Trackable**: Can we reliably capture this server-side?
- **Useful**: Does this enable a specific intervention or insight?

---

### A. Authentication & Account Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `account_signed_up` | **Done** | Yes | `/login_success.tsx` | email, auth_provider, utm_* |
| `account_deleted` | TODO | Yes | Settings action | days_active, churn_reason |

---

### B. Onboarding Events

| Event | Status | Trackable? | Notes | Properties |
|-------|--------|------------|-------|------------|
| `onboarding_started` | TODO | Yes | First login detection in loader | version, source |
| `onboarding_step_completed` | TODO | Yes | Each setup agent interaction | step_name, step_number |
| `onboarding_completed` | TODO | Yes | Final step or flag set | total_steps, time_to_complete_min |
| ~~`onboarding_abandoned`~~ | Skip | **No** | Cannot detect browser close/tab switch server-side. Use cohort "started but not completed within X hours" instead. | - |
| `profile_completed` | TODO | Yes | Profile form submit | fields_completed_pct, role, industry |

**Alternative to `onboarding_abandoned`:** Create a cohort in PostHog:
- Filter: `onboarding_started` within 7 days
- Exclude: `onboarding_completed`
- This gives you "stalled onboarding" without needing exit detection.

---

### C. Project & Setup Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `project_created` | **Done** | Yes | `/api.create-project.tsx` | project_id, is_first_project |
| `project_goals_set` | TODO | Yes | Setup agent saves | goal_type, target_audience, research_mode |
| `project_archived` | TODO | Yes | Archive action | days_active, interview_count |

---

### D. Interview/Conversation Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `interview_added` | **Done** | Yes | `processInterview.server.ts` | source, duration_s, file_type |
| `interview_uploaded` | TODO | Yes | Upload initiation | file_type, file_size_mb |
| `video_recorded` | TODO | Yes | Recording complete | duration_s, is_screen_share |
| `interview_transcribed` | TODO | Yes | Transcription job complete | duration_s, word_count, language |
| `interview_analyzed` | TODO | Yes | Analysis job complete | evidence_count, theme_count, insights_count |
| `interview_detail_viewed` | TODO | Yes | Detail page loader | interview_id, time_since_analysis_hours |
| `interview_shared` | TODO | Yes | Share action | share_type, recipient_count |

---

### E. Survey/Research Link Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `survey_created` | TODO | Yes | Create action | question_count, has_branching |
| `survey_published` | TODO | Yes | Publish action | has_embed, share_url_copied |
| `survey_response_received` | TODO | Yes | Public submission | response_id, completion_time_sec, question_count_answered |
| `survey_ai_analyzed` | TODO | Yes | "Analyze with AI" button | response_count, theme_count |
| `survey_results_viewed` | TODO | Yes | Results page loader | response_count, days_since_first_response |

**Note on survey tracking:** We cannot track when survey links are sent externally (via email, posted on website, etc.). We can only track:
- When the survey is created/published
- When responses come in
- When the user triggers AI analysis
- When results are viewed

---

### F. Evidence & Insights Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `evidence_saved` | TODO | Yes | Evidence create | source: "ai" \| "manual", confidence |
| `evidence_tagged` | TODO | Yes | Tag action | tag_name, facet_category |
| `evidence_shared` | TODO | Yes | Share action | share_type, recipient_count |
| `insight_created` | TODO | Yes | Insight create | type, source: "ai" \| "manual", evidence_count |
| `insight_viewed` | TODO | Yes | Detail page load | insight_id, source |
| `insight_acted_on` | TODO | Yes | Action button | action_type: "task" \| "opportunity" \| "share" |
| `insight_shared` | TODO | Yes | Share action | share_type, recipient_count, is_external |

---

### G. Task/Priority Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `task_created` | TODO | Yes | Task create | source: "insight" \| "manual" \| "ai", priority, source_insight_id |
| `task_status_changed` | TODO | Yes | Status update | from_status, to_status |
| `task_completed` | TODO | Yes | Status → done | days_to_complete, was_from_insight |
| `task_deleted` | TODO | Yes | Delete action | was_completed, days_since_created |

**Note:** Completing a task is a stronger activation signal than creating one. Auto-generated tasks should be tracked with `source: "ai"`.

---

### H. CRM & People Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `contacts_imported` | TODO | Yes | Import action | import_source: "csv" \| "api", contact_count |
| `person_created` | TODO | Yes | Manual create | source: "import" \| "manual" \| "interview" |
| `person_viewed` | TODO | Yes | Person detail loader | has_enrichment |
| `voice_memo_recorded` | TODO | Yes | Recording complete | person_id, duration_s |
| `opportunity_created` | TODO | Yes | Opportunity create | person_id, account_id, stage |
| `opportunity_updated` | TODO | Yes | Stage/field change | from_stage, to_stage |

---

### I. Lens Analysis Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `lens_applied` | TODO | Yes | Apply lens action | template_key, is_custom, interview_id |
| `lens_completed` | TODO | Yes | Analysis job complete | findings_count, duration_sec |
| `lens_results_viewed` | TODO | Yes | Results page loader | template_key, is_custom |
| `custom_lens_created` | TODO | Yes | Custom lens save | framework_type, field_count |

**Bonus:** Track `is_custom: true` for users who define their own lens frameworks - high engagement signal.

---

### J. Agent/Chat Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `agent_message_sent` | TODO | Yes | Chat submit | agent_type, context: "onboarding" \| "project" \| "guidance" |
| `agent_suggestion_followed` | TODO | Yes | Suggestion clicked | suggestion_type |

**Key insight:** Track when users ask the agent for guidance (non-onboarding questions like "what should I do next?"). This indicates engagement and trust in the product.

---

### K. Sharing Events (Unified)

All content types can be shared. Track with consistent properties:

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `content_shared` | TODO | Yes | Any share action | content_type: "interview" \| "insight" \| "evidence" \| "survey", share_method: "link" \| "pdf" \| "email", is_external, recipient_count |

---

### L. Collaboration Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `invite_sent` | **Done** | Yes | Team manage action | role, invitation_type |
| `invite_accepted` | **Done** | Yes | Accept flow | role, days_since_invite |
| `invite_declined` | TODO | Yes | Decline action | reason_if_provided |
| `member_removed` | TODO | Yes | Remove action | role, days_as_member |

---

### M. Billing Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `billing_page_viewed` | TODO | Yes | Billing page loader | current_plan |
| `checkout_started` | TODO | Yes | Checkout redirect | target_plan, seats |
| `checkout_completed` | TODO | Yes | Polar webhook | plan, mrr_increase |
| `plan_upgraded` | TODO | Yes | Webhook | from_plan, to_plan |
| `plan_downgraded` | TODO | Yes | Webhook | from_plan, to_plan, reason |
| `trial_started` | TODO | Yes | Trial grant | plan, duration_days |
| `trial_ended` | TODO | Yes | Expiry check | converted: boolean |

---

### N. Session & Engagement Events

| Event | Status | Trackable? | Location | Properties |
|-------|--------|------------|----------|------------|
| `session_started` | TODO | Yes | Protected layout loader | device_type, referrer |
| `feature_viewed` | TODO | Yes | Key page loaders | feature_name |

---

## 7. User & Account Properties

### Person Properties (Per User)

```typescript
interface UserProperties {
  // Identity
  user_id: string;
  email: string;

  // Content metrics
  interview_count: number;
  survey_count: number;
  insight_count: number;
  task_count: number;
  task_completed_count: number;
  person_count: number;          // CRM contacts
  opportunity_count: number;

  // Activation flags
  has_viewed_analysis: boolean;  // Viewed interview detail or survey results after analysis
  has_used_agent: boolean;       // Asked agent a non-onboarding question
  has_completed_task: boolean;   // Completed at least one task
  has_applied_lens: boolean;     // Applied a conversation lens
  has_created_custom_lens: boolean; // Created custom lens (power user)
  has_imported_contacts: boolean;
  has_recorded_voice_memo: boolean;

  // Lifecycle
  signup_date: string;
  first_content_date?: string;   // First interview or survey
  first_analysis_view_date?: string;
  activation_date?: string;
  days_to_activation?: number;
  last_active_date: string;
  days_since_last_activity: number;

  // Computed flags
  lifecycle_stage: 'new' | 'onboarding' | 'activated' | 'power_user' | 'at_risk' | 'churned';
  is_activated: boolean;
  is_power_user: boolean;
  is_churn_risk: boolean;

  // Billing
  current_plan: 'free' | 'starter' | 'pro' | 'team';
  trial_end_date?: string;
  team_member: boolean;
}
```

### Activation Definition

A user is **activated** when they have:
1. Added content (interview OR survey with responses)
2. Viewed the analysis results (interview detail page OR survey results after AI analysis)
3. Taken action (completed a task OR created an opportunity OR shared content externally)

```typescript
const isActivated = (user: UserProperties): boolean => {
  const hasContent = user.interview_count > 0 || user.survey_count > 0;
  const hasViewedAnalysis = user.has_viewed_analysis;
  const hasTakenAction = user.task_completed_count > 0 ||
                         user.opportunity_count > 0 ||
                         user.external_share_count > 0;

  return hasContent && hasViewedAnalysis && hasTakenAction;
};
```

---

## 8. Cohort Definitions

### Lifecycle Cohorts

| Cohort | Definition | Use Case |
|--------|------------|----------|
| `lc-new-no-content` | D2+, no interviews AND no surveys | "Surveys are the fastest way to start" |
| `lc-content-not-viewed` | Has analysis, never viewed detail page | "See what we found" |
| `lc-survey-not-analyzed` | Has survey responses, no AI analysis | "Your responses are ready" |
| `lc-insights-no-action` | Viewed 3+ insights, 0 tasks completed | "Turn insights into action" |
| `lc-no-contacts` | D5+, person_count = 0 | "Add contacts to AI CRM" |
| `lc-no-agent-chat` | Has content, never used agent | "Ask our AI what to do next" |
| `lc-activated` | meets activation criteria | Success tracking |
| `lc-power-user` | 3+ sessions/week, 5+ tasks completed | Expansion candidates |
| `lc-dormant-14d` | No events in 14 days, was activated | Churn rescue |

### Value Cohorts

| Cohort | Definition | Use Case |
|--------|------------|----------|
| `vl-survey-creator` | Published 1+ surveys | Lower-friction path |
| `vl-video-recorder` | Recorded 1+ videos | High engagement |
| `vl-lens-user` | Applied 1+ lenses | Structured analysis user |
| `vl-custom-lens` | Created custom lens | Power user |
| `vl-crm-user` | Imported contacts OR created opportunities | CRM adopter |
| `vl-voice-memo-user` | Recorded voice memos | Mobile/field user |
| `vl-team-builder` | Invited 1+ teammates | Expansion signal |
| `vl-sharer` | Shared content externally | Advocate potential |

---

## 9. Implementation Checklist

### Priority 1: Foundation (Week 1-2)

| Task | Event | File Location | Effort |
|------|-------|---------------|--------|
| [ ] Session tracking | `session_started` | Protected layout loader | S |
| [ ] Content view tracking | `interview_detail_viewed` | Interview detail loader | S |
| [ ] Survey results view | `survey_results_viewed` | Survey results loader | S |
| [ ] Calculate `days_since_last_activity` | Property | Scheduled job | M |

### Priority 2: Activation Signals (Week 2-3)

| Task | Event | File Location | Effort |
|------|-------|---------------|--------|
| [ ] Survey creation | `survey_created` | Research links create | S |
| [ ] Survey response received | `survey_response_received` | Public submission handler | S |
| [ ] Survey AI analysis | `survey_ai_analyzed` | Analyze button action | S |
| [ ] Task completion | `task_completed` | Status change action | S |
| [ ] Agent questions | `agent_message_sent` | Chat submit handler | S |
| [ ] Calculate `is_activated` | Property | Scheduled job | M |

### Priority 3: Expansion Signals (Week 3-4)

| Task | Event | File Location | Effort |
|------|-------|---------------|--------|
| [ ] Lens applied | `lens_applied` | Apply lens action | S |
| [ ] Custom lens created | `custom_lens_created` | Lens create action | S |
| [ ] Contacts imported | `contacts_imported` | Import action | S |
| [ ] Voice memo recorded | `voice_memo_recorded` | Recording complete | S |
| [ ] Opportunity created | `opportunity_created` | Opportunity action | S |
| [ ] Content shared | `content_shared` | Share actions | M |

### Priority 4: Conversion Signals (Week 4-5)

| Task | Event | File Location | Effort |
|------|-------|---------------|--------|
| [ ] Billing page viewed | `billing_page_viewed` | Billing loader | S |
| [ ] Checkout tracking | `checkout_started/completed` | Checkout flow + webhook | M |
| [ ] Trial tracking | `trial_started/ended` | Trial logic | M |
| [ ] Usage limit warnings | `usage_limit_approached` | Usage check | M |

---

## 10. Code Implementation Patterns

### Server-Side Event Capture

```typescript
import { getPostHogServer } from "~/lib/posthog.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const posthog = getPostHogServer();
  const userId = context.userId;
  const accountId = context.accountId;

  // Business logic
  const task = await completeTask(taskId);

  // Track event (non-blocking)
  posthog.capture({
    distinctId: userId,
    event: "task_completed",
    properties: {
      task_id: task.id,
      days_to_complete: task.daysToComplete,
      was_from_insight: !!task.source_insight_id,
      source: task.source,
      $groups: { account: accountId },
    },
  });

  // Update user properties
  posthog.identify({
    distinctId: userId,
    properties: {
      task_completed_count: { $increment: 1 },
      has_completed_task: true,
    },
  });

  return json({ success: true });
}
```

### Survey Response Tracking (Public Route)

```typescript
// In /ask/:slug submission handler
export async function action({ request, params }: ActionFunctionArgs) {
  const response = await saveResponse(data);

  // Get survey owner's user ID for attribution
  const survey = await getSurvey(params.slug);

  posthog.capture({
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

  return json({ success: true });
}
```

### Computed Properties (Daily Scheduled Job)

```typescript
export const updateUserMetrics = task({
  id: "posthog.update-user-metrics",
  run: async () => {
    const posthog = getPostHogServer();
    const users = await getAllUsers();

    for (const user of users) {
      const metrics = await calculateMetrics(user.id);

      const isActivated =
        (metrics.interviewCount > 0 || metrics.surveyResponseCount > 0) &&
        metrics.hasViewedAnalysis &&
        (metrics.taskCompletedCount > 0 || metrics.opportunityCount > 0);

      posthog.identify({
        distinctId: user.id,
        properties: {
          interview_count: metrics.interviewCount,
          survey_count: metrics.surveyCount,
          task_completed_count: metrics.taskCompletedCount,
          opportunity_count: metrics.opportunityCount,
          person_count: metrics.personCount,
          has_viewed_analysis: metrics.hasViewedAnalysis,
          has_used_agent: metrics.hasUsedAgent,
          is_activated: isActivated,
          is_power_user: isActivated && metrics.sessionCount7d >= 3,
          is_churn_risk: isActivated && metrics.daysSinceLastActivity >= 14,
          days_since_last_activity: metrics.daysSinceLastActivity,
          lifecycle_stage: determineStage(metrics, isActivated),
        },
      });
    }

    await posthog.flush();
  },
});
```

---

## 11. PostHog Dashboard Configuration

### Funnels to Create

1. **Conversation Activation Funnel**
   ```
   account_signed_up → interview_added → interview_analyzed →
   interview_detail_viewed → task_completed
   ```

2. **Survey Activation Funnel**
   ```
   account_signed_up → survey_created → survey_response_received →
   survey_ai_analyzed → survey_results_viewed → task_completed
   ```

3. **CRM Adoption Funnel**
   ```
   account_signed_up → contacts_imported → person_viewed →
   opportunity_created
   ```

4. **Team Expansion Funnel**
   ```
   invite_sent → invite_accepted → (member) interview_added
   ```

### Key Dashboards

1. **Activation Paths**: Compare conversion rates across conversation, survey, CRM paths
2. **Stall Points**: Track cohort sizes for each stall point
3. **Feature Adoption**: Lens usage, voice memos, agent questions
4. **Engagement**: Weekly active users, feature usage distribution

---

## 12. Intervention Automation

### Email Campaigns (Brevo)

See [Email Campaigns Setup](./email-campaigns-setup.md) for detailed implementation guide.

| Trigger | Cohort | Email | CTA |
|---------|--------|-------|-----|
| D2 no content | `lc-new-no-content` | "Surveys are the fastest way to start" | Create survey link |
| D4 still no content | `lc-new-no-content` | "Upload your first conversation" | Upload link |
| D3 has content, no agent | `lc-no-agent-chat` | "Ask our AI what to do next" | Open agent |
| Analysis ready D1+ | `lc-content-not-viewed` | "See what we found" | View results |
| Responses ready | `lc-survey-not-analyzed` | "Your responses are ready to analyze" | Analyze button |
| D5 no contacts | `lc-no-contacts` | "Enrich your contacts with AI" | Import contacts |
| D21 power user, solo | `lc-power-user` + `team_size=1` | "Expand to your team" | Invite link |
| D14 inactive | `lc-dormant-14d` | "We miss you" | Dashboard link |

---

## 13. Success Metrics

| Metric | Source | Target |
|--------|--------|--------|
| D14 Activation Rate | Cohort `lc-activated` / signups | 35%+ |
| Survey Path Adoption | `survey_created` / signups | 25%+ |
| "Analyze with AI" Rate | `survey_ai_analyzed` / `survey_response_received` | 80%+ |
| Task Completion Rate | `task_completed` / `task_created` | 50%+ |
| Agent Usage Rate | Users with `agent_message_sent` | 40%+ |
| Lens Adoption | Users with `lens_applied` | 30%+ |

---

## 14. Implementation Timeline

| Week | Focus | Key Events |
|------|-------|------------|
| 1-2 | Foundation | Session, content views, properties job |
| 3-4 | Activation | Survey events, task completion, agent tracking |
| 5-6 | Expansion | Lens, CRM, sharing events |
| 7 | Conversion | Billing events, trial tracking |
| 8 | Automation | Brevo setup, sync script, email templates |

---

## Appendix: Events We Cannot Track

| Event | Why | Alternative |
|-------|-----|-------------|
| `onboarding_abandoned` | Cannot detect browser close server-side | Use cohort: "started but not completed in 24h" |
| `survey_link_sent` | External email/website, no visibility | Track when responses arrive instead |
| `checkout_abandoned` | Polar handles checkout, no visibility | Track `checkout_started` without matching `checkout_completed` |
| Page exit/bounce | Server-side can't detect tab close | Use session duration + last page viewed |

---

## Appendix: Related Documents

- [PostHog Tracking Guide](./posthog-tracking.md) - Naming conventions
- [PostHog Events Implemented](./posthog-events-implemented.md) - Current state
- [Activation Strategy](./activation-strategy.md) - Reverse trial design
- [Email Campaigns Setup](./email-campaigns-setup.md) - Brevo configuration
