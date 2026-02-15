# PostHog P1 Events - Team Documentation

**Version**: 1.0
**Date**: 2026-02-15
**Audience**: Product, Engineering, Marketing Teams

---

## Overview

We've implemented server-side event tracking in PostHog to measure Product-Led Growth (PLG) metrics. This document explains what events we track, why they matter, and how to use them.

---

## What We Track

### 1. Survey Completions (`survey_response_received`)

**What it is**: Fires when someone completes a survey (form, chat, or voice mode)

**Why it matters**:
- Measures survey engagement and conversion
- Tracks different response modes (form vs chat vs voice)
- Identifies anonymous vs identified respondents

**Example Use Cases**:
- "What's our survey completion rate this month?"
- "Are users preferring chat mode over forms?"
- "How many anonymous responses are we getting?"

**Properties Tracked**:
- Survey name and ID
- Response mode (form/chat/voice)
- Whether user is identified (has email/person record)
- Number of questions (total and text-based)

---

### 2. AI Analysis Completion (`survey_ai_analyzed`)

**What it is**: Fires when our AI finishes extracting evidence from survey responses

**Why it matters**:
- Monitors AI processing performance
- Ensures survey data is being analyzed properly
- Tracks time-to-insight (survey → AI analysis)

**Example Use Cases**:
- "How long does AI processing take?"
- "What % of surveys complete AI analysis?"
- "Are we generating evidence from responses?"

**Properties Tracked**:
- Number of evidence records created
- Number of text questions analyzed
- Analysis method used

---

### 3. Daily Sessions (`session_started`)

**What it is**: Fires once per day when a user logs in for the first time that day

**Why it matters**:
- Measures Daily Active Users (DAU)
- Tracks user engagement and retention
- Foundation for cohort analysis

**Example Use Cases**:
- "How many daily active users do we have?"
- "Is our DAU growing week-over-week?"
- "What's our user stickiness (DAU/WAU)?"

**Properties Tracked**:
- Session date
- User agent (browser/device)
- Referrer (where they came from)

---

### 4. Agent Messages (`agent_message_sent`)

**What it is**: Fires when our AI agent completes a chat response

**Why it matters**:
- Measures agent usage and engagement
- Tracks which tools/features are used most
- Monitors agent performance

**Example Use Cases**:
- "Which AI agent do users interact with most?"
- "How often are agents using tools vs simple responses?"
- "What are the most popular agent tools?"

**Properties Tracked**:
- Agent type (projectStatus, chiefOfStaff, research, etc.)
- Number of tools called
- Tool names used
- Response mode (normal, fast, specialized)

---

## How to Use This Data

### For Product Managers

**Question**: "Should we invest more in chat mode surveys?"

**How to Answer**:
1. Go to PostHog → Survey Analytics dashboard
2. Check "Response Mode Distribution" insight
3. Look at trend over time
4. If chat mode usage is growing and completion rate is high → invest more

---

**Question**: "Which agent features should we prioritize?"

**How to Answer**:
1. Go to PostHog → Agent Performance dashboard
2. Check "Tool Usage Frequency" insight
3. Top tools = high-value features
4. Build more features around popular tools

---

### For Marketing Teams

**Question**: "What's our user activation rate?"

**How to Answer**:
1. Go to PostHog → PLG Funnel dashboard
2. Check "Survey Completion Rate" funnel
3. Compare across campaigns/sources
4. Optimize campaigns with low completion rates

---

**Question**: "Are we acquiring or retaining users?"

**How to Answer**:
1. Go to PostHog → User Engagement dashboard
2. Check "New vs Returning Users" insight
3. Healthy mix: 20-30% new, 70-80% returning
4. If too many new → focus on retention

---

### For Engineering Teams

**Question**: "Is our AI analysis performant?"

**How to Answer**:
1. Go to PostHog → PLG Funnel dashboard
2. Check "Survey → AI Analysis Latency" insight
3. P95 should be < 30 seconds
4. If higher → investigate Trigger.dev task bottlenecks

---

**Question**: "Are agent responses reliable?"

**How to Answer**:
1. Compare `agent_message_sent` count to total chat API requests (from logs)
2. Success rate should be > 95%
3. If lower → check streaming errors in logs

---

## Event Schemas Reference

### `survey_response_received`
```typescript
{
  event: "survey_response_received",
  distinctId: string,  // person_id OR email OR response_id
  properties: {
    survey_id: string,
    survey_name: string,
    response_id: string,
    person_id: string | null,
    account_id: string,
    project_id: string | null,
    response_mode: "form" | "chat" | "voice",
    question_count: number,
    text_questions: number,
    has_person: boolean,
    completion_time: string (ISO 8601)
  }
}
```

---

### `survey_ai_analyzed`
```typescript
{
  event: "survey_ai_analyzed",
  distinctId: string,  // person_id (UUID)
  properties: {
    survey_id: string,
    survey_name: string,
    response_id: string,
    person_id: string,
    account_id: string,
    project_id: string | null,
    evidence_count: number,
    text_questions_analyzed: number,
    analysis_method: "extraction",
    completion_time: string (ISO 8601)
  }
}
```

---

### `session_started`
```typescript
{
  event: "session_started",
  distinctId: string,  // user_id (Supabase auth.users.id)
  properties: {
    session_date: string (YYYY-MM-DD),
    timestamp: string (ISO 8601),
    user_agent?: string,
    referrer?: string
  }
}
```

---

### `agent_message_sent`
```typescript
{
  event: "agent_message_sent",
  distinctId: string,  // user_id
  properties: {
    agent_id: string,
    agent_name: string,
    account_id: string,
    project_id: string,
    thread_id: string,
    message_type: "assistant",
    response_mode: string,
    tool_calls: number,
    tools_used: string[],
    timestamp: string (ISO 8601)
  }
}
```

---

## Common Questions

### Q: Why do some survey events have email as `distinctId` and others have UUID?

**A**: We use a priority system for surveys:
1. If user is identified (has person record) → use `person_id` (UUID)
2. If no person but has email → use `email`
3. If anonymous → use `response_id` (UUID)

This allows us to track both identified and anonymous users while maintaining proper person profiles in PostHog.

---

### Q: Why don't I see `session_started` events for all my page views?

**A**: `session_started` only fires **once per day** per user (on first authenticated request). It's designed to measure Daily Active Users (DAU), not total traffic.

For page view analytics, use client-side PostHog tracking (separate implementation).

---

### Q: What's the difference between `agent_id` and `agent_name`?

**A**: They're currently the same value (e.g., `"projectStatusAgent"`). Both are included for consistency with PostHog conventions and future flexibility.

---

### Q: Can I see real-time events?

**A**: Yes! Go to PostHog → Live Events. You'll see events appear within 1-2 seconds of occurrence.

---

### Q: How do I filter by my own test data?

**A**: Use test email addresses like `test+posthog@example.com`. Then create filters in PostHog insights:
```
Filters: distinct_id does not contain "test+"
```

---

## Best Practices

### DO ✅

- **Use dashboards daily**: Check metrics as part of your workflow
- **Set up alerts**: Get notified of anomalies immediately
- **Combine events**: Create funnels and cohorts across multiple events
- **Export data**: Use PostHog CSV export for deeper analysis
- **Share insights**: Add comments to insights explaining findings

### DON'T ❌

- **Don't delete events**: Even test data has value for debugging
- **Don't rely on single metrics**: Always look at multiple angles
- **Don't ignore anomalies**: If something looks weird, investigate
- **Don't compare apples to oranges**: Ensure date ranges match when comparing
- **Don't forget filters**: Always check if filters are applied

---

## Dashboards Quick Reference

| Dashboard | URL | Primary Use |
|-----------|-----|-------------|
| PLG Funnel Overview | `/project/{id}/dashboard/plg-funnel` | Executive metrics |
| Survey Analytics | `/project/{id}/dashboard/survey-analytics` | Survey performance |
| Agent Performance | `/project/{id}/dashboard/agent-performance` | AI agent metrics |
| User Engagement | `/project/{id}/dashboard/user-engagement` | Retention & growth |

_(Update URLs after dashboards are created)_

---

## Getting Help

### PostHog Documentation
- [PostHog Insights Guide](https://posthog.com/docs/user-guides/insights)
- [PostHog Funnels Guide](https://posthog.com/docs/user-guides/funnels)
- [PostHog SQL Guide](https://posthog.com/docs/hogql)

### Internal Resources
- [Implementation Details](./posthog-p1-implementation-plan.md) (for engineers)
- [Dashboard Setup](./posthog-dashboard-setup.md) (for analysts)
- [Test Plan](./posthog-p1-test-plan.md) (for QA)

### Support Channels
- **PostHog Questions**: #analytics Slack channel
- **Event Issues**: #engineering Slack channel
- **Dashboard Requests**: Create issue in project tracker

---

## Changelog

### 2026-02-15 - Initial Release
- Implemented 4 P1 server-side events
- Created dashboards and alerts
- Published team documentation

---

## Future Enhancements

### Coming Soon
- [ ] Client-side pageview tracking
- [ ] Conversion funnel tracking (signup → activation)
- [ ] Feature flag events (A/B test tracking)
- [ ] Error tracking events (user-facing errors)
- [ ] Performance events (page load times)

### Under Consideration
- [ ] Revenue events (subscription changes)
- [ ] Collaboration events (team invites, shares)
- [ ] Content engagement (evidence views, theme clicks)
- [ ] Export events (download reports, share links)

---

**Questions?** Ask in #analytics or tag @data-team
