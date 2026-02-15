# PostHog P1 Events - Dashboard Setup Guide

**Version**: 1.0
**Date**: 2026-02-15
**Purpose**: Configure PostHog dashboards and insights for P1 server-side events

---

## Overview

This guide walks you through creating PostHog dashboards to monitor and analyze the 4 Priority-1 server-side tracking events:

1. **`survey_response_received`** - Survey completion metrics
2. **`survey_ai_analyzed`** - AI analysis performance
3. **`session_started`** - Daily active users & engagement
4. **`agent_message_sent`** - Agent usage & tool effectiveness

---

## Dashboard 1: PLG Funnel Overview

**Purpose**: High-level product-led growth metrics

### Insights to Create

#### 1.1 Daily Active Users (DAU)
**Type**: Trend
**Event**: `session_started`
**Formula**: Unique users (count distinct `distinct_id`)
**Breakdown**: None
**Date Range**: Last 30 days
**Chart Type**: Line chart

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: session_started
    Math: Unique users
Filters: None
Group by: Day
```

**What it shows**: Daily active users (first login per day)

---

#### 1.2 Survey Completion Rate
**Type**: Funnel
**Events**:
1. Survey started (proxy: any session where survey link accessed)
2. `survey_response_received`

**Formula**: (Completions / Starts) × 100%

**PostHog Setup**:
```
Insight Type: Funnel
Steps:
  1. Pageview: /ask/*
  2. Event: survey_response_received
Filters: None
Conversion window: 1 hour
```

**What it shows**: % of survey visitors who complete

---

#### 1.3 Agent Engagement
**Type**: Trend
**Event**: `agent_message_sent`
**Formula**: Total count
**Breakdown**: `agent_id`
**Date Range**: Last 7 days
**Chart Type**: Stacked bar chart

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: agent_message_sent
    Math: Total count
Breakdown: properties.agent_id
Group by: Day
```

**What it shows**: Which agents are used most

---

#### 1.4 Survey to AI Analysis Latency
**Type**: SQL Insight
**Query**:
```sql
WITH survey_pairs AS (
  SELECT
    properties->>'response_id' as response_id,
    MIN(CASE WHEN event = 'survey_response_received' THEN timestamp END) as survey_time,
    MIN(CASE WHEN event = 'survey_ai_analyzed' THEN timestamp END) as analysis_time
  FROM events
  WHERE event IN ('survey_response_received', 'survey_ai_analyzed')
    AND timestamp > now() - interval '7 days'
  GROUP BY response_id
  HAVING MIN(CASE WHEN event = 'survey_response_received' THEN timestamp END) IS NOT NULL
     AND MIN(CASE WHEN event = 'survey_ai_analyzed' THEN timestamp END) IS NOT NULL
)
SELECT
  date_trunc('day', survey_time) as day,
  AVG(EXTRACT(EPOCH FROM (analysis_time - survey_time))) as avg_latency_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (analysis_time - survey_time))) as p50_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (analysis_time - survey_time))) as p95_latency
FROM survey_pairs
GROUP BY day
ORDER BY day DESC;
```

**What it shows**: How long AI analysis takes (SLA monitoring)

---

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  PLG Funnel Overview                            │
├─────────────────┬───────────────────────────────┤
│ Daily Active    │  Survey Completion Rate       │
│ Users (DAU)     │  [Funnel]                     │
│ [Line Chart]    │                               │
├─────────────────┼───────────────────────────────┤
│ Agent Engagement (by agent)                     │
│ [Stacked Bar Chart]                             │
├──────────────────────────────────────────────────┤
│ Survey → AI Analysis Latency                    │
│ [Table: Avg, P50, P95 by day]                   │
└──────────────────────────────────────────────────┘
```

---

## Dashboard 2: Survey Analytics

**Purpose**: Deep dive into survey performance

### Insights to Create

#### 2.1 Survey Completions by Name
**Type**: Trend
**Event**: `survey_response_received`
**Breakdown**: `properties.survey_name`
**Date Range**: Last 30 days

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: survey_response_received
    Math: Total count
Breakdown: properties.survey_name
Group by: Day
```

**What it shows**: Which surveys are most active

---

#### 2.2 Response Mode Distribution
**Type**: Pie Chart
**Event**: `survey_response_received`
**Breakdown**: `properties.response_mode`
**Date Range**: Last 7 days

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: survey_response_received
    Math: Total count
Breakdown: properties.response_mode
Display: Pie chart
```

**What it shows**: Form vs Chat vs Voice usage

---

#### 2.3 Anonymous vs Identified Responses
**Type**: Trend
**Event**: `survey_response_received`
**Breakdown**: `properties.has_person`
**Date Range**: Last 30 days

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: survey_response_received
    Math: Total count
Breakdown: properties.has_person
Group by: Week
```

**What it shows**: Identity capture rate

---

#### 2.4 Average Text Questions per Survey
**Type**: SQL Insight
**Query**:
```sql
SELECT
  properties->>'survey_name' as survey_name,
  AVG((properties->>'text_questions')::int) as avg_text_questions,
  COUNT(*) as total_responses
FROM events
WHERE event = 'survey_response_received'
  AND timestamp > now() - interval '30 days'
GROUP BY survey_name
ORDER BY total_responses DESC;
```

**What it shows**: Survey complexity & evidence generation potential

---

#### 2.5 AI Analysis Success Rate
**Type**: SQL Insight
**Query**:
```sql
WITH survey_counts AS (
  SELECT
    properties->>'response_id' as response_id,
    COUNT(CASE WHEN event = 'survey_response_received' THEN 1 END) as survey_count,
    COUNT(CASE WHEN event = 'survey_ai_analyzed' THEN 1 END) as analysis_count
  FROM events
  WHERE event IN ('survey_response_received', 'survey_ai_analyzed')
    AND timestamp > now() - interval '7 days'
  GROUP BY response_id
)
SELECT
  date_trunc('day', e.timestamp) as day,
  COUNT(DISTINCT sc.response_id) FILTER (WHERE sc.analysis_count > 0) as analyzed,
  COUNT(DISTINCT sc.response_id) as total,
  ROUND(100.0 * COUNT(DISTINCT sc.response_id) FILTER (WHERE sc.analysis_count > 0) / NULLIF(COUNT(DISTINCT sc.response_id), 0), 1) as success_rate_pct
FROM survey_counts sc
JOIN events e ON e.properties->>'response_id' = sc.response_id AND e.event = 'survey_response_received'
GROUP BY day
ORDER BY day DESC;
```

**What it shows**: % of surveys that complete AI processing

---

### Dashboard Layout

```
┌──────────────────────────────────────────────────┐
│  Survey Analytics                                │
├─────────────────┬────────────────────────────────┤
│ Completions by  │  Response Mode Distribution    │
│ Survey Name     │  [Pie Chart]                   │
│ [Stacked Area]  │                                │
├─────────────────┼────────────────────────────────┤
│ Anonymous vs Identified                          │
│ [Stacked Bar]                                    │
├──────────────────────────────────────────────────┤
│ Avg Text Questions per Survey                    │
│ [Table]                                          │
├──────────────────────────────────────────────────┤
│ AI Analysis Success Rate                         │
│ [Table with %]                                   │
└──────────────────────────────────────────────────┘
```

---

## Dashboard 3: Agent Performance

**Purpose**: Monitor agent effectiveness and tool usage

### Insights to Create

#### 3.1 Agent Usage Over Time
**Type**: Trend
**Event**: `agent_message_sent`
**Breakdown**: `properties.agent_id`
**Date Range**: Last 14 days

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: agent_message_sent
    Math: Total count
Breakdown: properties.agent_id
Group by: Day
Chart: Line (multi-series)
```

**What it shows**: Agent usage trends

---

#### 3.2 Tool Usage Frequency
**Type**: SQL Insight
**Query**:
```sql
SELECT
  tool,
  COUNT(*) as usage_count,
  COUNT(DISTINCT distinct_id) as unique_users
FROM events,
LATERAL unnest(string_to_array(properties->>'tools_used', ',')) as tool
WHERE event = 'agent_message_sent'
  AND timestamp > now() - interval '7 days'
  AND properties->>'tools_used' != '[]'
GROUP BY tool
ORDER BY usage_count DESC
LIMIT 20;
```

**What it shows**: Most popular tools (feature usage)

---

#### 3.3 Messages with Tool Calls vs No Tools
**Type**: Trend
**Event**: `agent_message_sent`
**Formula**: Count where `properties.tool_calls > 0` vs `= 0`
**Date Range**: Last 7 days

**PostHog Setup**:
```
Insight Type: Trend
Series:
  1. Event: agent_message_sent
     Math: Total count
     Filters: properties.tool_calls > 0
  2. Event: agent_message_sent
     Math: Total count
     Filters: properties.tool_calls = 0
Group by: Day
Display: Stacked bar
```

**What it shows**: Agent autonomy (tool usage rate)

---

#### 3.4 Average Tools per Message by Agent
**Type**: SQL Insight
**Query**:
```sql
SELECT
  properties->>'agent_id' as agent,
  AVG((properties->>'tool_calls')::int) as avg_tools_per_message,
  COUNT(*) as total_messages
FROM events
WHERE event = 'agent_message_sent'
  AND timestamp > now() - interval '7 days'
GROUP BY agent
ORDER BY avg_tools_per_message DESC;
```

**What it shows**: Which agents rely on tools most

---

#### 3.5 Response Mode Distribution
**Type**: Pie Chart
**Event**: `agent_message_sent`
**Breakdown**: `properties.response_mode`

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: agent_message_sent
    Math: Total count
Breakdown: properties.response_mode
Display: Pie chart
```

**What it shows**: Normal vs Fast vs specialized response modes

---

### Dashboard Layout

```
┌──────────────────────────────────────────────────┐
│  Agent Performance                               │
├─────────────────┬────────────────────────────────┤
│ Agent Usage     │  Tool Usage Frequency          │
│ Over Time       │  [Table: Top 20]               │
│ [Multi-line]    │                                │
├─────────────────┼────────────────────────────────┤
│ Messages with Tools vs No Tools                  │
│ [Stacked Bar]                                    │
├──────────────────────────────────────────────────┤
│ Avg Tools/Message by Agent                       │
│ [Table]                                          │
├──────────────────────────────────────────────────┤
│ Response Mode Distribution                       │
│ [Pie Chart]                                      │
└──────────────────────────────────────────────────┘
```

---

## Dashboard 4: User Engagement

**Purpose**: Track user activity and retention

### Insights to Create

#### 4.1 Daily Active Users Trend
**Type**: Trend
**Event**: `session_started`
**Formula**: Unique users
**Date Range**: Last 90 days

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: session_started
    Math: Unique users
Group by: Day
Smoothing: 7-day rolling average (optional)
```

**What it shows**: User growth and retention

---

#### 4.2 Weekly Active Users (WAU)
**Type**: Trend
**Event**: `session_started`
**Formula**: Unique users
**Date Range**: Last 12 weeks
**Group by**: Week

**PostHog Setup**:
```
Insight Type: Trend
Series:
  - Event: session_started
    Math: Unique users
Group by: Week
```

**What it shows**: Weekly engagement trends

---

#### 4.3 User Stickiness (DAU/WAU)
**Type**: SQL Insight
**Query**:
```sql
WITH daily_users AS (
  SELECT
    date_trunc('day', timestamp) as day,
    COUNT(DISTINCT distinct_id) as dau
  FROM events
  WHERE event = 'session_started'
    AND timestamp > now() - interval '30 days'
  GROUP BY day
),
weekly_users AS (
  SELECT
    date_trunc('week', timestamp) as week,
    COUNT(DISTINCT distinct_id) as wau
  FROM events
  WHERE event = 'session_started'
    AND timestamp > now() - interval '30 days'
  GROUP BY week
)
SELECT
  du.day,
  du.dau,
  wu.wau,
  ROUND(100.0 * du.dau / NULLIF(wu.wau, 0), 1) as stickiness_pct
FROM daily_users du
JOIN weekly_users wu ON date_trunc('week', du.day) = wu.week
ORDER BY du.day DESC;
```

**What it shows**: User engagement quality (higher = better retention)

---

#### 4.4 New vs Returning Users
**Type**: SQL Insight
**Query**:
```sql
WITH first_sessions AS (
  SELECT
    distinct_id,
    MIN(timestamp) as first_session
  FROM events
  WHERE event = 'session_started'
  GROUP BY distinct_id
)
SELECT
  date_trunc('day', e.timestamp) as day,
  COUNT(DISTINCT e.distinct_id) FILTER (WHERE date_trunc('day', e.timestamp) = date_trunc('day', fs.first_session)) as new_users,
  COUNT(DISTINCT e.distinct_id) FILTER (WHERE date_trunc('day', e.timestamp) > date_trunc('day', fs.first_session)) as returning_users
FROM events e
JOIN first_sessions fs ON e.distinct_id = fs.distinct_id
WHERE e.event = 'session_started'
  AND e.timestamp > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;
```

**What it shows**: User acquisition vs retention

---

### Dashboard Layout

```
┌──────────────────────────────────────────────────┐
│  User Engagement                                 │
├──────────────────────────────────────────────────┤
│ Daily Active Users Trend                         │
│ [Line chart with 7-day avg]                      │
├─────────────────┬────────────────────────────────┤
│ Weekly Active   │  User Stickiness (DAU/WAU)     │
│ Users (WAU)     │  [Table]                       │
│ [Bar chart]     │                                │
├──────────────────────────────────────────────────┤
│ New vs Returning Users                           │
│ [Stacked area chart]                             │
└──────────────────────────────────────────────────┘
```

---

## Alerts & Monitoring

### Recommended Alerts

#### Alert 1: Survey Analysis Latency Spike
**Trigger**: `survey_ai_analyzed` latency > 60 seconds (P95)
**Action**: Investigate Trigger.dev task performance

**Setup**:
```
Alert Type: Insight anomaly
Insight: Survey → AI Analysis Latency (P95)
Threshold: > 60 seconds
Frequency: Every 15 minutes
Notify: #engineering-alerts Slack channel
```

---

#### Alert 2: Survey Completion Drop
**Trigger**: Survey completion rate < 30%
**Action**: Check survey UX issues

**Setup**:
```
Alert Type: Funnel drop
Insight: Survey Completion Rate
Threshold: < 30%
Frequency: Daily
Notify: #product Slack channel
```

---

#### Alert 3: Agent Errors
**Trigger**: Agent response rate < 90%
**Action**: Check agent streaming errors

**Setup**:
- Create insight comparing `agent_message_sent` to total chat requests
- Alert if ratio < 0.9

---

#### Alert 4: DAU Drop
**Trigger**: DAU drops > 20% day-over-day
**Action**: Investigate service issues or churn

**Setup**:
```
Alert Type: Insight anomaly
Insight: Daily Active Users
Threshold: -20% change
Frequency: Daily
Notify: #executive Slack channel
```

---

## Event Data Validation

### Recommended Queries for Data Quality

#### Check for Missing Properties
```sql
SELECT
  event,
  COUNT(*) FILTER (WHERE properties->>'account_id' IS NULL) as missing_account_id,
  COUNT(*) FILTER (WHERE properties->>'project_id' IS NULL) as missing_project_id,
  COUNT(*) as total
FROM events
WHERE event IN (
  'survey_response_received',
  'survey_ai_analyzed',
  'session_started',
  'agent_message_sent'
)
  AND timestamp > now() - interval '24 hours'
GROUP BY event;
```

**Expected**: All events should have `account_id` and `project_id` (except session_started which has no project context)

---

#### Check distinctId Formats
```sql
SELECT
  event,
  COUNT(*) FILTER (WHERE distinct_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as valid_uuid_count,
  COUNT(*) FILTER (WHERE distinct_id LIKE '%@%') as email_count,
  COUNT(*) as total
FROM events
WHERE event IN ('survey_response_received', 'survey_ai_analyzed', 'session_started', 'agent_message_sent')
  AND timestamp > now() - interval '24 hours'
GROUP BY event;
```

**Expected**:
- `session_started`: 100% UUID
- `agent_message_sent`: 100% UUID
- `survey_ai_analyzed`: 100% UUID
- `survey_response_received`: Mix of UUID + emails (depending on anonymous vs identified)

---

## PostHog Project Setup

### Event Definitions

Create event definitions in PostHog for better discoverability:

**survey_response_received**:
```
Name: Survey Response Received
Description: Tracks when a user completes a survey (form, chat, or voice mode)
Tags: surveys, conversion, plg
Properties:
  - survey_id (string, required)
  - survey_name (string, required)
  - response_mode (string, required) - form|chat|voice
  - has_person (boolean, required)
  - text_questions (number, required)
```

**survey_ai_analyzed**:
```
Name: Survey AI Analyzed
Description: Tracks when AI evidence extraction completes for a survey response
Tags: surveys, ai, backend
Properties:
  - evidence_count (number, required)
  - text_questions_analyzed (number, required)
  - analysis_method (string, required) - extraction
```

**session_started**:
```
Name: Session Started
Description: Tracks the first authenticated request of each day per user
Tags: engagement, dau, sessions
Properties:
  - session_date (string, required) - YYYY-MM-DD
  - user_agent (string, optional)
```

**agent_message_sent**:
```
Name: Agent Message Sent
Description: Tracks when an AI agent completes a chat response
Tags: agent, chat, ai
Properties:
  - agent_id (string, required)
  - response_mode (string, required)
  - tool_calls (number, required)
  - tools_used (array, required)
```

---

## Next Steps

1. ✅ Create dashboards in PostHog using layouts above
2. ✅ Set up alerts for critical metrics
3. ✅ Define events in PostHog project settings
4. ✅ Share dashboard links with team
5. ✅ Schedule weekly review of metrics

---

## References

- [PostHog Dashboards Documentation](https://posthog.com/docs/user-guides/dashboards)
- [PostHog Insights Documentation](https://posthog.com/docs/user-guides/insights)
- [PostHog Alerts Documentation](https://posthog.com/docs/user-guides/alerts)
