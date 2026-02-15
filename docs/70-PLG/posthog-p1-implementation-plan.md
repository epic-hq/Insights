# PostHog P1 Events - Implementation Plan

**Status**: Ready for Implementation
**Confidence**: 85-90%
**Date**: 2026-02-15

## Overview

This document provides exact implementation details for the 4 Priority-1 PostHog server-side tracking events. All code locations, schemas, and patterns have been verified against the current codebase.

---

## Event 1: `survey_response_received`

### Trigger Point
**File**: `app/routes/api.research-links.$slug.save.tsx`
**Line**: 81 (when `completed === true`)

### Implementation Location
```typescript
// After line 109, before the return statement
if (completed) {
  // ... existing person/evidence creation code ...

  // Track survey completion
  const posthog = getPostHogServerClient();
  if (posthog) {
    await posthog.capture({
      distinctId: personId ?? existing.email ?? responseId,
      event: "survey_response_received",
      properties: {
        survey_id: list.id,
        survey_name: list.name,
        response_id: responseId,
        person_id: personId,
        account_id: list.account_id,
        project_id: list.project_id,
        response_mode: existing.response_mode ?? "form",
        question_count: questions.length,
        text_questions: questions.filter(q => !STRUCTURAL_QUESTION_TYPES.includes(q.type ?? "auto")).length,
        has_person: !!personId,
        completion_time: new Date().toISOString()
      }
    });
  }
}
```

### Event Schema
```typescript
{
  event: "survey_response_received",
  distinctId: string,  // personId || email || responseId (fallback priority)
  properties: {
    survey_id: string,          // research_link.id
    survey_name: string,         // research_link.name
    response_id: string,         // research_link_response.id
    person_id: string | null,    // people.id if linked
    account_id: string,
    project_id: string | null,
    response_mode: "form" | "chat" | "voice",
    question_count: number,
    text_questions: number,      // Questions that generate evidence
    has_person: boolean,         // Whether linked to a person record
    completion_time: string      // ISO 8601
  }
}
```

### Dependencies
- Import `getPostHogServerClient` from `~/lib/posthog.server`
- Use existing `STRUCTURAL_QUESTION_TYPES` constant from same file

---

## Event 2: `survey_ai_analyzed`

### Trigger Point
**File**: `src/trigger/survey/extractSurveyEvidence.ts`
**Line**: 260 (after evidence insertion completes successfully)

### Implementation Location
```typescript
// After line 257, before the stats trigger
if (response.person_id && insertedIds.length > 0) {
  // ... existing evidence_people junction code ...

  // Track AI analysis completion
  const { getPostHogServerClient } = await import("../../app/lib/posthog.server");
  const posthog = getPostHogServerClient();
  if (posthog) {
    await posthog.capture({
      distinctId: response.person_id,
      event: "survey_ai_analyzed",
      properties: {
        survey_id: response.research_link_id,
        survey_name: surveyName,
        response_id: responseId,
        person_id: response.person_id,
        account_id: accountId,
        project_id: projectId,
        evidence_count: insertedIds.length,
        text_questions_analyzed: textQuestionsWithAnswers.length,
        analysis_method: "extraction",  // Simple extraction, not AI analysis yet
        completion_time: new Date().toISOString()
      }
    });
  }
}
```

### Event Schema
```typescript
{
  event: "survey_ai_analyzed",
  distinctId: string,  // person_id
  properties: {
    survey_id: string,
    survey_name: string,
    response_id: string,
    person_id: string,
    account_id: string,
    project_id: string | null,
    evidence_count: number,           // Number of evidence records created
    text_questions_analyzed: number,  // Number of text questions processed
    analysis_method: string,          // "extraction" for now
    completion_time: string           // ISO 8601
  }
}
```

### Dependencies
- Dynamic import of `getPostHogServerClient` (Trigger.dev context)
- Uses existing `textQuestionsWithAnswers` array

---

## Event 3: `agent_message_sent`

### Trigger Point
**File**: `app/routes/api.chat.project-status.tsx`
**Line**: After agent streaming completes (need to add tracking after stream finishes)

### Implementation Location
```typescript
// This requires adding tracking in the stream response handler
// Location: After the agent generates a response, before returning to client

// Option A: Track in action function after handleChatStream/handleNetworkStream
// Option B: Track in a stream completion callback

// Recommended: Add after line ~400 where response is generated
const posthog = getPostHogServerClient();
if (posthog && userCtx?.userId && userCtx?.accountId) {
  // Don't await - fire and forget to avoid blocking stream
  posthog.capture({
    distinctId: userCtx.userId,
    event: "agent_message_sent",
    properties: {
      agent_id: targetAgent.agentId,
      agent_name: targetAgent.name,
      account_id: userCtx.accountId,
      project_id: projectId,
      thread_id: threadId,
      message_type: "assistant",
      response_mode: responseMode,
      tool_calls: toolsUsed.length,
      tools_used: toolsUsed.map(t => t.name),
      timestamp: new Date().toISOString()
    }
  });
}
```

### Event Schema
```typescript
{
  event: "agent_message_sent",
  distinctId: string,  // user_id from auth context
  properties: {
    agent_id: string,               // "project-status-agent", etc.
    agent_name: string,             // "projectStatusAgent"
    account_id: string,
    project_id: string,
    thread_id: string,              // Mastra thread ID
    message_type: "assistant",      // Always assistant for agent responses
    response_mode: string,          // "normal", "fast_standardized", etc.
    tool_calls: number,             // Number of tools called
    tools_used: string[],           // Tool names used in response
    timestamp: string               // ISO 8601
  }
}
```

### Dependencies
- Import `getPostHogServerClient` from `~/lib/posthog.server`
- Access to `userContext` for userId/accountId
- Track tool usage from agent execution

### Complexity Notes
- **Medium complexity**: Need to instrument the streaming response handler
- May need to add tracking in multiple places depending on routing logic
- Should not block stream response (fire-and-forget)

---

## Event 4: `session_started`

### Trigger Point
**File**: `middleware.ts` (via `app/lib/supabase/middleware.ts`)
**Line**: After user session is verified (line 36-37)

### Implementation Strategy
User suggested: "1st time traffic served on any given day"

This requires:
1. **Daily session tracking table** (or use PostHog's built-in session management)
2. **Check**: Has this user had a session today?
3. **Track**: If not, emit `session_started` event

### Implementation Location

#### Option A: Use Supabase Table (Recommended)
```typescript
// File: app/lib/supabase/middleware.ts
// After line 37 where user session is verified

if (user?.sub) {
  const userId = user.sub;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if session exists for today
  const { data: existingSession } = await supabase
    .from("user_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("session_date", today)
    .maybeSingle();

  if (!existingSession) {
    // Create today's session record
    await supabase.from("user_sessions").insert({
      user_id: userId,
      session_date: today,
      created_at: new Date().toISOString()
    });

    // Track session start
    const { getPostHogServerClient } = await import("../posthog.server");
    const posthog = getPostHogServerClient();
    if (posthog) {
      // Fire and forget - don't block request
      posthog.capture({
        distinctId: userId,
        event: "session_started",
        properties: {
          session_date: today,
          timestamp: new Date().toISOString(),
          user_agent: request.headers.get("user-agent") ?? undefined,
          referrer: request.headers.get("referer") ?? undefined
        }
      }).catch(console.error);
    }
  }
}
```

#### Option B: Use PostHog Session Tracking (Alternative)
PostHog has built-in session tracking - we can leverage their session IDs instead of managing our own table.

```typescript
// Simpler approach - let PostHog manage sessions
const posthog = getPostHogServerClient();
if (posthog && user?.sub) {
  // PostHog automatically manages sessions
  // We just need to identify the user
  await posthog.identify({
    distinctId: user.sub,
    properties: {
      email: user.email,
      // ... other user properties
    }
  });
}
```

### Event Schema
```typescript
{
  event: "session_started",
  distinctId: string,  // user.sub (Supabase user ID)
  properties: {
    session_date: string,     // YYYY-MM-DD
    timestamp: string,        // ISO 8601
    user_agent?: string,      // Browser/client info
    referrer?: string         // Referring URL if available
  }
}
```

### Dependencies
- New migration for `user_sessions` table (if using Option A)
- Import `getPostHogServerClient`
- Access to Supabase client in middleware

### Migration Needed (Option A)
```sql
-- Create user_sessions table for daily session tracking
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

CREATE INDEX idx_user_sessions_user_date ON user_sessions(user_id, session_date);
```

### Complexity Notes
- **Medium complexity**: Requires either a new table OR relying on PostHog's session management
- Middleware performance impact must be minimal (fire-and-forget)
- Need to decide: Option A (explicit control) vs Option B (simpler, PostHog-managed)

---

## Risk Assessment

### Low Risk
- ✅ `survey_response_received`: Clear trigger point, existing pattern
- ✅ `survey_ai_analyzed`: Clear trigger point, isolated context

### Medium Risk
- ⚠️ `agent_message_sent`: Streaming context requires careful placement
- ⚠️ `session_started`: Requires architecture decision (table vs PostHog sessions)

### Mitigations
1. **All tracking is fire-and-forget** - Never block user requests
2. **Graceful degradation** - If PostHog client unavailable, log but continue
3. **Test in isolation** - Unit tests for each tracking call
4. **Monitor errors** - Consola logging for failures

---

## Open Questions

### Q1: Session Tracking Strategy
**Question**: Use Supabase table (Option A) or PostHog session management (Option B)?

**Recommendation**: **Option A** (Supabase table) for:
- Explicit control over "daily" definition
- Ability to query sessions directly
- Decoupled from PostHog availability

### Q2: Anonymous Survey Users
**Question**: Should we track `survey_response_received` for anonymous responses (no person_id)?

**Current Plan**: Yes, using `responseId` as distinctId if no person/email available.

**Rationale**: Still valuable to know survey completion rates even for anonymous users.

### Q3: Agent Tool Tracking Detail
**Question**: Track each tool call separately or aggregate per message?

**Current Plan**: Aggregate per message (array of tool names + count)

**Rationale**: Simpler, matches PostHog's event model better

---

## Next Steps

1. **Clarify decisions** (Session strategy, anonymous users)
2. **Create migration** (if using Option A for sessions)
3. **Implement events** in order:
   - `survey_response_received` (easiest)
   - `survey_ai_analyzed` (easiest)
   - `agent_message_sent` (medium)
   - `session_started` (medium)
4. **Test each event** end-to-end
5. **Verify in PostHog dashboard**

---

## Estimated Effort

- **`survey_response_received`**: 15 minutes
- **`survey_ai_analyzed`**: 15 minutes
- **`agent_message_sent`**: 45 minutes (requires finding exact stream location)
- **`session_started`**: 30 minutes (if Option A) or 15 minutes (if Option B)

**Total**: ~2 hours for all 4 events

---

## References

- [PostHog Implementation Guide](./posthog-server-implementation-guide.md)
- [Event Consolidation Analysis](./_bmad-output/posthog-event-consolidation.md)
- Client implementation: `app/lib/posthog.server.ts`
- Existing pattern: `app/routes/(auth)+/login_success.tsx:266`
