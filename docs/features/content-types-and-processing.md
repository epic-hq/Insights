# Content Types and Processing

## Philosophy

**Analyze everything by default.** All content should be transcribed, indexed, and have lenses applied unless the user explicitly marks it as private at creation time. The value of a piece of content is not determined by how it was captured or how many people participated.

## Key Principles

1. **Capture method is metadata, not a processing rule** - A solo voice memo gets the same analysis as a 5-person focus group
2. **Speaker count is context for AI, not a filter** - BAML functions can adapt their analysis based on participant count, but processing always runs
3. **Default to inclusion** - Content appears in project aggregations, lens summaries, and search by default
4. **Privacy is explicit** - Only content marked "private" at creation is excluded from aggregations
5. **Everything is re-analyzable** - Users can edit content and re-run analysis at any time
6. **Everything is deletable** - Users can delete any content and have it "forgotten" from all indexes and aggregations
7. **Naming reflects user intent, not implementation** - Users see "Written interview" not "async interview"

---

## Content Model

### Interview Mode (How the conversation happened)

| Mode | User-Facing Label | Description |
|------|-------------------|-------------|
| `live` | Live Interview | Real-time conversation recorded via browser |
| `written` | Written Interview | Participant responds to prompts via form, email, or text |
| `chat` | Chat Interview | Conversational exchange with AI interviewer bot |
| `imported` | Imported Recording | Audio/video file uploaded from external source |

**User-facing terminology matters.** Users don't care about "async" - they care whether it's a form, a chat, or a recording. The UI should use clear labels:
- "Record a conversation" → `live`
- "Send interview questions" → `written` or `chat` (user chooses)
- "Upload a recording" → `imported`

### Source Type (Technical capture method)

| Source | Description | Processing Path |
|--------|-------------|-----------------|
| `livekit_recording` | WebRTC recording via LiveKit | Transcription → full pipeline |
| `upload` | Audio/video file upload | Transcription → full pipeline |
| `manual_text` | Typed/pasted text | Direct to evidence extraction |
| `form_response` | Structured Q&A via our form | Compile to transcript → full pipeline |
| `bot_chat` | AI interviewer conversation | Already structured → full pipeline |
| `import` | Imported from external platform | Parse structure → full pipeline |

### Source Channel (Where content originated)

For imported content, track the originating platform. **Use a text field, not an enum** - new channels will emerge and we don't want schema migrations for each.

**Known channels (not exhaustive):**
- `app` - Our app (recording, form, paste)
- `email` - Email thread or response
- `slack` - Slack conversation
- `teams` - Microsoft Teams
- `google_meet` - Google Meet transcript
- `zoom` - Zoom transcript
- `gong` - Gong recording
- `chorus` - Chorus.ai
- `fireflies` - Fireflies.ai
- `otter` - Otter.ai
- `intercom` - Intercom
- `zendesk` - Zendesk
- `hubspot` - HubSpot
- `salesforce` - Salesforce
- `front` - Front
- ... (extensible via integrations table)

**Future: Integrations Table**

Rather than hardcoding channels, plan for an `integrations` table that defines available sources and targets. The `source_channel` field on interviews becomes a soft reference to integration slugs.

```sql
-- Integration definitions (system-level, not per-account)
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,  -- 'slack', 'gong', 'hubspot'
  display_name text NOT NULL,
  icon_url text,

  -- Capabilities
  can_import boolean DEFAULT false,    -- Can we pull data from this?
  can_export boolean DEFAULT false,    -- Can we push data to this?
  can_oauth boolean DEFAULT false,     -- Supports OAuth connection?
  can_webhook boolean DEFAULT false,   -- Supports webhook events?

  -- Configuration
  import_config jsonb,    -- How to parse imported content
  export_config jsonb,    -- What/how to write back
  oauth_config jsonb,     -- OAuth endpoints, scopes

  -- Metadata
  category text,          -- 'recording', 'crm', 'support', 'chat', 'email'
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Account-level integration connections
CREATE TABLE account_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  integration_id uuid REFERENCES integrations(id),

  -- Connection state
  is_connected boolean DEFAULT false,
  connected_at timestamptz,
  connected_by uuid,

  -- Credentials (encrypted)
  oauth_tokens jsonb,     -- Access/refresh tokens
  api_keys jsonb,         -- API keys if not OAuth

  -- Settings
  import_enabled boolean DEFAULT true,
  export_enabled boolean DEFAULT false,
  auto_import boolean DEFAULT false,  -- Auto-import new content?

  -- Writeback configuration
  writeback_settings jsonb,  -- What to sync back, field mappings

  UNIQUE(account_id, integration_id)
);

-- Track what we've imported (for deduplication and sync)
CREATE TABLE integration_sync_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_integration_id uuid REFERENCES account_integrations(id),
  external_id text NOT NULL,        -- ID in source system
  external_url text,                -- Link back to source
  interview_id uuid REFERENCES interviews(id),

  -- Sync state
  imported_at timestamptz,
  last_synced_at timestamptz,
  sync_status text,                 -- 'imported', 'synced', 'error'

  -- For writeback
  exported_at timestamptz,
  export_status text,

  UNIQUE(account_integration_id, external_id)
);
```

**Writeback use cases:**
- Push interview summaries to HubSpot/Salesforce deal records
- Create tasks in Asana/Linear from extracted action items
- Update CRM contact records with persona insights
- Sync themes back to Notion/Confluence

**Interview table relationship:**
```sql
-- On interviews table, soft reference to integration
ALTER TABLE interviews ADD COLUMN source_channel text;  -- Matches integrations.slug
ALTER TABLE interviews ADD COLUMN integration_sync_id uuid REFERENCES integration_sync_records(id);
```

This allows:
- Flexible addition of new channels (just add row to integrations)
- Per-account connection management
- Bidirectional sync tracking
- Deduplication on re-import

**Combining interview_mode + source_channel:**

| Scenario | interview_mode | source_type | source_channel |
|----------|---------------|-------------|----------------|
| Live recording in our app | `live` | `livekit_recording` | `app` |
| Uploaded MP3 file | `imported` | `upload` | `app` |
| Form response to our questions | `written` | `form_response` | `app` |
| Email reply to our questions | `written` | `import` | `email` |
| AI bot interview | `chat` | `bot_chat` | `app` |
| Imported Slack thread | `imported` | `import` | `slack` |
| Imported email thread | `imported` | `import` | `email` |
| Gong call import | `imported` | `import` | `gong` |
| Google Meet transcript | `imported` | `import` | `google_meet` |
| Pasted Zoom transcript | `imported` | `manual_text` | `zoom` |

### Explicit Metadata Columns

Rather than inferring capabilities from type, store explicitly:

| Column | Type | Purpose |
|--------|------|---------|
| `has_media` | boolean | Audio/video file exists |
| `has_timestamps` | boolean | Word-level timing available |
| `has_speakers` | boolean | Speaker diarization available |
| `speaker_count` | integer | Number of distinct speakers detected |
| `processing_version` | integer | Schema version for reprocessing compatibility |

### Interaction Context (What kind of conversation)

This enum determines default lenses, aggregation targets, and dashboard grouping:

| Context | Description | Default Lenses | Aggregates To |
|---------|-------------|----------------|---------------|
| `research` | User research, discovery, customer interviews | Customer Discovery, Empathy Map | Project insights, personas |
| `sales` | Demos, qualification, deal discussions | Sales BANT, Objection tracking | Opportunity records, pipeline |
| `support` | Support calls, escalations, check-ins | Customer health, Issue tracking | Account records, health scores |
| `internal` | Team meetings, debriefs, planning | Project Research | Linked records (if any) |
| `personal` | Voice memos, reflections, notes | Personal Summary (lightweight) | User's private insights |

**Internal is not a silo.** An internal debrief about Customer X should:
1. Be marked as `interaction_context = internal`
2. Be linked to Customer X's account/opportunity record
3. Have insights flow to that record's aggregations

This way team discussions contribute to the full picture without users feeling like they're "lying" by calling it an interview.

### LLM-Determined Interaction Context

Rather than asking users to categorize content or using brittle rules (speaker count, linked records), **let the LLM determine interaction_context during evidence extraction**.

**Pipeline integration:**

```
1. TRANSCRIBE
   ↓
2. EXTRACT EVIDENCE (modified)
   ↓
   LLM analyzes transcript and outputs:
   - evidence_units[] (existing)
   - interaction_context: research | sales | support | internal | personal
   - context_confidence: 0.0-1.0
   - context_reasoning: "Single speaker discussing personal goals for 2026"
   ↓
   Store interaction_context on interview record
   ↓
3. APPLY LENSES
   ↓
   Read interaction_context from interview
   Select lenses based on context (see below)
   ↓
4. FINALIZE
```

**BAML modification (extractEvidence):**

```baml
class EvidenceExtractionResult {
  evidence_units EvidenceUnit[]

  // NEW: LLM-determined context
  interaction_context InteractionContext
  context_confidence float @description("0.0-1.0 confidence in classification")
  context_reasoning string @description("Brief explanation of why this context was chosen")
}

enum InteractionContext {
  research    @description("User research, customer discovery, interviews")
  sales       @description("Sales calls, demos, deal discussions, objection handling")
  support     @description("Support tickets, escalations, customer success check-ins")
  internal    @description("Team meetings, debriefs, planning sessions")
  personal    @description("Solo reflections, voice memos, personal notes")
}
```

**Prompt addition:**

```
Analyze this transcript and determine the interaction context:
- research: Customer/user research interviews, discovery conversations
- sales: Sales calls, demos, qualification, deal discussions
- support: Support conversations, escalations, customer success
- internal: Team meetings, internal debriefs, planning
- personal: Solo voice memos, reflections, personal notes

Consider:
- Number of speakers and their roles
- Topics discussed (deals, products, personal goals, team updates)
- Tone and formality
- Whether external customers/users are involved
```

**Benefits:**
- No user input required at recording time
- LLM understands nuance ("this voice memo is a sales debrief" vs "personal reflection")
- Not brittle like rule-based inference
- Context stored for downstream use
- User can override if LLM got it wrong

### Content-Type-Based Lens Selection

The lens selection hierarchy becomes:

```
1. Explicit lensesToApply parameter (backfill, manual override)
2. Project settings → enabled_lenses (if configured)
3. Account settings → default_lens_keys (if configured)
4. **LLM-determined interaction_context** → context-appropriate lenses
5. Platform defaults → ["customer-discovery"]
```

**Context-to-lens mapping:**

```typescript
const CONTEXT_DEFAULT_LENSES: Record<InteractionContext, string[]> = {
  research: ["customer-discovery", "empathy-map-jtbd"],
  sales: ["sales-bant", "customer-discovery"],
  support: ["customer-health"],  // TODO: create support lens
  internal: ["project-research"],
  personal: ["personal-summary"],
};
```

**Personal Summary Lens (for voice memos/reflections)**

A lightweight lens optimized for solo content:

```yaml
key: personal-summary
name: Personal Summary
description: Quick insights from voice memos and personal reflections

sections:
  - key: key_points
    name: Key Points
    description: Main ideas and decisions captured
  - key: action_items
    name: Action Items
    description: Tasks and follow-ups mentioned
  - key: themes
    name: Themes
    description: Recurring topics or concerns
  - key: commitments
    name: Commitments
    description: Goals, promises, or intentions stated

# Lightweight - no BANT, no empathy map, no entity extraction
# Focused on personal utility and quick capture
```

**User override (detail page):**

If the LLM got it wrong, user can click the context badge and change it:
- Shows current: "Personal reflection" with confidence indicator
- Dropdown to override: Research, Sales, Support, Internal, Personal
- Override triggers re-application of appropriate lenses

### Additional Interview Types (for clarity)

Beyond the context enum, some specific patterns users expect:

| Pattern | How to Model |
|---------|--------------|
| Sales call / demo / discovery | `interaction_context = sales`, link to opportunity |
| Support call / escalation | `interaction_context = support`, link to account |
| Internal debrief about customer | `interaction_context = internal`, link to account/opportunity |
| Chat-based interview (Slack/DM) | `source_type = chat_transcript`, `interview_mode = chat` |
| Solo voice memo | `speaker_count = 1`, process normally |
| Focus group | `speaker_count > 2`, `interaction_context = research` |

### Visibility Settings (Who sees the content)

| Setting | Description | Aggregation Behavior |
|---------|-------------|---------------------|
| **Project** (default) | Visible to project members | Included in all project-level lens summaries, search, aggregations |
| **Account** | Visible to all account members | Included in account-wide views, excluded from project-specific summaries |
| **Private** | Visible only to creator | Excluded from all aggregations and shared views |

**Default is Project visibility.** Users must explicitly choose Private if they want content excluded.

### Auth vs Inclusion (Two Separate Concerns)

**Authorization (Auth):** Can the user access this content at all?
- Handled by RLS policies and RPC checks
- Binary: yes/no access based on account/project membership
- Security concern

**Rollup Inclusion:** Should this content contribute to Project X's insights?
- Product rule, not auth rule
- Determined by `project_id` assignment
- `project_id != null` → included in that project's rollups
- `project_id == null` → account-level only

Future consideration: "Account-level content optionally included in Project X" would need a join table or `included_project_ids[]`. Punt for now - simple rule works.

---

## Processing Pipeline

All content follows the same processing pipeline regardless of capture method or category:

```
1. CONTENT CREATED
   ↓
   Capture method determines initial processing:
   - Audio/video → Transcription
   - Document → Text extraction
   - Text → Direct indexing
   - Async response → Structured data extraction
   ↓
2. TRANSCRIPTION / EXTRACTION
   ↓
   Output: Full text, speaker labels (if available), timestamps
   ↓
3. EVIDENCE EXTRACTION
   ↓
   AI extracts quotes, insights, themes from content
   Stores with timestamp anchors for navigation
   ↓
4. LENS APPLICATION
   ↓
   Apply all enabled lenses for project/account
   Each lens extracts structured insights (BANT, empathy map, etc.)
   ↓
5. INDEXING
   ↓
   Vector embeddings for semantic search
   Link to people, organizations, opportunities mentioned
   ↓
6. AGGREGATION
   ↓
   If visibility != private:
   - Include in project lens summaries
   - Include in theme clustering
   - Include in persona insights
   - Link to CRM records if applicable
```

### Processing Metadata for AI

The BAML functions receive context about the content to adapt their analysis:

```typescript
interface ContentContext {
  // Capture metadata
  captureMethod: "live_recording" | "upload" | "text" | "async_response";
  speakerCount: number;  // 1 for solo, 2+ for conversations
  durationSeconds?: number;

  // Content hints
  category?: string;  // User-selected or auto-detected
  linkedRecords?: {
    opportunityId?: string;
    accountId?: string;
    personIds?: string[];
  };

  // Project context
  projectGoals?: string;
  interviewPrompts?: string[];
}
```

AI functions can use this context to:
- Adjust tone analysis (solo reflection vs multi-party debate)
- Focus extraction on relevant frameworks (sales call → BANT emphasis)
- Link insights to appropriate records

---

## Written Interviews (Remote Participant Responses)

### Overview

Users can send interview prompts to participants who respond remotely via:
- **Form**: Structured questions with text responses (like a survey)
- **Chat**: Conversational interaction with AI interviewer bot
- **Email**: Participant replies to questions via email (we parse and match Q&A)

**User-facing labels:**
- "Send interview questions" or "Written interview"
- NOT "async interview" (implementation detail users don't care about)

### Flow

```
1. USER CREATES WRITTEN INTERVIEW
   ↓
   Select project (inherits interview prompts)
   Choose response mode: Form, Chat, or Email
   Enter participant email or generate shareable link
   ↓
2. PARTICIPANT RECEIVES INVITATION
   ↓
   Opens link in browser (no account required)
   Or receives email with questions
   ↓
3. PARTICIPANT RESPONDS
   ↓
   Form: Fills out structured Q&A fields
   Chat: Converses with AI that asks follow-ups based on prompts
   Email: Replies with answers (we parse and match to questions)
   ↓
4. RESPONSE SUBMITTED/RECEIVED
   ↓
   Creates interview record with:
   - interview_mode: "written" or "chat"
   - source_type: "form_response" | "chat_transcript" | "email_import"
   - speaker_count: 1 (participant) or 2 (if including bot turns)
   - interaction_context: inherited from project or set explicitly
   - visibility: "project" (default)
   ↓
5. STANDARD PROCESSING
   ↓
   Same pipeline as all content:
   Evidence extraction → Lens application → Indexing → Aggregation
```

### Data Model

```typescript
interface WrittenInterview {
  id: string;
  projectId: string;
  accountId: string;

  // Configuration
  responseMode: "form" | "chat" | "email";
  prompts: InterviewPrompt[];  // From project or custom

  // Participant
  participantEmail?: string;
  participantName?: string;
  shareToken: string;  // For link-based access

  // Status
  status: "pending" | "in_progress" | "submitted" | "expired";
  expiresAt?: Date;

  // Response data
  responses: WrittenResponse[];
  submittedAt?: Date;

  // Link to created interview
  interviewId?: string;
}

interface WrittenResponse {
  promptId: string;
  questionText: string;  // Denormalized for email matching
  response: string;
  respondedAt: Date;

  // For chat mode - follow-up exchanges
  followUps?: Array<{
    question: string;
    response: string;
    timestamp: Date;
  }>;
}
```

### Processing Written Responses

When submitted, responses are converted to an interview record:

1. **Compile responses into transcript format**
   - Form: Q&A pairs formatted as dialogue
   - Chat: Full conversation thread with turns
   - Email: Parsed responses matched to questions

2. **Create interview record**
   - `interview_mode`: "written" or "chat"
   - `source_type`: "form_response" | "chat_transcript" | "email_import"
   - `has_speakers`: true (Q = interviewer, A = participant)
   - Link to participant person record (create if new)

3. **Run standard pipeline**
   - Evidence extraction finds insights in responses
   - Lenses apply based on project settings
   - Results aggregate with other project content

### Email Response Matching

For email-based responses, we need to match free-form text to questions:

```typescript
interface EmailParseResult {
  confidence: number;  // How confident we are in the match
  matchedResponses: Array<{
    promptId: string;
    extractedResponse: string;
    matchConfidence: number;
  }>;
  unmatchedText?: string;  // Content we couldn't attribute
}
```

Low-confidence matches should be flagged for human review.

---

## CRM Integration

### Linking Content to Records

Any content can be linked to CRM records:

- **Opportunities**: Sales calls, deal discussions, competitor mentions
- **Accounts/Organizations**: Customer conversations, support interactions
- **People**: Individual participant insights, quotes

### Auto-Linking

The system should attempt auto-linking based on:
- Explicit mentions in transcript ("talking about Acme Corp deal")
- Participant identity (if known person is speaking)
- User selection at creation time

### Internal Discussions About External Topics

When a team has an internal meeting discussing a customer or deal:

1. Content is created as normal (internal meeting)
2. User links it to relevant opportunity/account
3. Lens insights flow to that record's aggregation
4. Appears in both "team discussions" and "deal insights"

This ensures internal debriefs contribute to the full picture of a customer relationship.

---

## Privacy and Deletion

### The "Undo Downstream" Problem

When content is deleted or made private, users expect it to immediately disappear from:
- Theme clusters
- Lens summaries
- Search results
- Project aggregations
- CRM record insights

If it still shows up anywhere, trust is broken. We need immediate hide + async cleanup.

### Deletion Flow

```
1. USER CLICKS DELETE
   ↓
   Immediately:
   - Set deleted_at timestamp
   - Hide from all UI queries (WHERE deleted_at IS NULL)
   - Return success to user
   ↓
2. ENQUEUE CLEANUP JOB
   ↓
   Async tasks (can take time):
   - Remove from vector search indexes
   - Remove evidence from theme clusters
   - Recalculate lens summaries that included this content
   - Remove from CRM record aggregations
   - Purge from any caches
   ↓
3. UI STATUS (optional)
   ↓
   If user views related aggregations during cleanup:
   "Updating insights..." indicator
   ↓
4. HARD DELETE (after retention period)
   ↓
   Permanently remove all data
```

### Privacy Flip Flow

When changing visibility from Project → Private:

```
1. USER CHANGES VISIBILITY TO PRIVATE
   ↓
   Immediately:
   - Set visibility = 'private'
   - Set visibility_changed_at timestamp
   - Hide from project/account queries
   ↓
2. ENQUEUE CLEANUP JOB
   ↓
   Same as deletion cleanup:
   - Remove from project lens summaries
   - Remove from theme clusters
   - Remove from search (except personal)
   - Recalculate affected aggregations
   ↓
3. CONTENT STILL ACCESSIBLE
   ↓
   User can still see their private content
   Still fully processed and searchable in personal view
```

### Marking Content Private at Creation

At creation time, user can toggle visibility to "Private":
- Content is still fully processed (for personal use)
- Never added to project/account aggregations in the first place
- Only visible to creator
- Can be changed to Project/Account later (triggers re-aggregation)

### Re-analysis

User can trigger re-analysis at any time:
- Edit transcript/content → "Re-analyze" button
- Clears existing evidence and lens results
- Runs full pipeline again
- Updates all aggregations

### Schema Support

```sql
-- Soft deletion
ALTER TABLE interviews ADD COLUMN deleted_at timestamptz;

-- Visibility change tracking (for cleanup jobs)
ALTER TABLE interviews ADD COLUMN visibility_changed_at timestamptz;

-- Cleanup job status
ALTER TABLE interviews ADD COLUMN cleanup_status text;
-- Values: null (no cleanup needed), 'pending', 'in_progress', 'completed'

-- Index for efficient filtering
CREATE INDEX idx_interviews_not_deleted ON interviews (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_interviews_cleanup_pending ON interviews (id) WHERE cleanup_status = 'pending';
```

---

## UI Component Architecture

### Content-Type-Based View Routing

The interview detail page (`app/features/interviews/pages/detail.tsx`) uses a single loader but renders different view components based on content type:

```typescript
// Routing logic in detail.tsx
const is_note_type =
  interview?.source_type === "note" ||
  interview?.media_type === "note" ||
  interview?.media_type === "meeting_notes" ||
  interview?.media_type === "voice_memo"

const is_document_type =
  interview?.source_type === "document" ||
  interview?.media_type === "document"

// Component selection
if (is_note_type) {
  return <NoteViewer interview={interview} projectId={projectId} />
}
if (is_document_type) {
  return <DocumentViewer interview={interview} />
}
// Default: full interview detail with transcript, evidence, lenses
return <InterviewDetail ... />
```

### View Components

| Component | Content Types | Features |
|-----------|---------------|----------|
| **NoteViewer** | `voice_memo`, `note`, `meeting_notes` | Audio player, editable text, Apply Lenses button, lightweight UI |
| **DocumentViewer** | `document` | Document preview, file metadata |
| **InterviewDetail** | `audio`, `video`, `interview` | Transcript player, evidence list, lens tabs, participant management |

### NoteViewer Transcript Loading

NoteViewer fetches transcript data separately via useEffect to avoid bloating the main interview query (transcripts can be very large):

```typescript
// NoteViewer fetches transcript on mount
useEffect(() => {
  const fetchTranscript = async () => {
    if (interview.observations_and_notes) return; // Has notes, skip

    const { data } = await supabase
      .from("interviews")
      .select("transcript, transcript_formatted")
      .eq("id", interview.id)
      .single();

    setTranscript(data?.transcript || data?.transcript_formatted?.full_transcript);
  };
  fetchTranscript();
}, [interview.id]);
```

---

## Implementation Status

### Completed

- ✅ All content defaults to `lens_visibility = 'account'` (lenses applied)
- ✅ "Apply Lenses" button available on NoteViewer for voice memos/notes
- ✅ NoteViewer fetches and displays transcript for voice memos
- ✅ Removed auto-private trigger for voice memos

### Pending

- ⏳ LLM-determined `interaction_context` during evidence extraction
- ⏳ `personal-summary` lens template for voice memos
- ⏳ Content-type-based lens selection in `applyAllLenses.ts`
- ⏳ User override UI for interaction context

---

## Schema Changes Required

### interviews table updates

```sql
-- Interview mode (how the conversation happened)
ALTER TABLE interviews ADD COLUMN interview_mode text;
-- Values: 'live' | 'written' | 'chat' | 'imported'

-- Source channel (where content originated) - text field, not enum
-- Soft reference to integrations.slug when that table exists
ALTER TABLE interviews ADD COLUMN source_channel text DEFAULT 'app';

-- Link to integration sync record (for imported content)
ALTER TABLE interviews ADD COLUMN integration_sync_id uuid;
-- Will reference integration_sync_records(id) when integrations feature ships

-- Interaction context (what kind of conversation)
CREATE TYPE interaction_context AS ENUM ('research', 'sales', 'support', 'internal', 'personal');
ALTER TABLE interviews ADD COLUMN interaction_context interaction_context;

-- Default interaction_context based on media_type (can be overridden)
-- voice_memo → personal, interview → research (unless linked to opportunity → sales)

-- Explicit metadata (don't infer from type)
ALTER TABLE interviews ADD COLUMN has_media boolean DEFAULT false;
ALTER TABLE interviews ADD COLUMN has_timestamps boolean DEFAULT false;
ALTER TABLE interviews ADD COLUMN has_speakers boolean DEFAULT false;
ALTER TABLE interviews ADD COLUMN speaker_count integer;
ALTER TABLE interviews ADD COLUMN processing_version integer DEFAULT 1;

-- Soft deletion and cleanup
ALTER TABLE interviews ADD COLUMN deleted_at timestamptz;
ALTER TABLE interviews ADD COLUMN visibility_changed_at timestamptz;
ALTER TABLE interviews ADD COLUMN cleanup_status text;

-- Indexes
CREATE INDEX idx_interviews_not_deleted ON interviews (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_interviews_interaction_context ON interviews (interaction_context);
CREATE INDEX idx_interviews_cleanup_pending ON interviews (id) WHERE cleanup_status = 'pending';

-- REMOVE the auto-private trigger for voice memos
DROP TRIGGER IF EXISTS interview_lens_visibility_trigger ON interviews;
-- Or modify to only set private when explicitly requested
```

### New written_interviews table

```sql
CREATE TABLE written_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,

  -- Configuration
  response_mode text NOT NULL, -- 'form' | 'chat' | 'email'
  prompts jsonb NOT NULL,

  -- Participant
  participant_email text,
  participant_name text,
  share_token text UNIQUE NOT NULL,

  -- Status
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'submitted' | 'expired'
  submitted_at timestamptz,
  expires_at timestamptz,

  -- Link to created interview record
  interview_id uuid REFERENCES interviews(id),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE written_interview_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  written_interview_id uuid REFERENCES written_interviews(id) ON DELETE CASCADE,
  prompt_id text NOT NULL,
  question_text text NOT NULL, -- Denormalized for email matching
  response text NOT NULL,
  responded_at timestamptz DEFAULT now(),

  -- For chat mode follow-ups
  is_follow_up boolean DEFAULT false,
  parent_response_id uuid REFERENCES written_interview_responses(id)
);

-- Indexes
CREATE INDEX idx_written_interviews_share_token ON written_interviews (share_token);
CREATE INDEX idx_written_interviews_status ON written_interviews (status);
CREATE INDEX idx_written_interview_responses_interview ON written_interview_responses (written_interview_id);
```

### Update source_type enum

```sql
-- Add new source types for written interviews
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'form_response';
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'chat_transcript';
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'email_import';
```

---

## Summary

| Aspect | Current | Target |
|--------|---------|--------|
| Default processing | Varies by type | Always full analysis |
| Voice memos | Private, no lenses | Project visibility, full lenses |
| Lens visibility | Auto-set by capture type | User-controlled at creation |
| Content categorization | Conflated with capture | Separate `interaction_context` enum |
| Deletion | Hard delete | Soft delete + async cleanup cascade |
| Privacy changes | Immediate (incomplete) | Immediate hide + async cleanup |
| Re-analysis | Limited | Always available via UI |
| Written interviews | Not supported | Full support (form/chat/email) |
| CRM linking | Manual only | Auto-suggestion + manual |
| Internal discussions | Siloed | Flow to linked records |

### Quick Wins (Lowest-Change Path)

1. **Remove auto-private trigger** for voice memos - let `lens_visibility` default to 'account'
2. **Add `interaction_context` enum** (research/sales/support/internal) for lenses + dashboards
3. **Implement `deleted_at` + visibility flip** → immediate hide + async cleanup job
4. **Add "Apply Lenses" button** to NoteViewer for existing voice memos
5. **Document the rollup inclusion rule** (`project_id != null` → included in project rollups)
