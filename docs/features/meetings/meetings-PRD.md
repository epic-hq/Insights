# Recall.ai Desktop SDK Integration PRD

**Status:** Draft
**Author:** Cascade
**Date:** December 2024
**Confidence:** 88%

---

## 1. Executive Summary

Integrate Recall.ai's Desktop Recording SDK to automatically capture meeting recordings from Zoom, Google Meet, and Microsoft Teams. Recordings will be sent to our backend via webhook, triggering our existing Trigger.dev analysis pipeline to extract insights, evidence, and personas.

### Key Benefits
- **Zero-friction capture**: Automatic meeting detection and recording
- **Unified pipeline**: Leverage existing AssemblyAI transcription + BAML analysis
- **Future-ready**: Foundation for real-time in-meeting coaching

---

## 2. What Recall.ai Provides

### 2.1 Desktop SDK Capabilities

| Feature | Description |
|---------|-------------|
| **Meeting Detection** | Auto-detects Zoom, Google Meet, MS Teams meetings |
| **Recording** | Captures audio, video, and participant metadata |
| **Real-time Transcription** | Optional streaming transcription via webhooks |
| **Async Transcription** | Post-meeting transcription with higher accuracy |
| **Webhooks** | `sdk_upload.complete`, `transcript.done`, `transcript.data` |

### 2.2 Data Available After Call

From Recall.ai's API after `sdk_upload.complete`:

```json
{
  "id": "recording-uuid",
  "media_shortcuts": {
    "video_mixed": {
      "status": { "code": "done" },
      "data": { "download_url": "https://..." }
    },
    "transcript": {
      "status": { "code": "done" },
      "data": { "download_url": "https://..." }
    }
  }
}
```

**Transcript Format** (from `download_url`):
```json
[
  {
    "participant": {
      "id": 100,
      "name": "John Doe",
      "is_host": false,
      "platform": "desktop",
      "email": "john@example.com"
    },
    "words": [{
      "text": "Hello, this is my feedback about the product.",
      "start_timestamp": { "relative": 9.73, "absolute": "2025-07-17T00:00:09.730Z" },
      "end_timestamp": { "relative": 12.75, "absolute": "2025-07-17T00:00:12.751Z" }
    }]
  }
]
```

### 2.3 Mapping to Our Pipeline

| Recall.ai Format | Our Format (`speaker_utterances`) |
|------------------|-----------------------------------|
| `participant.name` | `speaker` |
| `words[].text` | `text` |
| `words[].start_timestamp.relative` | `start` (seconds) |
| `words[].end_timestamp.relative` | `end` (seconds) |

**Transformation required**: Recall groups by participant with multiple word blocks; AssemblyAI provides flat `utterances` array. We need a transformer function.

---

## 3. Architecture

### 3.1 High-Level Flow

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

### 3.2 Webhook Endpoint

**Route:** `POST /api/recall-webhook`

**Events to Handle:**
1. `sdk_upload.complete` - Recording finished, media available
2. `transcript.done` - Async transcription complete (if using Recall transcription)
3. `transcript.data` - Real-time transcription utterance (future: in-meeting coaching)

### 3.3 Trigger.dev Integration Point

**Option A: Skip Transcription Step (Recommended for v1)**
- Use Recall's async transcription
- Transform Recall transcript → our `speaker_utterances` format
- Enter pipeline at `extractEvidence` step

**Option B: Use AssemblyAI Transcription**
- Download media from Recall → Upload to R2
- Trigger existing `uploadAndTranscribe` task
- Full pipeline from start

**Recommendation:** Start with Option B for consistency with existing flow. Recall's transcription can be evaluated later for cost/quality tradeoffs.

---

## 4. Media Storage Strategy

### 4.1 Options Comparison

| Option | Pros | Cons |
|--------|------|------|
| **Use Recall's hosted URLs** | No storage cost, simpler | URLs expire, dependency on Recall |
| **Download to R2** | Full control, permanent, works with existing pipeline | Storage cost, download time |

### 4.2 Recommendation: Download to R2

**Rationale:**
1. **Consistency**: Existing pipeline expects R2 keys for media
2. **Permanence**: Recall URLs may expire; R2 gives us control
3. **Evidence clips**: Our Reels feature needs direct R2 access for FFmpeg processing
4. **Offline access**: Users can replay interviews without Recall dependency

**Implementation:**
```typescript
// In webhook handler
const mediaUrl = await downloadRecallMediaToR2({
  recallDownloadUrl: webhook.data.media_shortcuts.video_mixed.data.download_url,
  accountId,
  projectId,
  recordingId: webhook.data.id,
})
// Returns: "media/{accountId}/{projectId}/{recordingId}.mp4"
```

---

## 5. Implementation Plan

### Phase 1: Webhook Endpoint (Day 1)

**File:** `app/routes/api.recall-webhook.tsx`

```typescript
// Webhook payload types
interface RecallWebhookPayload {
  event: 'sdk_upload.complete' | 'transcript.done' | 'transcript.data'
  data: {
    id: string // recording_id
    media_shortcuts?: {
      video_mixed?: { status: { code: string }, data: { download_url: string } }
      transcript?: { status: { code: string }, data: { download_url: string } }
    }
    // For transcript.data events
    words?: Array<{ text: string, start_timestamp: { relative: number } }>
    participant?: { id: number, name: string, email?: string }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // 1. Verify webhook signature (Recall uses HMAC)
  // 2. Parse event type
  // 3. For sdk_upload.complete:
  //    - Download media to R2
  //    - Create interview record
  //    - Trigger orchestrator
  // 4. Return 200 quickly
}
```

### Phase 2: Media Download Utility (Day 1)

**File:** `app/utils/recall.server.ts`

```typescript
export async function downloadRecallMediaToR2(opts: {
  downloadUrl: string
  accountId: string
  projectId: string
  recordingId: string
}): Promise<string> {
  // 1. Fetch from Recall download URL
  // 2. Stream to R2 with key: media/{accountId}/{projectId}/{recordingId}.mp4
  // 3. Return R2 key
}

export function transformRecallTranscript(
  recallTranscript: RecallTranscriptEntry[]
): SpeakerUtterance[] {
  // Transform Recall's grouped format to flat utterances
  return recallTranscript.flatMap(entry =>
    entry.words.map(word => ({
      speaker: entry.participant.name || `Speaker ${entry.participant.id}`,
      text: word.text,
      start: word.start_timestamp.relative,
      end: word.end_timestamp?.relative ?? word.start_timestamp.relative + 1,
    }))
  )
}
```

### Phase 3: Trigger.dev Task (Day 2)

**File:** `src/trigger/meeting/processRecallMeeting.ts`

```typescript
export const processRecallMeetingTask = task({
  id: "meeting.process-recall-meeting",
  retry: workflowRetryConfig,
  run: async (payload: {
    recordingId: string
    accountId: string
    projectId: string
    mediaR2Key: string
    recallTranscriptUrl?: string
  }) => {
    // Option A: Use Recall transcript
    if (payload.recallTranscriptUrl) {
      const transcript = await fetchRecallTranscript(payload.recallTranscriptUrl)
      const utterances = transformRecallTranscript(transcript)
      // Skip to evidence extraction
    }

    // Option B: Use AssemblyAI
    const result = await uploadAndTranscribeTaskV2.triggerAndWait({
      metadata: { accountId, projectId },
      mediaUrl: payload.mediaR2Key,
      transcriptData: { needs_transcription: true },
    })

    // Continue with existing pipeline...
  }
})
```

### Phase 4: User Association (Day 2)

**Challenge:** Link Recall recordings to correct account/project.

**Solutions:**
1. **Metadata in SDK**: Pass `account_id` and `project_id` when creating upload token
2. **User mapping table**: Map Recall user IDs to our user IDs
3. **Email matching**: Match participant emails to existing people records

**Recommended:** Use metadata approach - cleanest and most explicit.

```typescript
// Backend endpoint called by desktop app
POST /api/recall/create-upload-token
{
  "account_id": "uuid",
  "project_id": "uuid"
}
// Returns upload token with metadata embedded
```

---

## 6. Gotchas & Edge Cases

### 6.1 Known Issues

| Issue | Mitigation |
|-------|------------|
| **Webhook delivery failures** | Implement idempotency keys, retry logic |
| **Large file downloads** | Stream to R2, don't buffer in memory |
| **Recall URL expiration** | Download immediately on webhook receipt |
| **Duplicate webhooks** | Use recording_id as idempotency key |
| **Missing participant names** | Fallback to "Speaker 1", "Speaker 2" |
| **Platform language support** | Recall SDK supports Windows + Apple Silicon only |

### 6.2 Security Considerations

- **Webhook verification**: Validate HMAC signature from Recall
- **API key storage**: Store Recall API key in environment variables
- **User authorization**: Verify user has access to target project before creating upload token

### 6.3 Rate Limits

- Recall API: Check their docs for rate limits
- AssemblyAI: 100 concurrent transcriptions (our existing limit)
- R2: No practical limits for our scale

---

## 7. Real-Time Features (Future)

### 7.1 In-Meeting Coaching Vision

Using `transcript.data` real-time webhooks, we can provide:

| Feature | Trigger Point | Value |
|---------|---------------|-------|
| **Talk time balance** | Every 5 minutes | "You've spoken 70% of the time" |
| **Question prompts** | 50% mark | "Consider asking about pain points" |
| **Key topic alerts** | When detected | "Competitor mentioned - probe deeper" |
| **Wrap-up reminder** | 75% mark | "5 mins left - cover pricing" |
| **Summary preview** | End of call | "3 key insights captured" |

### 7.2 Real-Time Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Recall SDK     │     │  Webhook Handler │     │  WebSocket      │
│  transcript.data│────▶│  /api/recall-rt  │────▶│  to Desktop App │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Redis/KV Store  │
                        │  (meeting state) │
                        └──────────────────┘
```

### 7.3 Meeting State Tracking

```typescript
interface MeetingState {
  recordingId: string
  startTime: Date
  participants: Map<number, { name: string, talkTimeMs: number }>
  utteranceCount: number
  topicsDetected: string[]
  checkpointsSent: ('50%' | '75%' | 'wrap-up')[]
}
```

### 7.4 Checkpoint Logic

```typescript
// Pseudo-code for checkpoint triggers
function onTranscriptData(event: TranscriptDataEvent, state: MeetingState) {
  const elapsedMs = Date.now() - state.startTime.getTime()
  const estimatedDuration = 30 * 60 * 1000 // 30 min default
  const progress = elapsedMs / estimatedDuration

  // 50% checkpoint
  if (progress >= 0.5 && !state.checkpointsSent.includes('50%')) {
    sendCoachingTip(state.recordingId, {
      type: 'midpoint',
      message: generateMidpointAdvice(state),
    })
    state.checkpointsSent.push('50%')
  }

  // 75% checkpoint
  if (progress >= 0.75 && !state.checkpointsSent.includes('75%')) {
    sendCoachingTip(state.recordingId, {
      type: 'wrap-up-warning',
      message: 'Consider wrapping up key topics',
    })
    state.checkpointsSent.push('75%')
  }

  // Track talk time per participant
  updateTalkTime(state, event.participant, event.words)
}
```

### 7.5 Analytics Ideas

| Metric | Calculation | Display |
|--------|-------------|---------|
| **Talk ratio** | `speakerTime / totalTime` | Pie chart per participant |
| **Question density** | `questions / totalUtterances` | "You asked 12 questions" |
| **Interruption count** | Overlapping timestamps | "3 interruptions detected" |
| **Topic coverage** | Keywords vs. agenda | Checklist completion |
| **Engagement score** | Response latency + length | 1-10 scale |

---

## 8. Database Schema Changes

### 8.1 New Table: `meeting_recordings`

```sql
CREATE TABLE meeting_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  project_id UUID NOT NULL REFERENCES projects(id),

  -- Recall.ai identifiers
  recall_recording_id TEXT UNIQUE NOT NULL,
  recall_upload_id TEXT,

  -- Meeting metadata
  platform TEXT, -- 'zoom', 'google_meet', 'teams'
  meeting_title TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER,

  -- Participants (JSONB for flexibility)
  participants JSONB DEFAULT '[]',

  -- Media references
  media_r2_key TEXT,
  transcript_r2_key TEXT,

  -- Processing state
  status TEXT DEFAULT 'pending', -- pending, processing, completed, error
  interview_id UUID REFERENCES interviews(id), -- Link to created interview

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their account's recordings"
  ON meeting_recordings FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_user WHERE user_id = auth.uid()));
```

### 8.2 Interviews Table Updates

Add source tracking:

```sql
ALTER TABLE interviews
  ADD COLUMN source_type TEXT DEFAULT 'upload', -- 'upload', 'recall', 'import'
  ADD COLUMN source_reference_id UUID; -- References meeting_recordings.id for Recall
```

---

## 9. Environment Variables

```bash
# Recall.ai Configuration
RECALL_API_KEY=your-recall-api-key
RECALL_API_URL=https://us-west-2.recall.ai
RECALL_WEBHOOK_SECRET=your-webhook-signing-secret

# Feature flags
ENABLE_RECALL_INTEGRATION=true
ENABLE_REALTIME_COACHING=false  # Future feature
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Transcript transformation function
- Webhook signature verification
- Media download streaming

### 10.2 Integration Tests

- End-to-end webhook → R2 → Trigger.dev flow
- Idempotency handling
- Error recovery

### 10.3 Manual Testing

1. Install Recall sample app
2. Join test meeting
3. Verify webhook received
4. Confirm interview created in app
5. Validate transcript quality

---

## 11. Rollout Plan

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Alpha** | Internal team only | Week 1 |
| **Beta** | 5 pilot customers | Week 2-3 |
| **GA** | All customers | Week 4+ |

### Success Metrics

- Webhook success rate > 99%
- Media download success rate > 99%
- Transcript quality parity with manual uploads
- User activation rate (% who record first meeting)

---

## 12. Open Questions

1. **Pricing model**: How does Recall charge? Per recording? Per minute?
2. **Desktop app distribution**: Do we build our own Electron app or use Recall's sample?
3. **Calendar integration**: Should we auto-schedule recordings based on calendar?
4. **Multi-project routing**: How do users select which project to record to?

---

## 13. References

- [Recall.ai Desktop SDK Docs](https://docs.recall.ai/docs/desktop-sdk)
- [Recall.ai Webhooks Overview](https://docs.recall.ai/reference/webhooks-overview)
- [Recall.ai Transcription Docs](https://docs.recall.ai/docs/recallai-transcription)
- [Recall.ai Real-time Transcription](https://docs.recall.ai/docs/bot-real-time-transcription)
- [Sample Desktop App (Muesli)](https://github.com/recallai/muesli-public)
