# PostHog Analytics Tracking Guide

## Overview

This document defines the PostHog event tracking strategy for the Insights application, following best practices for event naming, person properties, and cohort definitions.

## Event Naming Convention

**Pattern**: `{action}_{past_tense}` in `snake_case`

Events should be:
- **Past-tense**: Describe completed actions
- **Snake_case**: Easy to scan and filter
- **Versioned**: Add `_v2`, `_v3` suffix if semantics change
- **Backend-captured**: Prefer server-side tracking for reliability

## Core Events

### 1. Authentication & Onboarding

#### `account_signed_up`
**Location**: `/app/routes/(auth)+/login_success.tsx`
**Trigger**: First successful authentication (OAuth or email/password)
**Properties**:
```typescript
{
  email: string
  auth_provider: "google" | "email"
  account_id: string
  plan: "free" | "pro" | "enterprise"
  // UTM parameters for attribution
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  // User context
  role?: string
  company_name?: string
  referral_source?: string
  signup_source: "oauth_google" | "email_password"
}
```

**Implementation Notes**:
- Only fires once per user (checks `user_settings.created_at` timestamp)
- Works for both OAuth and email/password flows
- Captures UTM parameters from URL for attribution
- Automatically creates account group association

### 2. Project Management

#### `project_created`
**Location**: TBD - Add to project creation action
**Properties**:
```typescript
{
  project_id: string
  account_id: string
  project_name: string
  is_first_project: boolean
  template_used?: string
}
```

### 3. Research Activities

#### `interview_added`
**Location**: TBD - Add to interview upload/record completion
**Properties**:
```typescript
{
  interview_id: string
  project_id: string
  source: "upload" | "record" | "paste"
  duration_s: number
  file_type?: "audio" | "video" | "text"
  has_transcript: boolean
}
```

#### `evidence_saved`
**Location**: TBD - Add to evidence creation
**Properties**:
```typescript
{
  evidence_id: string
  project_id: string
  tag_count: number
  confidence: "high" | "medium" | "low"
  source: "manual" | "ai_extract"
}
```

### 4. Insights & Analysis

#### `insight_created`
**Location**: TBD - Add to insight creation
**Properties**:
```typescript
{
  insight_id: string
  project_id: string
  type: "opportunity" | "risk" | "pricing" | "messaging" | "feature"
  source: "manual" | "auto_extract" | "ai_suggest"
  evidence_count: number
}
```

#### `insight_shared`
**Location**: TBD - Add to share functionality
**Properties**:
```typescript
{
  insight_id: string
  project_id: string
  channel: "link" | "pdf" | "slack" | "email"
  recipient_count?: number
}
```

### 5. Persona & Pattern Analysis

#### `persona_generated`
**Location**: TBD - Add to persona creation
**Properties**:
```typescript
{
  persona_id: string
  project_id: string
  source: "manual" | "ai_generated"
  people_count: number
}
```

#### `theme_merged`
**Location**: TBD - Add to theme merge action
**Properties**:
```typescript
{
  theme_id: string
  project_id: string
  merged_theme_ids: string[]
  evidence_count: number
}
```

### 6. Collaboration

#### `invite_sent`
**Location**: TBD - Add to team invite action
**Properties**:
```typescript
{
  account_id: string
  invitee_email: string
  role: "admin" | "member" | "viewer"
}
```

#### `invite_accepted`
**Location**: TBD - Add to invite acceptance flow
**Properties**:
```typescript
{
  account_id: string
  inviter_user_id: string
  role: "admin" | "member" | "viewer"
}
```

## Person Properties

Set on user identification via `posthog.identify()`:

```typescript
{
  email: string
  role: "founder" | "pm" | "ux" | "sales" | "researcher"
  company_name?: string
  company_size?: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+"
  stage?: "idea" | "mvp" | "launched" | "growth"
  plan: "free" | "pro" | "enterprise"
  lifecycle_stage: "new_customer" | "active" | "at_risk" | "churned"
  // Attribution
  source_utm_source?: string
  source_utm_medium?: string
  source_utm_campaign?: string
}
```

**Implementation**: 
- Initial identification in `/app/routes/(auth)+/login_success.tsx` on signup
- Updated identification in `/app/routes/_ProtectedLayout.tsx` on every session

## Group Analytics (B2B Account Tracking)

Set via `posthog.group('account', accountId, properties)`:

```typescript
{
  plan: "free" | "pro" | "enterprise"
  seats: number
  industry?: string
  created_at: string
  mrr?: number
  projects_count: number
  interviews_count: number
  insights_count: number
}
```

**Implementation**:
- Initial group creation in `/app/routes/(auth)+/login_success.tsx`
- Updated in `/app/routes/_ProtectedLayout.tsx` on session load

## Cohort Definitions

### Lifecycle Cohorts (prefix: `lc-`)

| Cohort Name | Definition |
|------------|------------|
| `lc-new-0to7d` | Signed up < 7 days |
| `lc-stalled-no-project` | Signed up < 7 days AND no `project_created` |
| `lc-stalled-no-insight` | Has project & ≥1 `interview_added` & 0 `insight_created` |
| `lc-dormant-14d` | No events in 14 days |
| `lc-active-7d` | ≥1 event in last 7 days |
| `lc-power-user` | ≥10 events in last 7 days |

### Role Cohorts (prefix: `role-`)

| Cohort Name | Definition |
|------------|------------|
| `role-founder` | Person property `role` = "founder" |
| `role-pm` | Person property `role` = "pm" |
| `role-ux` | Person property `role` = "ux" |
| `role-sales` | Person property `role` = "sales" |
| `role-researcher` | Person property `role` = "researcher" |

### Value Cohorts (prefix: `vl-`)

| Cohort Name | Definition |
|------------|------------|
| `vl-aha-reached` | Has ≥1 `insight_created` |
| `vl-advocate` | ≥3 `insight_created` AND ≥1 `insight_shared` (7d) |
| `vl-power-researcher` | ≥10 `interview_added` (30d) |
| `vl-collaborative` | ≥1 `invite_sent` OR ≥1 `invite_accepted` |

## Implementation Checklist

### ✅ Completed
- [x] `account_signed_up` event in `/login_success` route
- [x] `project_created` event in `/api.create-project` route
- [x] `interview_added` event in `processInterview.server.ts`
- [x] `invite_sent` event in team management action
- [x] `invite_accepted` event in team management loader
- [x] Person identification with properties
- [x] Group analytics for accounts
- [x] UTM parameter capture

### 🔲 To Implement
- [ ] `evidence_saved` event
- [ ] `insight_created` event
- [ ] `insight_shared` event
- [ ] `persona_generated` event
- [ ] `theme_merged` event
- [ ] Create cohorts in PostHog dashboard
- [ ] Set up funnels for key conversion paths
- [ ] Configure retention analysis

## Best Practices

1. **Consistency**: Always use snake_case, past-tense event names
2. **Versioning**: Add `_v2` suffix if event semantics change significantly
3. **Backend Capture**: Prefer server-side tracking for reliability and security
4. **Error Handling**: Never let tracking failures block user flows
5. **Privacy**: Don't capture PII beyond email (no phone numbers, addresses, etc.)
6. **Documentation**: Keep this file updated as you add new events

## Testing

To verify PostHog tracking:

1. **Development**: Check browser console for PostHog debug logs
2. **PostHog Dashboard**: View live events in Activity tab
3. **Person Profile**: Verify properties are set correctly
4. **Group Profile**: Verify account-level properties

## Resources

- [PostHog Event Naming Best Practices](https://posthog.com/docs/data/events)
- [PostHog Group Analytics](https://posthog.com/docs/data/group-analytics)
- [PostHog Cohorts](https://posthog.com/docs/data/cohorts)
