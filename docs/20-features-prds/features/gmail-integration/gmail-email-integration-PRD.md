# Gmail Email Integration PRD

> **Status**: Draft
> **Last Updated**: 2025-01-24
> **Owner**: Product/Engineering
> **Dependencies**: Pica AuthKit (existing), Pica Passthrough API (existing)

---

## Executive Summary

**Primary Goal**: Close the activation gap where users create surveys but don't get responses.

Enable users to send survey invites and follow-ups through their connected Gmail accounts, with automatic reminders (auto-nudge) to non-respondents. This is the critical missing piece in the survey user journey:

```
Create Survey → [THIS FEATURE] → Get Responses → Extract Insights → Value
                     ↑
              Users currently stuck here
```

### Strategic Rationale

1. **Activation unlock**: Users who get survey responses see value → retain
2. **Competitive parity**: SurveyMonkey/Qualtrics have built-in distribution
3. **Platform stickiness**: Email touchpoints → more reasons to stay in UpSight
4. **Foundation for AI**: Gmail access enables future AI agent reading/replying

---

## Problem Statement

### The Activation Gap

**Current user journey failure mode**:
1. User creates a survey in UpSight ✅
2. User needs to distribute it... ❌ **STUCK**
3. User exports contacts, opens Gmail/Brevo, manually sends
4. No tracking of who received, opened, clicked
5. No easy way to follow up with non-respondents
6. User doesn't get enough responses → doesn't see value → churns

**Evidence from user conversations**:
> "I created a survey but people aren't responding to it"
> "I have to use Brevo for a simple survey - that's extra steps"

### Competitive Landscape

| Feature | SurveyMonkey | Qualtrics | UpSight (Current) |
|---------|--------------|-----------|-------------------|
| Send survey invites | ✅ Built-in | ✅ Built-in | ❌ Manual |
| Upload contact list | ✅ CSV, 10K limit | ✅ Contact lists | ✅ People CRM |
| Auto-reminders | ✅ To non-respondents | ✅ Automatic | ❌ None |
| Track opens/clicks | ✅ Full analytics | ✅ Full analytics | ❌ None |
| Track completions | ✅ Per recipient | ✅ Per recipient | ❌ None |
| From address | SM servers | Qualtrics/custom | N/A |

**Key insight**: Both SM and Qualtrics send from their own servers. However, using user's Gmail provides:
- Better deliverability (recipient knows sender)
- Natural reply handling (goes to user's inbox)
- Relationship continuity (not a faceless survey tool)

### Sending Options Analysis

| Factor | User's Gmail (Pica) | System Email (Engage.so) | Own Infrastructure |
|--------|---------------------|--------------------------|---------------------|
| **Deliverability** | 🟢 Best - recipient knows sender | 🟡 Good but impersonal | 🟡 Depends on reputation |
| **Reply handling** | 🟢 Goes to user's inbox | 🔴 Need routing | 🟡 Complex routing |
| **Setup friction** | 🟡 OAuth required | 🟢 Zero | 🟢 Zero |
| **Daily send limit** | 🔴 500 (consumer) / 2000 (Workspace) | 🟢 No limits | 🟢 No limits |
| **Spam risk** | 🔴 User's account at risk | 🟢 Isolated domain | 🟢 Isolated |
| **Personal feel** | 🟢 Real person | 🟡 Automated | 🟡 Automated |
| **Tracking** | 🟡 Polling required | 🟢 Built-in | 🟢 Built-in |
| **Build effort** | 🟢 Pica handles OAuth | 🟢 Already built | 🔴 New build |

### Decision: Gmail for MVP

**Gmail is the right choice for survey distribution because:**

1. **Volume is manageable** - Survey invites typically <100 per batch, well within limits
2. **Personal touch matters** - "From: sarah@acme.com" > "From: notify@upsight.com" for response rates
3. **Reply handling is natural** - When someone replies to survey invite, it goes to user's inbox
4. **Foundation for future** - Gmail connection enables AI agent reading/replying later

**Risks we accept:**

| Risk | Mitigation |
|------|------------|
| Gmail rate limits (500/day consumer) | Batch processing; guide users to Workspace if needed |
| User spam complaints hurt their reputation | Clear opt-out; quality templates; don't allow cold outreach initially |
| OAuth friction | One-time setup; clear value prop |

**Future consideration: Hybrid approach**

| Use Case | Send Via |
|----------|----------|
| Survey invites | User's Gmail (personal) |
| Follow-ups to known contacts | User's Gmail (relationship) |
| High-volume sequences | System email (scale) |
| Cold outreach campaigns | System email (protect user reputation) |

---

## Use Cases

### Use Case 1: Survey Distribution with Auto-Nudge (MVP)

> **This is the primary activation use case.** Users create surveys but don't get responses because distribution is manual and there's no follow-up system.

**The Problem Today**:
```
User creates survey → Exports contacts → Opens Gmail/Brevo → Manually sends
                                              ↓
                    No tracking → No follow-up → Low response rate → No value
```

**The Solution**:
```
User creates survey → Selects recipients → Sends via UpSight
                                              ↓
         Tracking (sent/opened/completed) → Auto-nudge non-respondents
                                              ↓
                              Higher response rate → Insights → Value
```

**Auto-Nudge Flow**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTO-NUDGE SEQUENCE                             │
│                                                                         │
│  Day 0                 Day 3                    Day 7                   │
│    │                     │                        │                     │
│    ▼                     ▼                        ▼                     │
│  ┌────────┐         ┌──────────┐            ┌──────────┐               │
│  │ Initial│         │ Reminder │            │ Final    │               │
│  │ Invite │ ──────► │ #1       │ ─────────► │ Reminder │               │
│  └────────┘         └──────────┘            └──────────┘               │
│       │                  │                       │                      │
│       ▼                  ▼                       ▼                      │
│   Completed?         Completed?              Completed?                 │
│   Yes → STOP         Yes → STOP              Yes → STOP                │
│   No → Continue      No → Continue           No → Give up              │
│                                                                         │
│  Configurable: delay, # reminders, reminder content                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Auto-Nudge Configuration UI**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Follow-up Settings                                                      │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ ☑ Automatically remind non-respondents                              ││
│ │                                                                     ││
│ │   First reminder after: [3 days ▼]                                 ││
│ │   Second reminder after: [7 days ▼]  (optional)                    ││
│ │                                                                     ││
│ │   Stop reminding after: [14 days ▼] or [2 reminders ▼]            ││
│ │                                                                     ││
│ │   Reminder subject: [Re: {original_subject} ▼]                     ││
│ │   Reminder message: [Just a friendly reminder... ▼]                ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ Preview: "50 contacts selected. ~20 will likely need a reminder."      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Use Case 1b: Survey Link Distribution (Original)

**Scenario**: PM wants to send survey invites to 50 customers from a recent event.

**Flow**:
1. User imports contact list (CSV or existing People)
2. User creates survey in UpSight
3. User selects contacts → "Send Survey Invite"
4. UpSight drafts personalized emails using AI (name, company, context)
5. Emails land in **Staging Queue** for review
6. User reviews, edits if needed, approves batch
7. Emails sent via user's connected Gmail
8. Track: opens, clicks, survey completions

**Key Requirements**:
- Batch send to 50+ recipients
- Personalization tokens (name, company, custom fields)
- AI-generated personalized intros
- Scheduling (send at optimal time)
- Unsubscribe handling

### Use Case 2: Outreach & Opportunity Follow-ups

**Scenario**: Sales/CS wants to follow up with prospects who showed interest.

**Flow**:
1. User identifies opportunities needing follow-up (from pipeline, insights, or AI suggestion)
2. AI drafts personalized follow-up based on:
   - Previous conversation evidence (quotes, themes)
   - Opportunity stage and context
   - Time since last contact
3. Email lands in **Staging Queue**
4. User reviews, approves, or edits
5. Email sent via Gmail
6. **Response Monitoring**: UpSight watches for replies
7. When reply received → create/update Opportunity, notify user, surface in pipeline

**Key Requirements**:
- Context-aware drafting (knows conversation history)
- Response detection and classification
- Opportunity creation/update from email signals
- Follow-up reminders if no response

### Use Case 3: Automated Sequences

**Scenario**: Nurture sequence for trial users or event attendees.

**Flow**:
1. User defines sequence: Day 1 → Day 3 → Day 7 emails
2. Contacts enter sequence (manual or trigger-based)
3. Each email drafts → Staging Queue (or auto-approve if rules match)
4. Sends at scheduled time
5. Stops if: reply received, unsubscribe, or manual stop

**Key Requirements**:
- Multi-step sequences with delays
- Stop conditions (reply, unsubscribe, bounce)
- A/B testing (optional, future)
- Performance analytics

---

## Technical Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Actions                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ "Send Survey"   │  │ "Follow Up"     │  │ "Start Sequence"        │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
└───────────┼────────────────────┼────────────────────────┼───────────────┘
            │                    │                        │
            ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI Email Drafting                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Context: Person, Org, Opportunity, Conversation History,        │    │
│  │          Previous Emails, Survey/Template                        │    │
│  │ Output: Personalized email draft                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STAGING QUEUE                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Status: pending_review | approved | rejected | sent | failed    │    │
│  │                                                                  │    │
│  │ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │    │
│  │ │ Email 1 │  │ Email 2 │  │ Email 3 │  │ Email 4 │  ...        │    │
│  │ │ Pending │  │ Pending │  │Approved │  │ Sent    │             │    │
│  │ └─────────┘  └─────────┘  └─────────┘  └─────────┘             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Actions: [Approve] [Approve All] [Edit] [Reject] [Schedule]            │
│                                                                          │
│  Auto-Approval Rules:                                                    │
│  - "Auto-approve survey invites to existing customers"                  │
│  - "Auto-approve follow-ups drafted from templates"                     │
│  - "Always review cold outreach"                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼ (on approve)
┌─────────────────────────────────────────────────────────────────────────┐
│                    Pica Passthrough API (Gmail)                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ POST /gmail/v1/users/me/messages/send                            │    │
│  │ Authorization: Pica manages OAuth tokens                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Response Monitoring                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Scheduled Job: Poll Gmail for replies to sent emails             │    │
│  │ Match: threadId, In-Reply-To header, or recipient email          │    │
│  │                                                                  │    │
│  │ On Reply Detected:                                               │    │
│  │   → Parse reply content                                          │    │
│  │   → Classify intent (interested, not interested, question, etc.) │    │
│  │   → Update Opportunity status                                    │    │
│  │   → Notify user                                                  │    │
│  │   → Create follow-up task if needed                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Gmail OAuth Connection (Pica AuthKit)

Reuse existing `PicaConnectButton` pattern:

```tsx
<PicaConnectButton
  platform="gmail"
  userId={userId}
  accountId={accountId}
  onSuccess={handleGmailConnected}
>
  <Mail className="mr-2 h-4 w-4" />
  Connect Gmail
</PicaConnectButton>
```

**Storage**: New `gmail_connections` table (or extend `calendar_connections` → `user_connections`)

**Scopes Required**:
- `gmail.send` - Send emails
- `gmail.readonly` - Read inbox for response monitoring
- `gmail.modify` - Mark emails as read, add labels (optional)

#### 2. Email Staging Queue

**Database Schema**:

```sql
-- Staged emails awaiting approval/sending
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id),

    -- Sender (user's Gmail connection)
    gmail_connection_id UUID NOT NULL REFERENCES gmail_connections(id),
    from_email TEXT NOT NULL,
    from_name TEXT,

    -- Recipient
    to_email TEXT NOT NULL,
    to_name TEXT,
    person_id UUID REFERENCES people(id),
    opportunity_id UUID REFERENCES opportunities(id),

    -- Content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Threading (for follow-ups)
    reply_to_message_id TEXT,  -- Gmail Message-ID for threading
    thread_id TEXT,            -- Gmail thread ID

    -- Workflow
    status email_queue_status NOT NULL DEFAULT 'pending_review',
    -- pending_review, approved, scheduled, sending, sent, failed, rejected

    scheduled_for TIMESTAMPTZ,  -- When to send (null = ASAP after approval)
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,

    -- Sending result
    sent_at TIMESTAMPTZ,
    gmail_message_id TEXT,      -- Gmail's ID after sending
    gmail_thread_id TEXT,
    error_message TEXT,

    -- Tracking
    opens INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    replied BOOLEAN DEFAULT FALSE,
    reply_detected_at TIMESTAMPTZ,

    -- Source context
    source_type TEXT,  -- 'survey_invite', 'follow_up', 'sequence', 'manual'
    source_id UUID,    -- ID of survey, sequence step, etc.

    -- Auto-approval
    auto_approved BOOLEAN DEFAULT FALSE,
    auto_approval_rule_id UUID REFERENCES email_auto_approval_rules(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TYPE email_queue_status AS ENUM (
    'pending_review',
    'approved',
    'scheduled',
    'sending',
    'sent',
    'failed',
    'rejected',
    'cancelled'
);

-- Auto-approval rules
CREATE TABLE email_auto_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),

    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,

    -- Conditions (all must match)
    conditions JSONB NOT NULL,
    -- Example: {
    --   "source_type": ["survey_invite"],
    --   "recipient_has_tag": ["customer", "partner"],
    --   "template_id": ["uuid-of-approved-template"]
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Email sequences
CREATE TABLE email_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id),

    name TEXT NOT NULL,
    description TEXT,

    -- Sequence configuration
    steps JSONB NOT NULL,
    -- Example: [
    --   { "delay_days": 0, "template_id": "uuid", "subject": "...", "body": "..." },
    --   { "delay_days": 3, "template_id": "uuid", "subject": "...", "body": "..." },
    --   { "delay_days": 7, "template_id": "uuid", "subject": "...", "body": "..." }
    -- ]

    -- Stop conditions
    stop_on_reply BOOLEAN DEFAULT TRUE,
    stop_on_bounce BOOLEAN DEFAULT TRUE,
    stop_on_unsubscribe BOOLEAN DEFAULT TRUE,

    status TEXT DEFAULT 'active',  -- active, paused, archived

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track people in sequences
CREATE TABLE email_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES email_sequences(id),
    person_id UUID NOT NULL REFERENCES people(id),
    opportunity_id UUID REFERENCES opportunities(id),

    current_step INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',  -- active, completed, stopped, failed
    stop_reason TEXT,  -- 'reply', 'bounce', 'unsubscribe', 'manual'

    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    UNIQUE(sequence_id, person_id)
);
```

#### 3. Email Sending via Pica Passthrough

```typescript
// app/lib/integrations/gmail.server.ts

export async function sendGmailEmail(params: {
  connectionKey: string
  to: string
  toName?: string
  subject: string
  bodyHtml: string
  bodyText?: string
  replyToMessageId?: string  // For threading
  threadId?: string
}): Promise<{ messageId: string; threadId: string }> {

  // Build RFC 2822 email
  const boundary = `boundary_${Date.now()}`
  const headers = [
    `To: ${params.toName ? `"${params.toName}" <${params.to}>` : params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  // Add threading headers if replying
  if (params.replyToMessageId) {
    headers.push(`In-Reply-To: ${params.replyToMessageId}`)
    headers.push(`References: ${params.replyToMessageId}`)
  }

  const body = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.bodyText || stripHtml(params.bodyHtml),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    params.bodyHtml,
    '',
    `--${boundary}--`,
  ].join('\r\n')

  // Base64url encode
  const encodedMessage = Buffer.from(body)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Send via Pica Passthrough
  const response = await picaPassthrough({
    connectionKey: params.connectionKey,
    method: 'POST',
    path: '/gmail/v1/users/me/messages/send',
    body: {
      raw: encodedMessage,
      threadId: params.threadId,  // Adds to existing thread
    },
  })

  return {
    messageId: response.id,
    threadId: response.threadId,
  }
}
```

#### 4. Response Monitoring

**Approach**: Scheduled Trigger.dev task polls Gmail for replies

```typescript
// src/trigger/gmail/monitorReplies.ts

export const monitorGmailRepliesTask = schemaTask({
  id: 'gmail-monitor-replies',
  schema: z.object({
    accountId: z.string().uuid(),
  }),
  run: async ({ accountId }) => {
    // Get all Gmail connections for this account
    const connections = await getActiveGmailConnections(accountId)

    for (const connection of connections) {
      // Get sent emails awaiting replies
      const pendingEmails = await getEmailsAwaitingReply(accountId, connection.id)

      for (const email of pendingEmails) {
        // Check Gmail thread for new messages
        const thread = await fetchGmailThread({
          connectionKey: connection.pica_connection_key,
          threadId: email.gmail_thread_id,
        })

        // Find messages after our sent message
        const replies = thread.messages.filter(m =>
          m.id !== email.gmail_message_id &&
          new Date(m.internalDate) > email.sent_at
        )

        if (replies.length > 0) {
          const latestReply = replies[replies.length - 1]

          // Parse and classify reply
          const classification = await classifyEmailReply(latestReply.body)

          // Update email record
          await markEmailReplied(email.id, latestReply.id)

          // Update opportunity if linked
          if (email.opportunity_id) {
            await updateOpportunityFromReply({
              opportunityId: email.opportunity_id,
              replyClassification: classification,
              replyContent: latestReply.body,
            })
          }

          // Create notification
          await createNotification({
            userId: connection.user_id,
            type: 'email_reply',
            title: `Reply from ${email.to_name || email.to_email}`,
            body: truncate(latestReply.snippet, 100),
            link: `/opportunities/${email.opportunity_id}`,
          })

          // Stop sequence if enrolled
          if (email.source_type === 'sequence') {
            await stopSequenceEnrollment(email.source_id, 'reply')
          }
        }
      }
    }
  },
})

// Run every 5 minutes
export const scheduledReplyMonitor = schedules.task({
  id: 'gmail-reply-monitor-schedule',
  cron: '*/5 * * * *',
  run: async () => {
    const accounts = await getAccountsWithGmailConnections()
    for (const account of accounts) {
      await monitorGmailRepliesTask.trigger({ accountId: account.id })
    }
  },
})
```

#### 5. AI Email Drafting

```typescript
// baml_src/email_drafting.baml

function DraftOutreachEmail(context: EmailContext) -> EmailDraft {
  client GPT4o
  prompt #"
    Draft a personalized email for the following context:

    Recipient:
    - Name: {{ context.recipientName }}
    - Title: {{ context.recipientTitle }}
    - Company: {{ context.recipientCompany }}
    - Previous interactions: {{ context.previousInteractions }}

    Purpose: {{ context.purpose }}

    Key points to include:
    {{ context.keyPoints }}

    Tone: {{ context.tone }}

    Conversation evidence (use naturally if relevant):
    {{ context.relevantQuotes }}

    Write a concise, personalized email that:
    1. Opens with a personal touch (not generic)
    2. States the purpose clearly
    3. Provides value or context
    4. Has a clear call-to-action
    5. Is 3-5 sentences max

    Return JSON:
    {
      "subject": "...",
      "body": "...",
      "personalization_notes": "..." // Why this is personalized
    }
  "#
}
```

---

## Staging Queue UI

### Queue View (`/projects/:id/email-queue`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Email Queue                                          [Bulk Actions ▼]   │
│                                                                         │
│ Filters: [All ▼] [Pending Review ▼] [Survey Invites ▼] [Today ▼]       │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ □  To: john@acme.com                              Pending Review    ││
│ │    Subject: Quick question about your workflow                      ││
│ │    Survey Invite • Created 2 min ago                               ││
│ │    [Preview] [Edit] [Approve] [Reject]                             ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ □  To: sarah@bigcorp.com                          Pending Review    ││
│ │    Subject: Following up on our conversation                        ││
│ │    Follow-up • Opportunity: BigCorp Enterprise • Created 5 min ago ││
│ │    [Preview] [Edit] [Approve] [Reject]                             ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ ✓  To: mike@startup.io                            Sent ✓            ││
│ │    Subject: Your feedback survey                                    ││
│ │    Survey Invite • Sent 1 hour ago • Opened • Clicked              ││
│ │    [View Thread]                                                    ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ [Approve Selected (2)] [Schedule Selected] [Reject Selected]           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Email Preview/Edit Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Edit Email                                                    [✕]      │
│                                                                         │
│ To: john@acme.com (John Smith, Acme Corp)                              │
│                                                                         │
│ Subject: ┌─────────────────────────────────────────────────────────┐   │
│          │ Quick question about your workflow                      │   │
│          └─────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Body:                                                                   │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ Hi John,                                                            ││
│ │                                                                     ││
│ │ I noticed from our chat last week that you mentioned struggling    ││
│ │ with customer feedback organization. I'd love to get your input    ││
│ │ on a quick 2-minute survey about this.                             ││
│ │                                                                     ││
│ │ [Take Survey →]                                                     ││
│ │                                                                     ││
│ │ Thanks!                                                             ││
│ │ - Alex                                                              ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ Context:                                                                │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ 📝 From conversation on Jan 15:                                     ││
│ │ "We have feedback everywhere - Slack, email, calls - but no        ││
│ │ single place to see what customers are actually saying"            ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ Schedule: [Send immediately ▼]  or  [Pick date/time]                   │
│                                                                         │
│                              [Cancel] [Save Draft] [Approve & Send]    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Auto-Approval Rules Settings

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Auto-Approval Rules                                      [+ Add Rule]  │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ ✓ Survey invites to existing customers                 [Edit] [🗑]  ││
│ │   When: source_type = "survey_invite"                              ││
│ │   And: recipient has tag "customer" or "partner"                   ││
│ │   → Auto-approve and send immediately                              ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ ○ Follow-ups from approved templates (disabled)        [Edit] [🗑]  ││
│ │   When: source_type = "follow_up"                                  ││
│ │   And: uses template in approved list                              ││
│ │   → Auto-approve after 1 hour delay                                ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ Default: All other emails require manual approval                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases (Activation-Focused)

### MVP: Survey Distribution with Auto-Nudge

**Goal**: Close the activation gap. Users can send surveys and get responses without leaving UpSight.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MVP USER JOURNEY                                │
│                                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌───────────┐  │
│  │ Create   │    │ Select       │    │ Review &    │    │ Track &   │  │
│  │ Survey   │ → │ Recipients   │ → │ Send        │ → │ Nudge     │  │
│  └──────────┘    └──────────────┘    └─────────────┘    └───────────┘  │
│       ↓                ↓                   ↓                  ↓        │
│   Existing        From People         Preview emails      Auto-remind  │
│   feature         CRM or CSV          Edit if needed      non-responders│
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Gmail Connection + Survey Send (MVP Core)

**Timeline**: ~1 week
**Objective**: Users can send survey invites from their Gmail

| Task | Effort | Priority |
|------|--------|----------|
| Gmail OAuth via Pica AuthKit | 4 hrs | P0 |
| `gmail_connections` table | 2 hrs | P0 |
| `sendGmailEmail()` function via Passthrough | 4 hrs | P0 |
| "Send Survey" button on survey page | 4 hrs | P0 |
| Recipient picker (from People or quick CSV paste) | 6 hrs | P0 |
| Simple email preview before sending | 4 hrs | P0 |
| Basic `survey_invites` table (track sends) | 2 hrs | P0 |

**Deliverable**:
- Connect Gmail in settings
- From survey page: Select recipients → Preview → Send
- Emails sent from user's actual Gmail address

**What we skip for now**:
- Full staging queue (emails send immediately after preview)
- AI personalization (simple template with merge fields)
- Tracking pixels (rely on survey completion tracking)

---

### Phase 2: Completion Tracking + Auto-Nudge

**Timeline**: ~1 week
**Objective**: Track who completed, auto-remind who didn't

| Task | Effort | Priority |
|------|--------|----------|
| Unique survey links per recipient | 4 hrs | P0 |
| Track: sent → opened survey → completed | 4 hrs | P0 |
| Survey distribution dashboard (who did what) | 6 hrs | P0 |
| Auto-nudge configuration (remind after X days) | 4 hrs | P0 |
| `sendReminderTask` - scheduled Trigger.dev job | 4 hrs | P0 |
| Stop nudging on completion | 2 hrs | P0 |
| "Nudge Now" manual button | 2 hrs | P1 |

**Deliverable**:
- See status: 50 sent → 40 opened → 25 completed
- Auto-remind the 25 who haven't completed after 3 days
- Stop reminding once they complete

**Auto-Nudge Flow**:
```
Day 0: Send survey invite
Day 3: If not completed → Send reminder #1
Day 7: If not completed → Send reminder #2 (optional)
Day 14: Stop (give up gracefully)
```

---

### Phase 3: Staging Queue + Bulk Actions

**Timeline**: ~1 week
**Objective**: Review/approve emails before sending (especially for larger sends)

| Task | Effort | Priority |
|------|--------|----------|
| `email_queue` table schema | 2 hrs | P0 |
| Queue UI: list pending emails | 6 hrs | P0 |
| Preview/edit modal | 4 hrs | P0 |
| Approve individual / Approve all | 4 hrs | P0 |
| Background job: process approved queue | 4 hrs | P0 |
| Schedule send for later | 4 hrs | P1 |

**Deliverable**:
- Emails for large batches (>10?) go to queue for review
- User can edit individual emails before approving
- Batch approve for efficiency

**When to use queue vs immediate send**:
- Small sends (≤10 recipients): Preview → Send immediately
- Large sends (>10 recipients): Preview → Queue → Approve → Send

---

### Phase 4: AI Personalization

**Timeline**: ~3-4 days
**Objective**: Better emails = better response rates

| Task | Effort | Priority |
|------|--------|----------|
| BAML prompt for survey invite personalization | 4 hrs | P1 |
| Use Person context (name, company, title) | 2 hrs | P1 |
| Use Opportunity/conversation context if available | 4 hrs | P1 |
| A/B subject line suggestions | 4 hrs | P2 |

**Deliverable**:
- AI writes personalized intro based on recipient context
- "Hey Sarah, following up on our chat about customer feedback..."

---

### Phase 5: Response Monitoring (Opportunity Creation)

**Timeline**: ~1 week
**Objective**: Turn email replies into tracked opportunities

| Task | Effort | Priority |
|------|--------|----------|
| Gmail inbox polling for replies to sent emails | 6 hrs | P1 |
| Reply classification (interested/not interested/question) | 4 hrs | P1 |
| Auto-create Opportunity from positive reply | 4 hrs | P1 |
| Notification: "John replied to your survey invite" | 4 hrs | P1 |
| Link reply to Person record | 2 hrs | P1 |

**Deliverable**:
- Someone replies "Yes, happy to take your survey" → Opportunity created
- User notified, can follow up in UpSight

---

### Phase 6: Auto-Approval Rules

**Timeline**: ~3-4 days
**Objective**: Trusted email types can skip manual approval

| Task | Effort | Priority |
|------|--------|----------|
| `email_auto_approval_rules` table | 2 hrs | P2 |
| Simple rule builder (source type + recipient tags) | 6 hrs | P2 |
| Rule evaluation in queue processor | 4 hrs | P2 |

**Deliverable**:
- "Auto-approve survey invites to contacts tagged 'customer'"
- Reduces friction for trusted, repeated workflows

---

### Phase 7: Outreach Sequences (Future)

**Timeline**: ~2 weeks
**Objective**: Multi-step nurture campaigns

| Task | Effort | Priority |
|------|--------|----------|
| Sequence builder UI | 12 hrs | P3 |
| Sequence execution engine | 8 hrs | P3 |
| Stop conditions (reply, unsubscribe, bounce) | 4 hrs | P3 |
| Sequence analytics | 6 hrs | P3 |

**Deliverable**:
- Day 1 → Day 3 → Day 7 automated sequences
- Stops automatically when goal achieved

---

### Phase Summary

| Phase | Focus | Activation Impact | Effort |
|-------|-------|-------------------|--------|
| **1** | Gmail + Survey Send | 🟢 **Critical** - closes the gap | ~1 week |
| **2** | Tracking + Auto-Nudge | 🟢 **Critical** - drives responses | ~1 week |
| **3** | Staging Queue | 🟡 Important for trust/control | ~1 week |
| **4** | AI Personalization | 🟡 Improves response rates | ~3-4 days |
| **5** | Response Monitoring | 🟡 Creates opportunities | ~1 week |
| **6** | Auto-Approval Rules | 🟠 Nice to have | ~3-4 days |
| **7** | Sequences | 🟠 Future expansion | ~2 weeks |

**MVP = Phase 1 + Phase 2** (~2 weeks)

This gives users the core loop:
1. Create survey ✅ (existing)
2. Send to contacts ✅ (Phase 1)
3. Track who responded ✅ (Phase 2)
4. Auto-remind non-responders ✅ (Phase 2)
5. Get responses → See value ✅

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Gmail API rate limits** | 250 quota units/user/second | Queue processing with backoff; batch wisely |
| **Spam complaints** | Account suspension | Staging queue review; unsubscribe handling; warm-up guidance |
| **OAuth token expiry** | Failed sends | Pica handles refresh; retry with fresh token |
| **Reply detection accuracy** | Missed opportunities | Manual "mark as replied" fallback; improve classification over time |
| **User sends without review** | Bad emails go out | Default to manual approval; require explicit auto-approval setup |
| **Threading breaks** | Confusing email experience | Preserve Message-ID and threadId carefully |

---

## Success Metrics

### Activation Metrics (Primary)

| Metric | Current | Target | Why It Matters |
|--------|---------|--------|----------------|
| **Survey completion rate** | ~15% (manual sends) | >30% | Auto-nudge should double responses |
| **Users who get ≥5 responses** | Unknown | >70% of survey creators | This is the activation threshold |
| **Time from survey create → first response** | Days (manual) | <24 hours | Speed to value |
| **Survey abandonment rate** | High (no send) | <20% | Users complete the journey |

### Feature Adoption Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Gmail connection rate** | >60% of active accounts | Accounts with Gmail connected |
| **Survey send adoption** | >80% of surveys | Surveys distributed via UpSight |
| **Auto-nudge enabled** | >70% of sends | Sends with reminders configured |
| **Nudge → Completion rate** | >15% | Recipients who complete after reminder |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Email delivery rate** | >98% | Sent without bounce |
| **Spam complaint rate** | <0.1% | Complaints / sends |
| **Unsubscribe rate** | <2% | Unsubscribes / sends |

---

## Open Questions

1. **Scope: Read-only Gmail access?**
   - Do we want to ingest existing email threads (not just monitor replies to our sends)?
   - This is "Email Ingestion" from the integrations PRD - separate feature?

2. **Unsubscribe handling**
   - Add unsubscribe link to all emails?
   - Maintain suppression list per account?

3. **Email tracking (opens/clicks)**
   - Use tracking pixels/wrapped links?
   - Privacy considerations?

4. **Multi-user sending**
   - Can a team member approve emails that send from another user's Gmail?
   - Or must the Gmail owner approve their own sends?

5. **Workspace vs Consumer Gmail**
   - Different quotas and policies
   - May need different guidance in onboarding

---

## Related Documents

- [Integrations PRD](../integrations/integrations-PRD.md) - Overall integration strategy
- [Email Setup & Deliverability](./email.md) - Transactional email (Engage.so)
- [Pica Server Implementation](../../../app/lib/integrations/pica.server.ts) - Existing Passthrough API
