# PostHog P1 Events - Test Plan

**Version**: 1.0
**Date**: 2026-02-15
**Status**: Ready for Execution

## Overview

This test plan verifies that all 4 Priority-1 PostHog server-side tracking events are functioning correctly in both staging and production environments.

---

## Prerequisites

### Required Access
- [ ] PostHog dashboard access (`https://us.i.posthog.com` or your instance)
- [ ] Application test account (authenticated user)
- [ ] Survey link URL (for survey tests)
- [ ] Browser DevTools access

### Environment Setup
- [ ] PostHog API key configured (`POSTHOG_KEY` in env)
- [ ] PostHog host configured (`POSTHOG_HOST` in env, default: `https://us.i.posthog.com`)
- [ ] Application running (local/staging/production)

### Verification Tools
- [ ] PostHog Live Events view
- [ ] PostHog Persons view
- [ ] Browser DevTools (Network tab for API calls)
- [ ] Browser DevTools (Application → Cookies)

---

## Test 1: `survey_response_received` Event

### Test Case 1.1: Email-Identified Survey Completion
**Objective**: Verify event tracks when user completes survey with email

**Steps**:
1. Open survey link (e.g., `/ask/{survey-slug}`)
2. Enter email address (use test email like `test+posthog@example.com`)
3. Complete all survey questions (ensure at least 1 text question)
4. Submit survey

**Expected Results**:
- ✅ Event `survey_response_received` appears in PostHog Live Events within 5 seconds
- ✅ `distinctId` = email address entered
- ✅ Properties match:
  ```json
  {
    "survey_id": "<uuid>",
    "survey_name": "<name>",
    "response_id": "<uuid>",
    "person_id": "<uuid>" or null,
    "account_id": "<uuid>",
    "project_id": "<uuid>" or null,
    "response_mode": "form" | "chat" | "voice",
    "question_count": <number>,
    "text_questions": <number>,
    "has_person": true | false,
    "completion_time": "<ISO 8601 timestamp>"
  }
  ```

**Verification Queries**:
```sql
-- In PostHog Insights/SQL
SELECT
  timestamp,
  distinct_id,
  properties
FROM events
WHERE event = 'survey_response_received'
  AND timestamp > now() - interval '1 hour'
ORDER BY timestamp DESC
LIMIT 10;
```

---

### Test Case 1.2: Anonymous Survey Completion
**Objective**: Verify event tracks for anonymous surveys

**Steps**:
1. Create survey with `identity_mode: "anonymous"`
2. Open survey link (no email required)
3. Complete survey questions
4. Submit

**Expected Results**:
- ✅ Event appears in PostHog
- ✅ `distinctId` = `response_id` (UUID)
- ✅ `person_id` = `null`
- ✅ `has_person` = `false`

---

### Test Case 1.3: Chat Mode Survey
**Objective**: Verify `response_mode` property accuracy

**Steps**:
1. Open survey with chat mode enabled
2. Select "Chat" mode before starting
3. Complete survey via chat
4. Submit

**Expected Results**:
- ✅ Event tracked
- ✅ `response_mode` = `"chat"`

---

## Test 2: `survey_ai_analyzed` Event

### Test Case 2.1: Evidence Extraction Completion
**Objective**: Verify event fires after AI analysis completes

**Steps**:
1. Complete survey from Test 1.1 (email-identified)
2. Wait for Trigger.dev task to complete (~5-30 seconds)
3. Check PostHog Live Events

**Expected Results**:
- ✅ Event `survey_ai_analyzed` appears after `survey_response_received`
- ✅ `distinctId` = `person_id` (UUID, **not** email)
- ✅ Properties match:
  ```json
  {
    "survey_id": "<uuid>",
    "survey_name": "<name>",
    "response_id": "<uuid>",
    "person_id": "<uuid>",
    "account_id": "<uuid>",
    "project_id": "<uuid>" or null,
    "evidence_count": <number>,
    "text_questions_analyzed": <number>,
    "analysis_method": "extraction",
    "completion_time": "<ISO 8601 timestamp>"
  }
  ```

**Verification**:
```sql
-- Check that both events exist for same response
SELECT
  event,
  timestamp,
  properties->>'response_id' as response_id,
  distinct_id
FROM events
WHERE (event = 'survey_response_received' OR event = 'survey_ai_analyzed')
  AND properties->>'response_id' = '<response_id>'
ORDER BY timestamp ASC;
```

**Notes**:
- This event only fires for **identified** responses (with `person_id`)
- Anonymous surveys will NOT trigger this event

---

### Test Case 2.2: Anonymous Survey - No Event
**Objective**: Verify event does NOT fire for anonymous surveys

**Steps**:
1. Complete anonymous survey (Test 1.2)
2. Wait 60 seconds
3. Check PostHog

**Expected Results**:
- ✅ `survey_response_received` exists
- ✅ `survey_ai_analyzed` does **NOT** exist
- ✅ No errors in server logs

---

## Test 3: `session_started` Event

### Test Case 3.1: First Login of the Day
**Objective**: Verify event fires on first authenticated request

**Setup**:
1. Clear all browser cookies for application domain
2. Ensure test user account exists

**Steps**:
1. Navigate to application login page
2. Enter credentials and submit
3. After successful login/redirect, check PostHog Live Events

**Expected Results**:
- ✅ Event `session_started` appears within 5 seconds
- ✅ `distinctId` = user's Supabase `auth.users.id` (UUID)
- ✅ Properties match:
  ```json
  {
    "session_date": "2026-02-15",
    "timestamp": "<ISO 8601>",
    "user_agent": "Mozilla/5.0...",
    "referrer": "https://..." or undefined
  }
  ```
- ✅ Cookie `last_session_date` is set with value = today's date (YYYY-MM-DD)

**Verification**:
- Open DevTools → Application → Cookies
- Find cookie `last_session_date`
- Value should be `2026-02-15` (today)

---

### Test Case 3.2: Same Day - No Duplicate Event
**Objective**: Verify event does NOT fire twice in same day

**Steps**:
1. After Test 3.1, remain logged in
2. Refresh page / navigate to different routes
3. Check PostHog Live Events

**Expected Results**:
- ✅ **NO** new `session_started` event
- ✅ Cookie `last_session_date` remains unchanged
- ✅ Only 1 event for this user today

**Verification**:
```sql
SELECT
  count(*) as event_count,
  date_trunc('day', timestamp) as day,
  distinct_id
FROM events
WHERE event = 'session_started'
  AND distinct_id = '<user_id>'
  AND timestamp > now() - interval '24 hours'
GROUP BY day, distinct_id;
```
**Expected count**: 1 per day per user

---

### Test Case 3.3: Next Day - New Event
**Objective**: Verify event fires again on next day

**Setup**:
- Manually set cookie `last_session_date` to yesterday's date:
  ```javascript
  // In browser console
  document.cookie = "last_session_date=2026-02-14; path=/; max-age=31536000";
  ```

**Steps**:
1. Refresh page (while logged in)
2. Check PostHog Live Events

**Expected Results**:
- ✅ New `session_started` event appears
- ✅ Cookie updated to today's date
- ✅ `session_date` = today

---

### Test Case 3.4: Logout - No Event
**Objective**: Verify event does NOT fire for unauthenticated requests

**Steps**:
1. Log out of application
2. Browse public pages (if any)
3. Check PostHog

**Expected Results**:
- ✅ **NO** `session_started` event
- ✅ Middleware only tracks authenticated users

---

## Test 4: `agent_message_sent` Event

### Test Case 4.1: Simple Agent Chat
**Objective**: Verify event tracks agent responses

**Steps**:
1. Log in to application
2. Navigate to project chat (e.g., `/a/{accountId}/{projectId}/chat`)
3. Send a simple message to agent (e.g., "What are my top themes?")
4. Wait for agent response to complete
5. Check PostHog Live Events

**Expected Results**:
- ✅ Event `agent_message_sent` appears after response completes
- ✅ `distinctId` = authenticated user's ID
- ✅ Properties match:
  ```json
  {
    "agent_id": "projectStatusAgent" | "chiefOfStaffAgent" | etc.,
    "agent_name": "projectStatusAgent" | etc.,
    "account_id": "<uuid>",
    "project_id": "<uuid>",
    "thread_id": "<uuid>",
    "message_type": "assistant",
    "response_mode": "normal" | "fast_standardized" | etc.,
    "tool_calls": <number>,
    "tools_used": ["tool1", "tool2"] or [],
    "timestamp": "<ISO 8601>"
  }
  ```

---

### Test Case 4.2: Agent with Tool Calls
**Objective**: Verify `tools_used` array is populated

**Steps**:
1. Send message that requires tool usage (e.g., "Show me recent evidence")
2. Wait for response
3. Check PostHog event

**Expected Results**:
- ✅ Event tracked
- ✅ `tool_calls` > 0
- ✅ `tools_used` contains tool names (e.g., `["fetchEvidence", "semanticSearchEvidence"]`)

**Verification**:
```sql
-- Find messages with most tool usage
SELECT
  properties->>'agent_id' as agent,
  properties->>'tool_calls' as tool_count,
  properties->>'tools_used' as tools
FROM events
WHERE event = 'agent_message_sent'
  AND timestamp > now() - interval '1 hour'
ORDER BY (properties->>'tool_calls')::int DESC
LIMIT 10;
```

---

### Test Case 4.3: Empty Response - No Event
**Objective**: Verify event does NOT fire if agent sends no text

**Setup**:
- This is difficult to trigger intentionally
- May occur if agent stream fails

**Expected Results**:
- ✅ If agent sends no text (`sawTextDelta = false`), no event tracked
- ✅ This is expected behavior (don't track failed responses)

---

## Cross-Event Validation

### Test Case 5.1: Survey Flow - Complete Sequence
**Objective**: Verify both survey events fire in correct order

**Steps**:
1. Complete survey (email-identified, with text questions)
2. Monitor PostHog Live Events for 60 seconds

**Expected Sequence**:
1. `survey_response_received` (immediate)
2. `survey_ai_analyzed` (5-30 seconds later)

**Verification**:
```sql
WITH survey_events AS (
  SELECT
    event,
    timestamp,
    properties->>'response_id' as response_id,
    distinct_id
  FROM events
  WHERE properties->>'response_id' = '<response_id>'
    AND event IN ('survey_response_received', 'survey_ai_analyzed')
)
SELECT
  event,
  timestamp,
  timestamp - LAG(timestamp) OVER (ORDER BY timestamp) as time_diff,
  distinct_id
FROM survey_events
ORDER BY timestamp;
```

**Expected**:
- `time_diff` between events: 5-30 seconds
- Both events have same `response_id` property

---

### Test Case 5.2: Daily User Journey
**Objective**: Verify typical user session flow

**Steps**:
1. Clear cookies
2. Log in (first time today)
3. Chat with agent (2-3 messages)
4. Complete a survey
5. Check PostHog events for user

**Expected Events** (in order):
1. `session_started` (login)
2. `agent_message_sent` (chat message 1)
3. `agent_message_sent` (chat message 2)
4. `survey_response_received` (survey completion)
5. `survey_ai_analyzed` (AI processing)

**Verification**:
```sql
SELECT
  event,
  timestamp,
  properties
FROM events
WHERE distinct_id = '<user_id>'
  AND timestamp > now() - interval '1 hour'
ORDER BY timestamp ASC;
```

---

## Error Testing

### Test Case 6.1: PostHog Unavailable
**Objective**: Verify graceful degradation when PostHog is down

**Setup**:
- Temporarily set invalid `POSTHOG_KEY` in environment
- Or disable PostHog service

**Steps**:
1. Perform any tracked action (survey, chat, login)
2. Check application logs
3. Verify application continues working

**Expected Results**:
- ✅ Application works normally (no 500 errors)
- ✅ Logs show warning: `[PostHog] Failed to track...`
- ✅ User experience unaffected

---

### Test Case 6.2: Missing Required Properties
**Objective**: Verify tracking handles edge cases

**Steps**:
1. Survey with no text questions (only likert/select)
2. Complete survey

**Expected Results**:
- ✅ `survey_response_received` still fires
- ✅ `text_questions` = 0
- ✅ `survey_ai_analyzed` may not fire (no text to analyze)

---

## Performance Testing

### Test Case 7.1: Response Time Impact
**Objective**: Verify tracking does not slow down user requests

**Steps**:
1. Use browser DevTools Network tab
2. Submit survey with tracking enabled
3. Measure response time
4. Disable PostHog tracking (comment out code)
5. Submit again, measure response time

**Expected Results**:
- ✅ Response time difference < 50ms
- ✅ PostHog calls are fire-and-forget (don't block)

**Metrics**:
- Survey submission: < 200ms (with or without tracking)
- Chat response start: < 500ms (first chunk)

---

### Test Case 7.2: High Volume
**Objective**: Verify tracking handles concurrent events

**Steps**:
1. Simulate 10 concurrent survey submissions
2. Monitor PostHog Live Events
3. Check for all events

**Expected Results**:
- ✅ All 10 `survey_response_received` events appear
- ✅ No dropped events
- ✅ No server errors

---

## Sign-Off Checklist

### Pre-Production
- [ ] All Test Cases 1.x passed (survey_response_received)
- [ ] All Test Cases 2.x passed (survey_ai_analyzed)
- [ ] All Test Cases 3.x passed (session_started)
- [ ] All Test Cases 4.x passed (agent_message_sent)
- [ ] Cross-event validation passed (Test Case 5.x)
- [ ] Error handling verified (Test Case 6.x)
- [ ] Performance acceptable (Test Case 7.x)

### Production Deployment
- [ ] Staging tests passed
- [ ] PostHog API key verified for production
- [ ] Event schemas documented in PostHog
- [ ] Dashboards created (see PostHog Setup Guide)
- [ ] Team trained on event meanings

### Post-Deployment Monitoring
- [ ] Check PostHog Live Events for first hour
- [ ] Verify event volume matches expectations
- [ ] Monitor error logs for PostHog failures
- [ ] Validate data quality in PostHog dashboard

---

## Troubleshooting

### Event Not Appearing

**Symptoms**: Expected event doesn't show in PostHog

**Checks**:
1. Verify `POSTHOG_KEY` is set and valid
2. Check server logs for `[PostHog]` messages
3. Verify PostHog client initialized: `getPostHogServerClient()` returns non-null
4. Check PostHog project filters (time range, event name)
5. Verify `distinctId` is not empty

**Common Issues**:
- Missing environment variable
- PostHog SDK version incompatible
- Network firewall blocking PostHog host

---

### Wrong `distinctId`

**Symptoms**: Event tracked with wrong user ID

**Checks**:
1. Survey events: Should use `personId` → `email` → `responseId` priority
2. Session events: Should use `user.sub` from Supabase auth
3. Agent events: Should use `userId` from auth context

**Fix**: Verify auth context is populated correctly

---

### Duplicate Events

**Symptoms**: Same event tracked multiple times

**Checks**:
1. `session_started`: Check cookie is being set correctly
2. Survey events: Check for retry logic
3. Agent events: Check stream flush callback called once

**Fix**: Add idempotency checks or verify fire-and-forget pattern

---

## Test Data Cleanup

After testing, clean up PostHog data:

```sql
-- Archive test events (PostHog SQL)
DELETE FROM events
WHERE distinct_id LIKE 'test+%'
  OR properties->>'survey_name' LIKE '%TEST%';
```

**Note**: PostHog may not support DELETE. Alternative: Filter out test data in dashboards.

---

## Automated Testing

See **Playwright Test Script** (`posthog-p1-events.spec.ts`) for automated E2E verification.

---

## References

- [PostHog Implementation Guide](./posthog-server-implementation-guide.md)
- [P1 Implementation Plan](./posthog-p1-implementation-plan.md)
- [PostHog Dashboard Setup](./posthog-dashboard-setup.md)
- [Team Documentation](./posthog-p1-team-docs.md)
