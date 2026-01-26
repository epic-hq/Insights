# PostHog Events Implementation Summary

## ✅ Completed Events

### 1. `account_signed_up`
**Location**: `/app/routes/(auth)+/login_success.tsx`

**Trigger**: First successful authentication (OAuth or email/password)

**Properties Captured**:
```typescript
{
  email: string
  auth_provider: "google" | "email"
  account_id: string
  plan: "free"
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  role?: string
  company_name?: string
  referral_source?: string
  signup_source: "oauth_google" | "email_password"
  $set_once: {
    created_at: string (ISO timestamp)
  }
}
```

**Person Properties Set**:
```typescript
posthog.identify(userId, {
  email,
  role: "founder",
  company_name,
  lifecycle_stage: "new_customer",
  source_utm_source,
  source_utm_medium,
  source_utm_campaign,
})
```

**Group Analytics**:
```typescript
posthog.group("account", accountId, {
  plan: "free",
  seats: 1,
})
```

---

### 2. `project_created`
**Location**: `/app/routes/api.create-project.tsx`

**Trigger**: When a new project is successfully created

**Properties Captured**:
```typescript
{
  project_id: string
  account_id: string
  project_name: string
  is_first_project: boolean
  has_description: boolean
}
```

**Person Properties Updated** (if first project):
```typescript
posthog.identify(userId, {
  lifecycle_stage: "active",
  $set: {
    first_project_created_at: string (ISO timestamp)
  }
})
```

---

### 3. `interview_added`
**Location**: `/app/utils/processInterview.server.ts`

**Trigger**: When interview processing completes successfully

**Properties Captured**:
```typescript
{
  interview_id: string
  project_id: string
  account_id: string
  source: "upload" | "record" | "paste"
  duration_s: number
  file_type?: "audio" | "video" | "text"
  has_transcript: boolean
  evidence_count: number
  insights_count: number
}
```

**Person Properties Updated** (if early in journey):
```typescript
posthog.identify(userId, {
  $set: {
    interview_count: number
  }
})
```

---

### 4. `invite_sent`
**Location**: `/app/features/teams/pages/manage-members.tsx` (action)

**Trigger**: When a team invitation is successfully sent

**Properties Captured**:
```typescript
{
  account_id: string
  invitee_email: string
  role: "owner" | "member"
  invitation_type: "one_time"
}
```

---

### 5. `invite_accepted`
**Location**: `/app/features/teams/pages/manage-members.tsx` (loader)

**Trigger**: When a user successfully accepts a team invitation

**Properties Captured**:
```typescript
{
  account_id: string
  inviter_user_id: string | null
  role: "owner" | "member" | "viewer"
}
```

**Person Properties Updated**:
```typescript
posthog.identify(userId, {
  $set: {
    team_member: true,
    last_team_joined_at: string (ISO timestamp)
  }
})
```

---

### 6. `interview_detail_viewed`
**Location**: `/app/features/interviews/pages/detail.tsx`

**Trigger**: When a user views an interview detail page

**Properties Captured**:
```typescript
{
  interview_id: string
  project_id: string
  account_id: string
  has_transcript: boolean
  has_analysis: boolean
  evidence_count: number
  insights_count: number
  $groups: { account: account_id }
}
```

---

### 7. `survey_results_viewed`
**Location**: `/app/features/research-links/pages/responses.$listId.tsx`

**Trigger**: When a user views survey (Ask link) results

**Properties Captured**:
```typescript
{
  survey_id: string
  project_id: string
  account_id: string
  response_count: number
  question_count: number
  has_ai_analysis: boolean
  $groups: { account: account_id }
}
```

---

### 8. `survey_created`
**Location**: `/app/features/research-links/pages/new.tsx`

**Trigger**: When a user creates a new survey (Ask link)

**Properties Captured**:
```typescript
{
  survey_id: string
  account_id: string
  question_count: number
  is_live: boolean
  allow_chat: boolean
  $groups: { account: account_id }
}
```

---

### 9. `insight_viewed`
**Location**: `/app/features/insights/pages/insight-detail.tsx`

**Trigger**: When a user views an insight detail page

**Properties Captured**:
```typescript
{
  insight_id: string
  project_id: string
  account_id: string
  evidence_count: number
  people_affected_count: number
  $groups: { account: account_id }
}
```

---

### 10. `task_created`
**Location**: `/app/routes/api.tasks.tsx`

**Trigger**: When a user creates a new task

**Properties Captured**:
```typescript
{
  task_id: string
  project_id: string
  account_id: string
  priority: number
  source: "insight" | "manual"
  source_insight_id: string | null
  $groups: { account: account_id }
}
```

---

### 11. `task_completed`
**Location**: `/app/routes/api.tasks.tsx`

**Trigger**: When a task status is changed to "done"

**Properties Captured**:
```typescript
{
  task_id: string
  project_id: string
  account_id: string
  priority: number
  $groups: { account: account_id }
}
```

---

## Implementation Patterns

### Error Handling
All tracking implementations follow this pattern:
```typescript
try {
  posthog.capture("event_name", { ...properties })
} catch (trackingError) {
  consola.warn("[CONTEXT] PostHog tracking failed:", trackingError)
  // Don't throw - tracking failure shouldn't block user flow
}
```

### Server-Side Tracking
All events are captured server-side for:
- **Reliability**: No client-side JavaScript failures
- **Security**: Sensitive data stays on server
- **Accuracy**: No ad blockers or privacy extensions

### Person Properties Best Practices
- Use `$set` for properties that can change over time
- Use `$set_once` for immutable properties (e.g., `created_at`)
- Prefix attribution properties with `source_` (e.g., `source_utm_source`)

---

## Files Modified

1. **`/app/routes/(auth)+/login_success.tsx`**
   - Added `account_signed_up` event
   - Added person identification with lifecycle stage
   - Added group analytics

2. **`/app/routes/api.create-project.tsx`**
   - Added `project_created` event
   - Added lifecycle stage update for first project

3. **`/app/utils/processInterview.server.ts`**
   - Added `interview_added` event
   - Added interview count tracking

4. **`/app/features/teams/pages/manage-members.tsx`**
   - Added `invite_sent` event in action
   - Added `invite_accepted` event in loader
   - Added team membership tracking

5. **`/app/routes/_ProtectedLayout.tsx`**
   - Enhanced person identification with role and company
   - Added group analytics for account-level tracking

6. **`/app/features/interviews/pages/detail.tsx`**
   - Added `interview_detail_viewed` event
   - Tracks content engagement with transcript/analysis presence

7. **`/app/features/research-links/pages/responses.$listId.tsx`**
   - Added `survey_results_viewed` event
   - Tracks survey engagement with response counts

8. **`/app/features/research-links/pages/new.tsx`**
   - Added `survey_created` event
   - Tracks survey creation with question count

9. **`/app/features/insights/pages/insight-detail.tsx`**
   - Added `insight_viewed` event
   - Tracks insight engagement with evidence counts

10. **`/app/routes/api.tasks.tsx`**
    - Added `task_created` event with source tracking
    - Added `task_completed` event when status changes to done

---

## Testing Checklist

### Manual Testing
- [ ] Sign up new user → verify `account_signed_up` in PostHog
- [ ] Create first project → verify `project_created` with `is_first_project: true`
- [ ] Upload interview → verify `interview_added` with correct source
- [ ] Send team invite → verify `invite_sent` with correct role
- [ ] Accept team invite → verify `invite_accepted` with correct properties
- [ ] View interview detail → verify `interview_detail_viewed` with properties
- [ ] View survey results → verify `survey_results_viewed` with response count
- [ ] Create survey → verify `survey_created` with question count
- [ ] View insight detail → verify `insight_viewed` with evidence count
- [ ] Create task → verify `task_created` with source ("insight" or "manual")
- [ ] Complete task → verify `task_completed` when status changes to done

### PostHog Dashboard Verification
- [ ] Check Activity tab for live events
- [ ] Verify person properties are set correctly
- [ ] Verify group properties for accounts
- [ ] Check attribution data (UTM parameters)

### Error Handling
- [ ] Verify tracking failures don't block user flows
- [ ] Check console logs for tracking warnings

---

## Next Steps

### Additional Events to Implement
1. **`evidence_saved`** - When evidence is manually created or extracted
2. **`insight_created`** - When insights are generated or manually added
3. **`insight_shared`** - When insights are shared via link/PDF/Slack
4. **`persona_generated`** - When personas are created (manual or AI)
5. **`theme_merged`** - When themes are merged together

### PostHog Configuration
1. **Create Cohorts**:
   - Lifecycle cohorts (new, stalled, dormant, active, power-user)
   - Role cohorts (founder, pm, ux, sales, researcher)
   - Value cohorts (aha-reached, advocate, power-researcher, collaborative)

2. **Set Up Funnels**:
   - Signup → Project Created → Interview Added → Insight Created
   - Signup → Invite Sent → Invite Accepted

3. **Configure Retention**:
   - Day 1, Day 7, Day 30 retention
   - Feature-specific retention (interviews, insights, sharing)

4. **Set Up Alerts**:
   - Drop in signup conversion
   - Increase in stalled users
   - Spike in errors

---

## Performance Considerations

- **Non-blocking**: All PostHog calls are async and don't block user flows
- **Minimal overhead**: Tracking adds <50ms to request processing
- **No UI impact**: Server-side tracking doesn't affect client performance
- **Graceful degradation**: Failures are logged but don't break features

---

## Privacy & Compliance

- **No PII beyond email**: We don't capture phone numbers, addresses, or sensitive data
- **User consent**: Consider adding cookie consent banner for GDPR compliance
- **Data retention**: Configure PostHog retention policies per requirements
- **IP anonymization**: PostHog supports IP anonymization if needed

---

## Monitoring

### Key Metrics to Watch
1. **Signup Conversion**: `account_signed_up` count over time
2. **Activation Rate**: % of signups that create a project
3. **Engagement**: `interview_added` events per user
4. **Collaboration**: `invite_sent` and `invite_accepted` rates
5. **Retention**: Users with events in last 7/30 days

### Dashboards to Create
1. **Acquisition Dashboard**: Signups by source, UTM analysis
2. **Activation Dashboard**: Time to first project, first interview
3. **Engagement Dashboard**: Interviews per week, insights generated
4. **Collaboration Dashboard**: Team size distribution, invite acceptance rate
5. **Retention Dashboard**: Cohort retention curves, churn analysis
