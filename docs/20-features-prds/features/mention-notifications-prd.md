# @Mention Notifications PRD

## Problem Statement

Users can now @mention team members and project people in comments on entities (insights, opportunities, tasks, etc.). However, mentioned users have no way of knowing they've been mentioned unless they happen to visit the entity page.

**Current State:**
- @mentions are stored in `content_jsonb.mentions` with user IDs
- No notification system exists
- Mentioned users are unaware of mentions

**Desired Outcome:**
- Mentioned users are promptly notified
- Notifications drive engagement and action
- System scales without overwhelming users

---

## Existing Infrastructure (Ready to Use)

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| **Email Service** | Production-Ready | `app/emails/` | Engage.so integrated, React templates |
| **Activity Storage** | Exists (Tasks) | `supabase/schemas/43_tasks.sql` | task_activity table pattern |
| **Toast Notifications** | Exists | `app/contexts/NotificationContext.tsx` | Client-side toast system |
| **Dashboard Feed** | Exists | `app/features/dashboard-v3/components/LensFeed.tsx` | Shows lens activities |
| **User Preferences** | Ready | `user_settings.notification_preferences` | Empty JSONB column |
| **Background Jobs** | Production-Ready | `src/trigger/` | Trigger.dev v4 available |

---

## Options Analysis

### Option A: Email Notifications

**Description:** Send an email when a user is @mentioned.

**Implementation:**
1. Trigger.dev task listens for new annotations with mentions
2. For each mentioned user, send email via Resend/Postmark
3. Email contains: who mentioned them, context snippet, link to entity

**Pros:**
- Works even when user is offline
- Familiar pattern (GitHub, Notion, etc.)
- No new UI required
- High deliverability

**Cons:**
- Can feel slow (not real-time)
- Email fatigue if overused
- Requires email service setup
- Users may miss if inbox is cluttered

**Complexity:** Low-Medium
**Time to implement:** 2-3 days

---

### Option B: In-App Notification Center

**Description:** Add a notification bell/inbox in the app header showing recent mentions and activity.

**Implementation:**
1. New `notifications` table storing user notifications
2. Bell icon in header with unread count badge
3. Dropdown/panel showing recent notifications
4. Click to navigate to mentioned entity

**Database Schema:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'mention', 'reply', 'assignment'
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  source_user_id UUID, -- who triggered it
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Pros:**
- Real-time visibility when in app
- Central place for all notifications
- Can batch/group related notifications
- Foundation for other notification types (assignments, replies, etc.)

**Cons:**
- Requires new UI component
- Only works when user is in app
- Need to handle notification overflow/cleanup

**Complexity:** Medium
**Time to implement:** 3-5 days

---

### Option C: Real-Time Toast Notifications

**Description:** Show a toast notification immediately when mentioned (if user is online).

**Implementation:**
1. Supabase Realtime subscription on notifications table
2. Toast component shows when new notification arrives
3. Click toast to navigate to entity

**Pros:**
- Instant feedback
- Non-intrusive
- Great UX when both users are online

**Cons:**
- Only works if user is currently in app
- Toasts can be missed
- Need fallback for offline users

**Complexity:** Medium
**Time to implement:** 2-3 days (assumes Option B infrastructure)

---

### Option D: Slack/Teams Integration

**Description:** Send mention notifications to connected Slack/Teams workspace.

**Implementation:**
1. OAuth integration with Slack/Teams
2. Map Insights users to Slack/Teams users
3. Send DM or channel message on mention

**Pros:**
- Meets users where they already are
- High visibility
- Enables quick response via Slack

**Cons:**
- Requires workspace admin approval
- Complex OAuth setup
- User mapping is tricky
- Not all teams use Slack/Teams

**Complexity:** High
**Time to implement:** 1-2 weeks

---

### Option E: Daily/Weekly Digest Email

**Description:** Instead of immediate emails, send a digest of mentions and activity.

**Implementation:**
1. Scheduled Trigger.dev task (daily or weekly)
2. Aggregate unread mentions per user
3. Send single digest email

**Pros:**
- Reduces email noise
- Users can process in batches
- Lower implementation complexity than real-time

**Cons:**
- Delayed (not suitable for urgent mentions)
- May feel less engaging
- Users might ignore digests

**Complexity:** Low
**Time to implement:** 1-2 days

---

## Recommendation

### Phase 1: Email + In-App Notifications (Recommended)

Implement **Option A (Email)** + **Option B (In-App Notification Center)** together.

**Rationale:**
1. Email ensures delivery even when offline (critical for async teams)
2. In-app center provides visibility and a place to manage notifications
3. Foundation for future notification types (task assignments, AI suggestions, etc.)
4. Matches user expectations from other tools (GitHub, Linear, Notion)

### Phase 2: Enhancements

After Phase 1 is validated:
1. Add **Option C (Real-Time Toasts)** for instant feedback
2. Add user preferences for notification frequency/channels
3. Consider **Option D (Slack)** if customer demand exists

---

## User Preferences (Future)

Allow users to configure notification preferences:

| Setting | Options |
|---------|---------|
| Email notifications | Immediate / Daily digest / Off |
| In-app notifications | On / Off |
| Mention notifications | All / Only direct mentions / Off |
| Quiet hours | e.g., No notifications 6pm-8am |

---

## Notification Content

### Email Template

**Subject:** `[Project Name] @Richard mentioned you in a comment`

**Body:**
```
Richard Moy mentioned you in a comment on "Enterprise pricing feedback" (Insight):

"Hey @Sarah, can you review this insight? I think it's relevant to the pricing strategy we discussed."

View comment: [Link to entity]

---
Insights · Unsubscribe from mention emails
```

### In-App Notification

```
Richard mentioned you
"Hey @Sarah, can you review this insight..."
Enterprise pricing feedback · 5 minutes ago
```

---

## Technical Considerations

### Mention Types

| Mention Type | Notification? | Notes |
|--------------|---------------|-------|
| Team member (`type: "user"`) | Yes | Has user account, can receive notifications |
| Project person (`type: "person"`) | No* | No user account, cannot receive notifications |

*Project people (interview participants) don't have accounts. Consider future: invite to view?

### Deduplication

- Don't notify if user mentions themselves
- Batch multiple mentions in same comment into one notification
- Consider cooldown if same user mentions same person repeatedly

### Performance

- Use Trigger.dev for async notification delivery
- Don't block comment submission on notification sending
- Index `notifications` table by `user_id, read_at` for efficient queries

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Notification delivery rate | >99% |
| Time to notification (email) | <2 minutes |
| Click-through rate on notifications | >20% |
| User preference opt-out rate | <30% |

---

## Design Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Notify on edits?** | Yes | If a comment is edited to add a new mention, notify the newly mentioned user |
| **Reply threading?** | Yes | Replies to a comment should notify the original commenter |
| **Person mentions?** | Yes | Offer to invite mentioned project people to view (future enhancement) |
| **Notification locations** | Dashboard Activity Feed + Dedicated Notification Center | Activity feed for context, notification center for actionable items |

---

## Next Steps

1. [ ] Validate approach with team
2. [ ] Design notification center UI (bell icon, dropdown)
3. [ ] Create `notifications` table schema
4. [ ] Implement Trigger.dev task for creating notifications on mention
5. [ ] Implement email sending via Resend
6. [ ] Build notification center component
7. [ ] Add user notification preferences

---

## Related Documentation

- [Entity Annotations System](/docs/features/entity-annotations.md)
- [Annotations Quick Start](/docs/quick-reference/annotations-quick-start.md)
- Key files: `app/components/ui/mention-input.tsx`, `app/features/annotations/db.ts`

---

# Implementation Plan

## Phase 1: Database & Core Infrastructure

### 1.1 Database Schema

**File:** `supabase/schemas/45_notifications.sql`

```sql
-- =============================================================================
-- NOTIFICATIONS SCHEMA
-- Stores user notifications for @mentions, replies, assignments, etc.
-- =============================================================================

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
  'mention',           -- @mentioned in a comment
  'reply',             -- Someone replied to your comment
  'assignment',        -- Assigned to a task
  'comment',           -- Comment on entity you're watching
  'ai_suggestion',     -- AI generated a suggestion for you
  'system'             -- System notifications
);

-- Main notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  project_id UUID,

  -- Notification details
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,

  -- Source entity (polymorphic)
  entity_type TEXT,  -- 'annotation', 'task', 'insight', etc.
  entity_id UUID,

  -- Who triggered it
  actor_user_id UUID REFERENCES auth.users(id),
  actor_name TEXT,  -- Cached for display

  -- Context for deep linking
  link_url TEXT,  -- Relative URL to navigate to

  -- State management
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,

  -- Grouping (for batching related notifications)
  group_key TEXT,  -- e.g., 'insight_123_comments'

  -- Additional context
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_all
  ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_pending_email
  ON notifications (user_id, created_at)
  WHERE emailed_at IS NULL AND read_at IS NULL;

CREATE INDEX idx_notifications_group
  ON notifications (group_key)
  WHERE group_key IS NOT NULL;

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM notifications
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND dismissed_at IS NULL;
$$;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(notification_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET read_at = NOW(), updated_at = NOW()
  WHERE id = ANY(notification_ids)
    AND user_id = auth.uid();
END;
$$;

-- Function to mark all as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET read_at = NOW(), updated_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
```

### 1.2 User Notification Preferences

**File:** Update `supabase/schemas/02_user_settings.sql` (or migration)

```sql
-- Add notification preferences structure to user_settings
-- The notification_preferences JSONB column already exists

-- Default structure:
-- {
--   "email": {
--     "mentions": "immediate",     -- immediate | batched | off
--     "replies": "immediate",
--     "assignments": "immediate",
--     "digest": "daily",           -- daily | weekly | off
--     "quiet_hours": {
--       "enabled": false,
--       "start": "22:00",
--       "end": "08:00",
--       "timezone": "America/Los_Angeles"
--     }
--   },
--   "in_app": {
--     "mentions": true,
--     "replies": true,
--     "assignments": true,
--     "ai_suggestions": true
--   }
-- }
```

---

## Phase 2: Notification Creation (Trigger.dev Tasks)

### 2.1 Create Notification Task

**File:** `src/trigger/notifications/create-notification.ts`

```typescript
import { schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"

const CreateNotificationPayload = z.object({
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  notificationType: z.enum(["mention", "reply", "assignment", "comment", "ai_suggestion", "system"]),
  title: z.string(),
  body: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  linkUrl: z.string().optional(),
  groupKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const createNotificationTask = schemaTask({
  id: "notification/create",
  schema: CreateNotificationPayload,
  retry: { maxAttempts: 3 },
  run: async (payload) => {
    // Don't notify users about their own actions
    if (payload.actorUserId === payload.userId) {
      return { skipped: true, reason: "self-action" }
    }

    // Check user preferences
    const { data: userSettings } = await supabaseAdmin
      .from("user_settings")
      .select("notification_preferences")
      .eq("user_id", payload.userId)
      .single()

    const prefs = userSettings?.notification_preferences || {}
    const inAppEnabled = prefs?.in_app?.[payload.notificationType] !== false

    if (!inAppEnabled) {
      return { skipped: true, reason: "user-disabled" }
    }

    // Create notification
    const { data: notification, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: payload.userId,
        account_id: payload.accountId,
        project_id: payload.projectId,
        notification_type: payload.notificationType,
        title: payload.title,
        body: payload.body,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        actor_user_id: payload.actorUserId,
        actor_name: payload.actorName,
        link_url: payload.linkUrl,
        group_key: payload.groupKey,
        metadata: payload.metadata || {},
      })
      .select()
      .single()

    if (error) throw error

    return { created: true, notificationId: notification.id }
  },
})
```

### 2.2 Process Mention Task (Triggered on Annotation Create)

**File:** `src/trigger/notifications/process-mention.ts`

```typescript
import { schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { createNotificationTask } from "./create-notification"
import { sendMentionEmailTask } from "./send-mention-email"
import { supabaseAdmin } from "~/lib/supabase/client.server"

const ProcessMentionPayload = z.object({
  annotationId: z.string().uuid(),
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  authorUserId: z.string().uuid(),
  authorName: z.string(),
  content: z.string(),
  mentions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["user", "person"]),
  })),
})

export const processMentionTask = schemaTask({
  id: "notification/process-mention",
  schema: ProcessMentionPayload,
  retry: { maxAttempts: 3 },
  run: async (payload) => {
    const results = []

    // Get entity details for the notification
    const entityTitle = await getEntityTitle(payload.entityType, payload.entityId)
    const linkUrl = buildEntityUrl(payload.accountId, payload.projectId, payload.entityType, payload.entityId)

    for (const mention of payload.mentions) {
      // Only notify users (not project people - they don't have accounts)
      if (mention.type !== "user") {
        results.push({ mentionId: mention.id, skipped: true, reason: "not-a-user" })
        continue
      }

      // Don't notify self
      if (mention.id === payload.authorUserId) {
        results.push({ mentionId: mention.id, skipped: true, reason: "self-mention" })
        continue
      }

      // Create in-app notification
      const notificationResult = await createNotificationTask.triggerAndWait({
        userId: mention.id,
        accountId: payload.accountId,
        projectId: payload.projectId,
        notificationType: "mention",
        title: `${payload.authorName} mentioned you`,
        body: truncateContent(payload.content, 100),
        entityType: payload.entityType,
        entityId: payload.entityId,
        actorUserId: payload.authorUserId,
        actorName: payload.authorName,
        linkUrl,
        groupKey: `${payload.entityType}_${payload.entityId}_mentions`,
        metadata: {
          annotationId: payload.annotationId,
          entityTitle,
        },
      })

      // Queue email notification (will be batched or sent immediately based on preferences)
      await sendMentionEmailTask.trigger({
        userId: mention.id,
        mentionedByName: payload.authorName,
        content: payload.content,
        entityType: payload.entityType,
        entityTitle,
        linkUrl,
      })

      results.push({ mentionId: mention.id, created: true })
    }

    return { processed: results.length, results }
  },
})

async function getEntityTitle(entityType: string, entityId: string): Promise<string> {
  const tableMap: Record<string, string> = {
    insight: "insights",
    opportunity: "opportunities",
    task: "tasks",
    interview: "interviews",
    person: "people",
  }

  const table = tableMap[entityType]
  if (!table) return entityType

  const { data } = await supabaseAdmin
    .from(table)
    .select("title, name")
    .eq("id", entityId)
    .single()

  return data?.title || data?.name || entityType
}

function buildEntityUrl(accountId: string, projectId: string, entityType: string, entityId: string): string {
  const pathMap: Record<string, string> = {
    insight: "insights",
    opportunity: "opportunities",
    task: "priorities",
    interview: "interviews",
    person: "people",
  }

  const path = pathMap[entityType] || entityType
  return `/a/${accountId}/${projectId}/${path}/${entityId}`
}

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength - 3) + "..."
}
```

### 2.3 Send Mention Email Task

**File:** `src/trigger/notifications/send-mention-email.ts`

```typescript
import { schemaTask, wait } from "@trigger.dev/sdk"
import { z } from "zod"
import { sendEmail } from "~/emails/clients.server"
import { MentionNotificationEmail } from "~/emails/mention-notification"
import { supabaseAdmin } from "~/lib/supabase/client.server"

const SendMentionEmailPayload = z.object({
  userId: z.string().uuid(),
  mentionedByName: z.string(),
  content: z.string(),
  entityType: z.string(),
  entityTitle: z.string(),
  linkUrl: z.string(),
})

export const sendMentionEmailTask = schemaTask({
  id: "notification/send-mention-email",
  schema: SendMentionEmailPayload,
  retry: { maxAttempts: 3 },
  run: async (payload) => {
    // Get user email and preferences
    const { data: userSettings } = await supabaseAdmin
      .from("user_settings")
      .select("email, first_name, notification_preferences")
      .eq("user_id", payload.userId)
      .single()

    if (!userSettings?.email) {
      return { skipped: true, reason: "no-email" }
    }

    const prefs = userSettings.notification_preferences || {}
    const mentionPref = prefs?.email?.mentions || "immediate"

    if (mentionPref === "off") {
      return { skipped: true, reason: "email-disabled" }
    }

    // Check quiet hours
    if (prefs?.email?.quiet_hours?.enabled) {
      const isQuietHours = checkQuietHours(prefs.email.quiet_hours)
      if (isQuietHours) {
        // Wait until quiet hours end, then send
        await wait.until({ date: getQuietHoursEnd(prefs.email.quiet_hours) })
      }
    }

    // For batched preference, we could aggregate - for now, send immediately
    // (Future: use a separate batching task that collects and sends digests)

    const baseUrl = process.env.APP_URL || "https://app.example.com"
    const fullUrl = `${baseUrl}${payload.linkUrl}`

    await sendEmail({
      to: userSettings.email,
      subject: `${payload.mentionedByName} mentioned you in "${payload.entityTitle}"`,
      react: MentionNotificationEmail({
        recipientName: userSettings.first_name || "there",
        mentionedByName: payload.mentionedByName,
        content: payload.content,
        entityType: payload.entityType,
        entityTitle: payload.entityTitle,
        linkUrl: fullUrl,
      }),
    })

    // Mark notification as emailed
    await supabaseAdmin
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .eq("user_id", payload.userId)
      .eq("entity_id", payload.entityId)
      .is("emailed_at", null)

    return { sent: true, email: userSettings.email }
  },
})

function checkQuietHours(quietHours: any): boolean {
  // Implementation: check if current time is within quiet hours
  // Consider timezone
  return false // Simplified for now
}

function getQuietHoursEnd(quietHours: any): Date {
  // Implementation: calculate when quiet hours end
  return new Date() // Simplified for now
}
```

---

## Phase 3: Email Templates

### 3.1 Mention Notification Email

**File:** `app/emails/mention-notification.tsx`

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface MentionNotificationEmailProps {
  recipientName: string
  mentionedByName: string
  content: string
  entityType: string
  entityTitle: string
  linkUrl: string
}

export function MentionNotificationEmail({
  recipientName,
  mentionedByName,
  content,
  entityType,
  entityTitle,
  linkUrl,
}: MentionNotificationEmailProps) {
  const previewText = `${mentionedByName} mentioned you in a comment`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            {mentionedByName} mentioned you
          </Heading>

          <Text style={paragraph}>
            Hey {recipientName},
          </Text>

          <Text style={paragraph}>
            {mentionedByName} mentioned you in a comment on{" "}
            <strong>{entityTitle}</strong> ({entityType}):
          </Text>

          <Section style={quoteSection}>
            <Text style={quote}>"{content}"</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={linkUrl}>
              View Comment
            </Button>
          </Section>

          <Text style={footer}>
            —<br />
            <Link href={linkUrl} style={link}>Insights</Link>
            {" · "}
            <Link href="{{unsubscribe_url}}" style={link}>
              Unsubscribe from mention emails
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
  borderRadius: "8px",
}

const heading = {
  fontSize: "24px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 24px",
}

const paragraph = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#4a4a4a",
  margin: "0 0 16px",
}

const quoteSection = {
  backgroundColor: "#f6f9fc",
  borderLeft: "4px solid #3b82f6",
  padding: "16px 20px",
  margin: "24px 0",
  borderRadius: "0 8px 8px 0",
}

const quote = {
  fontSize: "15px",
  lineHeight: "22px",
  color: "#1a1a1a",
  fontStyle: "italic",
  margin: "0",
}

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
}

const button = {
  backgroundColor: "#3b82f6",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  padding: "12px 24px",
  display: "inline-block",
}

const footer = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#6b7280",
  margin: "32px 0 0",
}

const link = {
  color: "#3b82f6",
  textDecoration: "underline",
}

export default MentionNotificationEmail
```

---

## Phase 4: API Routes

### 4.1 Notifications API

**File:** `app/routes/api/notifications.ts`

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = context.get(userContext)
  if (!user?.claims?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = parseInt(url.searchParams.get("offset") || "0")
  const unreadOnly = url.searchParams.get("unread") === "true"

  let query = user.supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.claims.sub)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (unreadOnly) {
    query = query.is("read_at", null)
  }

  const { data: notifications, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Get unread count
  const { count } = await user.supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.claims.sub)
    .is("read_at", null)
    .is("dismissed_at", null)

  return Response.json({
    notifications,
    unreadCount: count || 0,
  })
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext)
  if (!user?.claims?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const action = formData.get("action") as string

  switch (action) {
    case "mark-read": {
      const ids = JSON.parse(formData.get("ids") as string) as string[]
      const { error } = await user.supabase.rpc("mark_notifications_read", {
        notification_ids: ids,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true })
    }

    case "mark-all-read": {
      const { data: count, error } = await user.supabase.rpc("mark_all_notifications_read")
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, markedCount: count })
    }

    case "dismiss": {
      const id = formData.get("id") as string
      const { error } = await user.supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.claims.sub)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true })
    }

    default:
      return Response.json({ error: "Unknown action" }, { status: 400 })
  }
}
```

### 4.2 Notification Preferences API

**File:** `app/routes/api/notification-preferences.ts`

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext)
  if (!user?.claims?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await user.supabase
    .from("user_settings")
    .select("notification_preferences")
    .eq("user_id", user.claims.sub)
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Return with defaults
  const defaults = {
    email: {
      mentions: "immediate",
      replies: "immediate",
      assignments: "immediate",
      digest: "off",
      quiet_hours: { enabled: false },
    },
    in_app: {
      mentions: true,
      replies: true,
      assignments: true,
      ai_suggestions: true,
    },
  }

  return Response.json({
    preferences: { ...defaults, ...data?.notification_preferences },
  })
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext)
  if (!user?.claims?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const preferences = await request.json()

  const { error } = await user.supabase
    .from("user_settings")
    .update({ notification_preferences: preferences })
    .eq("user_id", user.claims.sub)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
```

---

## Phase 5: UI Components

### 5.1 Notification Bell Component

**File:** `app/components/notifications/NotificationBell.tsx`

```tsx
import { Bell } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { cn } from "~/lib/utils"
import { NotificationList } from "./NotificationList"

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const fetcher = useFetcher()

  const notifications = fetcher.data?.notifications || []
  const unreadCount = fetcher.data?.unreadCount || 0

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetcher.load("/api/notifications?limit=20")

    const interval = setInterval(() => {
      fetcher.load("/api/notifications?limit=20")
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Mark as read when opened
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      const unreadIds = notifications
        .filter((n: any) => !n.read_at)
        .map((n: any) => n.id)

      if (unreadIds.length > 0) {
        fetcher.submit(
          { action: "mark-read", ids: JSON.stringify(unreadIds) },
          { method: "POST", action: "/api/notifications" }
        )
      }
    }
  }, [isOpen])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center",
              "rounded-full bg-blue-600 text-[10px] font-bold text-white"
            )}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationList
          notifications={notifications}
          onDismiss={(id) => {
            fetcher.submit(
              { action: "dismiss", id },
              { method: "POST", action: "/api/notifications" }
            )
          }}
          onMarkAllRead={() => {
            fetcher.submit(
              { action: "mark-all-read" },
              { method: "POST", action: "/api/notifications" }
            )
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
```

### 5.2 Notification List Component

**File:** `app/components/notifications/NotificationList.tsx`

```tsx
import { Check, MessageCircle, UserPlus, Sparkles, X } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"
import { formatRelativeDate } from "~/utils/relative-date"

interface Notification {
  id: string
  notification_type: string
  title: string
  body?: string
  link_url?: string
  actor_name?: string
  read_at?: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface NotificationListProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
  onMarkAllRead: () => void
}

const typeIcons: Record<string, typeof MessageCircle> = {
  mention: MessageCircle,
  reply: MessageCircle,
  assignment: UserPlus,
  ai_suggestion: Sparkles,
}

export function NotificationList({
  notifications,
  onDismiss,
  onMarkAllRead
}: NotificationListProps) {
  const hasUnread = notifications.some(n => !n.read_at)

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground text-sm">No notifications</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            className="text-xs"
          >
            <Check className="mr-1 h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="max-h-[400px]">
        <div className="divide-y">
          {notifications.map((notification) => {
            const Icon = typeIcons[notification.notification_type] || MessageCircle
            const isUnread = !notification.read_at

            return (
              <div
                key={notification.id}
                className={cn(
                  "group relative flex gap-3 p-4 transition-colors hover:bg-muted/50",
                  isUnread && "bg-blue-50/50"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  isUnread ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {notification.link_url ? (
                    <Link
                      to={notification.link_url}
                      className="block"
                    >
                      <p className={cn(
                        "text-sm",
                        isUnread && "font-medium"
                      )}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                    </Link>
                  ) : (
                    <>
                      <p className={cn("text-sm", isUnread && "font-medium")}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                    </>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeDate(notification.created_at)}
                  </p>
                </div>

                {/* Dismiss button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault()
                    onDismiss(notification.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>

                {/* Unread indicator */}
                {isUnread && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-600" />
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        <Link to="/settings/notifications">
          <Button variant="ghost" size="sm" className="w-full text-xs">
            Notification settings
          </Button>
        </Link>
      </div>
    </div>
  )
}
```

---

## Phase 6: Integration Points

### 6.1 Trigger Notifications from Annotation Creation

**Update:** `app/features/annotations/api/annotations.tsx`

```typescript
// In the add-comment action, after creating the annotation:

// Trigger mention notifications
if (contentJsonb?.mentions?.length > 0) {
  const { processMentionTask } = await import("~/trigger/notifications/process-mention")

  await processMentionTask.trigger({
    annotationId: annotation.id,
    accountId,
    projectId,
    entityType,
    entityId,
    authorUserId: userId,
    authorName: userDisplayName,
    content: annotation.content,
    mentions: contentJsonb.mentions,
  })
}
```

### 6.2 Add Bell to App Header

**Update:** `app/components/layout/AppLayout.tsx` or header component

```tsx
import { NotificationBell } from "~/components/notifications/NotificationBell"

// In the header, next to user avatar:
<NotificationBell />
```

### 6.3 Add to Dashboard Activity Feed

The existing `LensFeed` in dashboard can be extended to show notifications:

**Option A:** Add a "Recent @Mentions" section
**Option B:** Integrate notifications into existing activity stream
**Option C:** Keep separate - Bell for actions, Activity for information

---

## Implementation Phases Summary

| Phase | Components | Estimated Time |
|-------|------------|----------------|
| **Phase 1** | Database schema, migrations | 1 day |
| **Phase 2** | Trigger.dev tasks (create, process, email) | 2 days |
| **Phase 3** | Email templates | 0.5 days |
| **Phase 4** | API routes | 1 day |
| **Phase 5** | UI components (Bell, List) | 1.5 days |
| **Phase 6** | Integration & testing | 1 day |

**Total:** ~7 days

---

## File Structure Summary

```
New files to create:
├── supabase/schemas/45_notifications.sql
├── src/trigger/notifications/
│   ├── create-notification.ts
│   ├── process-mention.ts
│   └── send-mention-email.ts
├── app/emails/mention-notification.tsx
├── app/routes/api/notifications.ts
├── app/routes/api/notification-preferences.ts
├── app/components/notifications/
│   ├── NotificationBell.tsx
│   └── NotificationList.tsx

Files to update:
├── app/features/annotations/api/annotations.tsx (trigger on mention)
├── app/components/layout/AppLayout.tsx (add bell)
├── app/routes.ts (add API routes)
```
