# Meeting Intelligence – Product Requirements Document

> **Status:** P1 - The Wedge | **Last Updated:** January 2025
> **Owner:** Product/Engineering
> **Thesis:** "Never walk into a customer meeting unprepared again."

---

## Executive Summary

Meeting Intelligence is the wedge for UpSight. Every customer-facing team has meetings. Help them BEFORE (prep), DURING (context), and AFTER (follow-up).

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MEETING INTELLIGENCE WEDGE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│    BEFORE              DURING               AFTER                    │
│    ───────             ──────               ─────                    │
│                                                                      │
│    Calendar sync       Recording            Follow-up drafts         │
│    Meeting briefs      Transcription        Action items             │
│    Customer context    Evidence extraction  CRM updates              │
│                                                                      │
│    "Who is this?"      "Capture it"         "Don't drop the ball"   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this wins:**
- Daily use (not periodic)
- Immediate value (saves 10-15 min prep per meeting)
- Builds customer intelligence passively
- Low friction (just connect calendar)

---

## Value Calculator

### Time Saved Per User

| Activity | Without UpSight | With UpSight | Savings |
|----------|-----------------|--------------|---------|
| Meeting prep | 15 min | 2 min | **13 min** |
| Finding past context | 10 min | 0 min (in brief) | **10 min** |
| Writing follow-up | 12 min | 3 min (edit draft) | **9 min** |
| Tracking action items | 5 min | 1 min (auto-extracted) | **4 min** |
| **Total per meeting** | **42 min** | **6 min** | **36 min** |

### Weekly Impact (Assumes 8 customer meetings/week)

| Metric | Calculation | Value |
|--------|-------------|-------|
| Time saved/week | 36 min × 8 meetings | **4.8 hours** |
| Time saved/month | 4.8 hours × 4 weeks | **19.2 hours** |
| Time saved/year | 19.2 hours × 12 months | **230 hours** |

### Dollar Value

| Role | Hourly Cost | Annual Time Saved | Annual Value |
|------|-------------|-------------------|--------------|
| AE/Sales Rep | $75/hr | 230 hours | **$17,250** |
| Customer Success | $60/hr | 230 hours | **$13,800** |
| Founder/Exec | $150/hr | 230 hours | **$34,500** |

**Per-seat ROI at $50/month subscription:**
- Cost: $600/year
- Value: $13,800-$34,500/year
- **ROI: 23x - 57x**

### Revenue Impact (Harder to measure, higher value)

| Outcome | Mechanism | Estimated Impact |
|---------|-----------|------------------|
| Deals closed faster | Better prep = more relevant conversations | +5-10% close rate |
| Churn prevented | Follow-ups don't fall through cracks | -2-5% churn |
| Expansion revenue | Know when to upsell (from context) | +10-15% expansion |
| Time to first value | Faster onboarding (context from day 1) | -30% ramp time |

**Example: 10-person sales team**
- Base quota: $500K/rep/year = $5M total
- +5% close rate = **$250K additional revenue**
- Tool cost: $6K/year (10 seats × $50/month)
- **ROI: 41x on revenue impact alone**

### Qualitative Value

| Benefit | Who Cares | Why It Matters |
|---------|-----------|----------------|
| Never walk in cold | Sales, CS | Confidence, professionalism |
| No dropped balls | Everyone | Trust, reliability |
| Institutional memory | Org | Knowledge doesn't leave with people |
| Faster onboarding | Managers | New hires productive faster |

---

## The Problem

| Pain Point | Frequency | Who Feels It |
|------------|-----------|--------------|
| "I have a call in 30 min, who is this person?" | Daily | Everyone |
| "What did we discuss last time?" | Every call | CS, Sales |
| "I forgot to follow up" | Weekly | Everyone |
| "Notes go into a doc nobody reads" | Every call | Everyone |
| "No way to find what customers said about X" | Monthly | Product, Exec |

**Current state:**
- Context is scattered (CRM, email, docs, memory)
- Prep is manual and rushed
- Follow-ups fall through cracks
- Customer intelligence is trapped in individual heads

---

## The Solution

### Phase 0: Calendar Integration (Foundation)
**Know what meetings you have**

Connect Google Calendar → UpSight sees your schedule → Foundation for everything.

### Phase 1: Meeting Briefs
**Auto-generate prep before every call**

15 minutes before meeting → Chief of Staff sends brief → You're prepared.

### Phase 2: Recording & Analysis
**Capture and extract insights**

Meeting happens → Automatically recorded → Evidence extracted → Themes linked.

### Phase 3: Follow-up Drafts
**AI generates post-meeting actions**

Meeting ends → Draft follow-up email → Action items captured → CRM updated.

---

## Phase 0: Calendar Integration

### 0.1 Overview

**Goal:** UpSight knows your meeting schedule. Foundation for briefs and follow-ups.

**Integration:** Google Calendar via Pica (OAuth already configured)

### 0.2 Scope

| Feature | Description | Effort |
|---------|-------------|--------|
| Calendar sync | Fetch user's calendar events | 2-3 days |
| Meeting detection | Identify customer vs internal meetings | 1-2 days |
| Contact matching | Link meeting attendees to People records | 2-3 days |
| Scheduling UI | Show upcoming meetings in UpSight | 2-3 days |

**Total: ~1.5 weeks**

### 0.3 User Flow

```
Settings → Connect Google Calendar → OAuth flow
    ↓
UpSight polls calendar every 15 min
    ↓
Meetings appear in "Upcoming" widget
    ↓
Each meeting shows: attendees, matched People, prep status
```

### 0.4 Technical Design

**Using Pica for Google Calendar:**

```typescript
// Fetch upcoming meetings
const calendarEvents = await pica.googleCalendar.listEvents({
  connectionId: user.google_connection_id,
  timeMin: new Date().toISOString(),
  timeMax: addDays(new Date(), 7).toISOString(),
  singleEvents: true,
  orderBy: "startTime",
});
```

**Meeting detection heuristics:**
- Has external attendee (not @company.com) → Likely customer meeting
- Title contains: "call", "demo", "sync", "check-in" → Likely meeting
- 1:1 with known customer email → Definitely customer meeting

**Contact matching:**
- Attendee email → Match to `people.primary_email`
- Create new Person if no match + meeting happens
- Link to Organization via email domain

### 0.5 Schema

```sql
-- User calendar connections
CREATE TABLE calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    provider TEXT NOT NULL DEFAULT 'google', -- 'google', 'outlook'
    connection_id TEXT NOT NULL, -- Pica connection ID
    calendar_id TEXT, -- Specific calendar if not primary
    sync_enabled BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Synced calendar events
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    connection_id UUID REFERENCES calendar_connections(id),

    -- Event data
    external_id TEXT NOT NULL, -- Google/Outlook event ID
    title TEXT,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT, -- Often contains meeting link
    meeting_url TEXT, -- Extracted Zoom/Meet/Teams link

    -- Classification
    is_customer_meeting BOOLEAN DEFAULT false,
    meeting_type TEXT, -- 'customer', 'internal', 'unknown'

    -- Attendees (denormalized for quick access)
    attendee_emails TEXT[],
    organizer_email TEXT,

    -- Matching
    matched_person_ids UUID[], -- Linked People records
    matched_org_id UUID REFERENCES organizations(id),

    -- Status
    brief_generated_at TIMESTAMPTZ,
    brief_id UUID, -- Link to generated brief
    interview_id UUID REFERENCES interviews(id), -- If recorded

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(connection_id, external_id)
);

-- Indexes
CREATE INDEX idx_calendar_events_account ON calendar_events(account_id);
CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_upcoming ON calendar_events(account_id, start_time)
    WHERE start_time > now();
```

---

## Phase 1: Meeting Briefs

### 1.1 Overview

**Goal:** Auto-generate prep document before every customer meeting.

**Trigger:** 15-30 minutes before meeting start (configurable)

### 1.2 Brief Contents

```
┌─────────────────────────────────────────────────────────────────────┐
│ MEETING BRIEF: Acme Corp Check-in                                    │
│ Today at 2:00 PM • 30 min • Zoom                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 👤 WHO YOU'RE MEETING                                                │
│ ─────────────────────                                                │
│ • Sarah Chen, VP Product @ Acme Corp                                 │
│   - 3 previous meetings (last: Dec 15)                               │
│   - Key interests: automation, integrations                          │
│   - Persona: Enterprise Decision Maker                               │
│                                                                      │
│ 🏢 ABOUT ACME CORP                                                   │
│ ─────────────────────                                                │
│ • Enterprise SaaS, 500 employees                                     │
│ • Customer since: March 2024                                         │
│ • Current pain points: onboarding complexity, support response       │
│                                                                      │
│ 📝 LAST INTERACTION (Dec 15)                                         │
│ ─────────────────────                                                │
│ • Discussed: pricing concerns, API integration timeline              │
│ • They said: "We need faster support turnaround"                     │
│ • Action items: Send API docs (✓), Follow up on pricing              │
│                                                                      │
│ ⚡ SUGGESTED TALKING POINTS                                          │
│ ─────────────────────                                                │
│ 1. Follow up on pricing discussion from last call                    │
│ 2. Check status of API integration                                   │
│ 3. Address support concerns - mention new SLA                        │
│                                                                      │
│ 📊 KEY FACTS                                                         │
│ ─────────────────────                                                │
│ • NPS score: 7 (last survey)                                         │
│ • Support tickets: 3 open                                            │
│ • Contract renewal: 60 days                                          │
│                                                                      │
│ [View full history] [Edit brief] [Add notes]                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Sources for Briefs

| Source | What It Provides | Priority |
|--------|------------------|----------|
| **People** | Name, title, company, contact info | P0 |
| **Organizations** | Company details, industry, size | P0 |
| **Interviews** | Past conversations, quotes, evidence | P0 |
| **Evidence** | Pain points, goals, feature requests | P0 |
| **Exa Search** | LinkedIn, recent news, company info (external) | P0 |
| **Themes** | Topics they care about | P1 |
| **CRM** (future) | Deal stage, value, health score | P2 |
| **Support** (future) | Open tickets, recent issues | P2 |

### 1.3.1 External Research via Exa

For unknown contacts or thin internal context, use Exa to enrich:

**Person research:**
- LinkedIn profile → role, tenure, background
- Recent posts/articles → topics they care about
- Company news → context for conversation

**Company research:**
- Recent funding/announcements
- Product launches
- Leadership changes
- Industry news

```typescript
// Exa search for meeting attendees
const personInfo = await exa.search({
  query: `${person.name} ${person.company} LinkedIn`,
  numResults: 3,
  useAutoprompt: true,
});

const companyNews = await exa.search({
  query: `${organization.name} news announcements`,
  numResults: 5,
  startPublishedDate: subMonths(new Date(), 3).toISOString(),
});
```

This ensures briefs are valuable even for first-time meetings with no prior context.

### 1.4 User Flow

```
15 min before meeting
    ↓
Trigger.dev job runs
    ↓
Pull context: People, Orgs, past interviews, evidence
    ↓
Chief of Staff generates brief
    ↓
Save to database
    ↓
Send notification: "Brief ready for 2pm call with Acme"
    ↓
User clicks → Opens brief in UpSight
```

### 1.5 Delivery Options

| Channel | Implementation | Effort |
|---------|----------------|--------|
| In-app notification | Badge + drawer | 1 week |
| Email digest | Morning summary of day's meetings | 3-4 days |
| Slack | DM or channel post | 2-3 days |
| Calendar event update | Add brief link to event description | 2 days |

**Start with:** In-app + calendar event update

### 1.6 Technical Design

**Trigger.dev task:**

```typescript
export const generateMeetingBriefTask = schemaTask({
  id: "meeting.generate-brief",
  schema: z.object({
    calendarEventId: z.string(),
    accountId: z.string(),
  }),
  run: async ({ calendarEventId, accountId }) => {
    // 1. Fetch calendar event
    const event = await getCalendarEvent(calendarEventId);

    // 2. Match attendees to People
    const people = await matchAttendeesToPeople(
      event.attendee_emails,
      accountId
    );

    // 3. Fetch context for each person
    const context = await Promise.all(
      people.map(p => getPersonContext(p.id, accountId))
    );

    // 4. Generate brief using Chief of Staff
    const brief = await generateBrief({
      event,
      people,
      context,
      recentInteractions: await getRecentInteractions(people, accountId),
    });

    // 5. Save brief
    await saveMeetingBrief(calendarEventId, brief);

    // 6. Notify user
    await notifyBriefReady(event.user_id, calendarEventId);

    return { success: true, briefId: brief.id };
  },
});
```

**BAML prompt for brief generation:**

```baml
function GenerateMeetingBrief(input: MeetingBriefInput) -> MeetingBrief {
  client GPT4o
  prompt #"
    Generate a concise meeting brief for the following call.

    MEETING:
    - Title: {{ input.event.title }}
    - Time: {{ input.event.start_time }}
    - Attendees: {{ input.attendees | join(", ") }}

    PEOPLE CONTEXT:
    {% for person in input.people %}
    {{ person.name }} ({{ person.title }} @ {{ person.company }}):
    - Previous meetings: {{ person.meeting_count }}
    - Key interests: {{ person.interests | join(", ") }}
    - Recent quotes: {{ person.recent_quotes | join("; ") }}
    {% endfor %}

    RECENT INTERACTIONS:
    {{ input.recent_interactions | format_interactions }}

    Generate a brief with:
    1. Quick summary of who they are
    2. What you discussed last time
    3. 2-3 suggested talking points based on context
    4. Any open action items

    Keep it scannable - this will be read 5 min before the call.
  "#
}
```

### 1.7 Schema Additions

```sql
-- Meeting briefs
CREATE TABLE meeting_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_event_id UUID NOT NULL REFERENCES calendar_events(id),
    account_id UUID NOT NULL REFERENCES accounts(id),

    -- Content
    content JSONB NOT NULL, -- Structured brief data
    content_md TEXT, -- Rendered markdown

    -- Generation
    generated_at TIMESTAMPTZ DEFAULT now(),
    generation_model TEXT,
    prompt_version TEXT,

    -- User interaction
    viewed_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    user_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Phase 2: Recording & Analysis

This is the existing Recall.ai integration. See detailed technical spec below.

### 2.1 Quick Summary

| Component | Status |
|-----------|--------|
| Recall.ai webhook handler | Planned |
| Media download to R2 | Planned |
| Transcription pipeline | Existing (reuse interview pipeline) |
| Evidence extraction | Existing |
| Theme linking | Existing |

### 2.2 Connection to Meeting Flow

```
Calendar event (Phase 0)
    ↓
Brief generated (Phase 1)
    ↓
User joins meeting
    ↓
Recording captured via Recall.ai
    ↓
Webhook → create interview record
    ↓
Link interview to calendar_event
    ↓
Existing pipeline: transcription → evidence → themes
    ↓
Follow-up draft generated (Phase 3)
```

---

## Phase 3: Follow-up Drafts

### 3.1 Overview

**Goal:** After meeting ends, generate follow-up email draft with action items.

**Trigger:** Recording processed (or manual trigger if not recorded)

### 3.2 Follow-up Contents

```
┌─────────────────────────────────────────────────────────────────────┐
│ FOLLOW-UP DRAFT: Acme Corp Check-in                                  │
│ Meeting: Today at 2:00 PM                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ TO: sarah.chen@acme.com                                              │
│ SUBJECT: Follow-up: Our call today                                   │
│                                                                      │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│ Hi Sarah,                                                            │
│                                                                      │
│ Thanks for taking the time to chat today. Here's a quick summary:    │
│                                                                      │
│ **What we discussed:**                                               │
│ - Your team's timeline for the API integration (targeting Q2)        │
│ - Concerns about support response times                              │
│ - Interest in the new dashboard features                             │
│                                                                      │
│ **Action items:**                                                    │
│ - [ ] I'll send the updated API documentation by EOD tomorrow        │
│ - [ ] Schedule a call with our support lead re: SLA options          │
│ - [ ] Share the dashboard beta access link                           │
│                                                                      │
│ Let me know if I missed anything!                                    │
│                                                                      │
│ Best,                                                                │
│ [Your name]                                                          │
│                                                                      │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│ [Copy to clipboard] [Open in Gmail] [Edit] [Send later]              │
│                                                                      │
│ ⚠️ Action items detected:                                            │
│ • Send API docs (assigned: you, due: tomorrow)                       │
│ • Schedule support call (assigned: you, due: this week)              │
│ • Share beta access (assigned: you, due: today)                      │
│                                                                      │
│ [Create tasks] [Add to CRM] [Dismiss]                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Sources

| Source | What It Provides |
|--------|------------------|
| Meeting transcript | What was discussed |
| Evidence extracted | Key quotes, pain points |
| Calendar event | Attendees, meeting title |
| Previous interactions | Context for personalization |

### 3.4 User Flow

```
Meeting ends → Recording processed
    ↓
AI analyzes transcript
    ↓
Generate follow-up draft
    ↓
Extract action items
    ↓
Notification: "Follow-up ready for review"
    ↓
User reviews, edits, sends
    ↓
(Optional) Action items → Tasks
```

### 3.5 Technical Design

**Trigger.dev task:**

```typescript
export const generateFollowUpTask = schemaTask({
  id: "meeting.generate-followup",
  schema: z.object({
    interviewId: z.string(),
    calendarEventId: z.string().optional(),
  }),
  run: async ({ interviewId, calendarEventId }) => {
    // 1. Fetch transcript and evidence
    const interview = await getInterview(interviewId);
    const evidence = await getInterviewEvidence(interviewId);

    // 2. Fetch meeting context
    const event = calendarEventId
      ? await getCalendarEvent(calendarEventId)
      : null;

    // 3. Get attendee info
    const attendees = await getInterviewParticipants(interviewId);

    // 4. Generate follow-up using Chief of Staff
    const followUp = await generateFollowUp({
      transcript: interview.full_transcript,
      evidence,
      attendees,
      previousInteractions: await getPreviousInteractions(attendees),
    });

    // 5. Extract action items
    const actionItems = await extractActionItems(followUp, interview);

    // 6. Save draft
    await saveFollowUpDraft(interviewId, followUp, actionItems);

    // 7. Notify user
    await notifyFollowUpReady(interview.created_by, interviewId);

    return { success: true };
  },
});
```

### 3.6 Schema Additions

```sql
-- Follow-up drafts
CREATE TABLE meeting_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interviews(id),
    calendar_event_id UUID REFERENCES calendar_events(id),
    account_id UUID NOT NULL REFERENCES accounts(id),

    -- Recipients
    to_emails TEXT[],
    cc_emails TEXT[],

    -- Content
    subject TEXT,
    body_html TEXT,
    body_text TEXT,

    -- Action items
    action_items JSONB DEFAULT '[]',

    -- Status
    status TEXT DEFAULT 'draft', -- 'draft', 'edited', 'sent', 'dismissed'
    sent_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,

    -- Generation
    generated_at TIMESTAMPTZ DEFAULT now(),
    generation_model TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Action items (can be converted to tasks)
CREATE TABLE meeting_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    followup_id UUID REFERENCES meeting_followups(id),
    interview_id UUID REFERENCES interviews(id),
    account_id UUID NOT NULL REFERENCES accounts(id),

    -- Item
    description TEXT NOT NULL,
    assignee TEXT, -- 'me', 'them', or specific name
    due_hint TEXT, -- 'today', 'tomorrow', 'this_week', 'next_week'

    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'converted', 'dismissed'
    task_id UUID REFERENCES tasks(id), -- If converted to task

    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Implementation Roadmap

### Phase 0: Calendar (Week 1-2)
| Day | Task |
|-----|------|
| 1-2 | Calendar connection UI + Pica OAuth flow |
| 3-4 | Calendar sync Trigger.dev task |
| 5-6 | Meeting detection + contact matching |
| 7-8 | Upcoming meetings widget |
| 9-10 | Testing + polish |

**Ship:** Users can connect calendar and see upcoming customer meetings

### Phase 1: Briefs (Week 3-4)
| Day | Task |
|-----|------|
| 1-2 | Brief generation Trigger.dev task |
| 3-4 | BAML prompt for brief content |
| 5-6 | Brief UI (drawer/page) |
| 7-8 | Notification system |
| 9-10 | Calendar event description update |

**Ship:** Users get auto-generated briefs before customer meetings

### Phase 2: Recording (Week 5-7)
| Day | Task |
|-----|------|
| 1-3 | Recall.ai webhook endpoint |
| 4-5 | Media download to R2 |
| 6-8 | Integration with existing pipeline |
| 9-10 | Link recordings to calendar events |
| 11-14 | Desktop app or bot setup |

**Ship:** Customer meetings automatically recorded and analyzed

### Phase 3: Follow-ups (Week 8-9)
| Day | Task |
|-----|------|
| 1-2 | Follow-up generation task |
| 3-4 | Action item extraction |
| 5-6 | Follow-up UI |
| 7-8 | Email send integration (Gmail via Pica) |
| 9-10 | Task conversion |

**Ship:** AI-generated follow-up drafts with action items

---

## Success Metrics

| Phase | Metric | Target | Why |
|-------|--------|--------|-----|
| 0 | Calendars connected | 70% of users | Foundation |
| 1 | Briefs viewed before meeting | 60%+ | Prep value |
| 2 | Meetings recorded | 50%+ of customer meetings | Coverage |
| 3 | Follow-ups sent | 40%+ have at least 1 edit before send | AI quality |

### North Star Metrics
| Metric | Target | Why |
|--------|--------|-----|
| Weekly active users | 60%+ of seats | Daily utility |
| Time to meeting prep | <2 min (from 15 min) | Core value |
| Follow-up sent within 24h | 80%+ | Completeness |

---

## Technical Details: Recall.ai Recording Integration

### Overview

Integrate Recall.ai Desktop SDK to automatically capture meeting recordings from Zoom, Google Meet, and Microsoft Teams.

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Recall.ai      │     │  Our Backend     │     │  Trigger.dev    │
│  Desktop SDK    │────▶│  Webhook API     │────▶│  Orchestrator   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Cloudflare R2   │     │  AssemblyAI     │
                        │  (media storage) │     │  (transcription)│
                        └──────────────────┘     └─────────────────┘
```

### Webhook Endpoint

**Route:** `POST /api/recall-webhook`

**Events to Handle:**
1. `sdk_upload.complete` - Recording finished, media available
2. `transcript.done` - Async transcription complete

### Webhook Handler

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.json();

  // Verify webhook signature
  const signature = request.headers.get('X-Recall-Signature');
  if (!verifyRecallSignature(payload, signature)) {
    return json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (payload.event === 'sdk_upload.complete') {
    const { id: recordingId, metadata, media_shortcuts } = payload.data;

    // Extract context from upload token metadata
    const { account_id, project_id, user_id, calendar_event_id } = metadata;

    // Download media to R2
    const mediaR2Key = await downloadRecallMediaToR2({
      downloadUrl: media_shortcuts.video_mixed.data.download_url,
      accountId: account_id,
      projectId: project_id,
      recordingId,
    });

    // Create interview record
    const interview = await createInterview({
      account_id,
      project_id,
      source_type: 'recall',
      meeting_platform: payload.data.platform,
      recall_recording_id: recordingId,
      media_r2_key: mediaR2Key,
      status: 'processing',
    });

    // Link to calendar event if available
    if (calendar_event_id) {
      await linkInterviewToCalendarEvent(interview.id, calendar_event_id);
    }

    // Trigger processing pipeline
    await processRecallMeetingTask.trigger({
      interviewId: interview.id,
      accountId: account_id,
      projectId: project_id,
    });

    return json({ success: true, interview_id: interview.id });
  }

  return json({ success: true });
}
```

### Processing Task

```typescript
export const processRecallMeetingTask = schemaTask({
  id: "meeting.process-recall",
  schema: z.object({
    interviewId: z.string(),
    accountId: z.string(),
    projectId: z.string(),
  }),
  run: async ({ interviewId, accountId, projectId }) => {
    // 1. Get interview record
    const interview = await getInterview(interviewId);

    // 2. Transcribe using AssemblyAI (existing pipeline)
    const transcriptResult = await uploadAndTranscribeTaskV2.triggerAndWait({
      interviewId,
      mediaR2Key: interview.media_r2_key,
    });

    if (!transcriptResult.ok) {
      throw new Error('Transcription failed');
    }

    // 3. Extract evidence (existing pipeline)
    await extractEvidenceTask.triggerAndWait({
      interviewId,
      accountId,
      projectId,
    });

    // 4. Link to themes (existing pipeline)
    await linkEvidenceToThemesTask.triggerAndWait({
      interviewId,
      accountId,
      projectId,
    });

    // 5. Generate follow-up draft
    const calendarEventId = await getLinkedCalendarEvent(interviewId);
    if (calendarEventId) {
      await generateFollowUpTask.trigger({
        interviewId,
        calendarEventId,
      });
    }

    // 6. Mark complete
    await updateInterview(interviewId, { status: 'completed' });

    return { success: true };
  },
});
```

### Database Schema Changes

```sql
-- Extend interviews table
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT; -- 'zoom', 'google_meet', 'teams'

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS recall_recording_id TEXT UNIQUE;
```

### Desktop App API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/desktop/auth` | Authenticate desktop app |
| `GET /api/desktop/context` | Get accounts/projects |
| `POST /api/desktop/recall-token` | Generate upload token |
| `GET /api/desktop/recordings/:id/status` | Check processing status |

### Environment Variables

```bash
RECALL_API_KEY=your-recall-api-key
RECALL_WEBHOOK_SECRET=your-webhook-signing-secret
```

---

## Open Questions

1. **Calendar scope:** All calendars or specific "customer meetings" calendar?
2. **Brief timing:** 15 min, 30 min, or morning digest?
3. **Follow-up editing:** In-app editor or open in Gmail?
4. **Action items:** Auto-create tasks or just suggest?
5. **Recording consent:** How to handle legal/consent requirements?

---

## Why This Is The Wedge

| Factor | Meeting Intelligence | Video Collections | Research Stories |
|--------|---------------------|-------------------|------------------|
| **Frequency** | Daily | Periodic | Periodic |
| **Value visibility** | Immediate (prep saved) | Delayed (testimonial posted) | Delayed (story shared) |
| **Adoption friction** | Low (connect calendar) | Medium (curate videos) | High (learn tool) |
| **TAM** | All customer-facing | Marketing, Sales | Research, Product |
| **Data flywheel** | Every meeting = more context | User must curate | User must create |

**Bottom line:** Meeting Intelligence builds the customer intelligence layer passively. Everything else (stories, reels, collections) becomes more valuable once we have meeting context flowing in.
