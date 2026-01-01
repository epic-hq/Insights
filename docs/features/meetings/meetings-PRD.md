# Recall.ai Desktop SDK Integration PRD

**Status:** Draft
**Author:** Cascade
**Date:** December 27, 2025 v2
**Confidence:** 88%

---

## 1. Executive Summary

Integrate Recall.ai's Desktop Recording SDK to automatically capture meeting recordings from Zoom, Google Meet, and Microsoft Teams. Recordings will be sent to our backend via webhook, triggering our existing Trigger.dev analysis pipeline to extract insights, evidence, and personas.

### Key Benefits

- **Zero-friction capture**: Automatic meeting detection and recording
- **Unified pipeline**: Leverage existing AssemblyAI transcription + BAML analysis
- **Future-ready**: Foundation for real-time in-meeting coaching

## Priority Recommendation (Dec 2025)

This feature is best positioned as the primary answer to “capture real meetings” (Zoom/Meet/Teams) because our in-browser realtime capture is not reliable enough to capture full meeting audio + metadata.

- **Recommended priority**: **P1** if meetings are a top acquisition/retention lever.
- **If adoption friction is expected** (e.g., users unwilling to install a desktop app), treat Desktop SDK as P2 and prioritize a bot-based approach instead.

## Platform Constraints & Alternatives

### Desktop Recording SDK Constraints

Per Recall’s Desktop SDK docs, this integration is designed for an **Electron desktop app** and has OS support limitations (notably Apple Silicon Macs + Windows).

### Alternative: Recall.ai Meeting Bot API

If Desktop SDK adoption is blocked (enterprise policies, install friction, unsupported OS), the bot approach becomes the fallback:

- **Pros**: No desktop distribution; centrally managed; can pair well with calendar-driven auto-join.
- **Cons**: Bot acceptance risk; meeting policies can block bots; “extra attendee” UX cost.

### Mobile

Recall positions a **Mobile Recording SDK** as “coming soon”. Until that is available and validated, the practical mobile v1 is:

- Use our existing upload pipeline for **mobile voice memos** (record audio on phone, upload for transcription + analysis).

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

### 2.3 Speaker Names & Participant Metadata

**How Recall.ai Provides Speaker Names:**

Recall.ai automatically detects and labels speaker names from the meeting platform (Zoom, Google Meet, Teams). Each participant in the transcript includes:

```typescript
{
  "participant": {
    "id": 100,                    // Unique participant ID
    "name": "John Doe",           // Display name from meeting platform
    "is_host": false,             // Host status
    "platform": "desktop",        // Platform type
    "email": "john@example.com",  // Email (if available from platform)
    "extra_data": null            // Additional platform-specific metadata
  },
  "words": [...]
}
```

**Key Points:**
- Speaker names are automatically extracted from meeting platform metadata
- Email addresses included when available (useful for linking to existing `people` records)
- `participant.id` is consistent across all utterances for the same speaker
- No manual speaker identification required

### 2.4 Mapping to Our Pipeline

| Recall.ai Format | Our Format (`speaker_utterances`) | Notes |
|------------------|-----------------------------------|-------|
| `participant.name` | `speaker` | Use as display name |
| `participant.email` | Link to `people.primary_email` | For matching existing people |
| `participant.id` | Track speaker consistency | Same ID = same speaker |
| `words[].text` | `text` | Utterance text |
| `words[].start_timestamp.relative` | `start` (seconds) | Start time |
| `words[].end_timestamp.relative` | `end` (seconds) | End time |

**Transformation required**: Recall groups by participant with multiple word blocks; AssemblyAI provides flat `utterances` array. We need a transformer function.

**Person Matching Strategy:**
1. **Email match**: If `participant.email` exists, match to existing `people` record by `primary_email`
2. **Name match**: Fuzzy match on `participant.name` within same project
3. **Create new**: If no match, create new person with name and email from participant metadata

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

export async function extractParticipantsFromTranscript(
  recallTranscript: RecallTranscriptEntry[]
): Promise<ParticipantMetadata[]> {
  // Extract unique participants with their metadata
  const participantMap = new Map<number, ParticipantMetadata>()

  for (const entry of recallTranscript) {
    if (!participantMap.has(entry.participant.id)) {
      participantMap.set(entry.participant.id, {
        recall_participant_id: entry.participant.id,
        name: entry.participant.name,
        email: entry.participant.email || null,
        is_host: entry.participant.is_host,
        platform: entry.participant.platform,
      })
    }
  }

  return Array.from(participantMap.values())
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

### Phase 4: Desktop App API Endpoints (Day 2-3)

**Challenge:** Desktop app needs secure API access for authentication, context selection, and interview management.

#### 4.1 Authentication

**Endpoint:** `POST /api/desktop/auth`

```typescript
// Request
{
  "email": "user@example.com",
  "password": "secure_password"
}

// Response
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_jwt",
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Alternative: OAuth Flow**
- Desktop app opens browser to `/auth/desktop-callback`
- User authenticates via web UI
- Redirect back to desktop app with auth code
- Exchange code for tokens

#### 4.2 Get User Accounts & Projects

**Endpoint:** `GET /api/desktop/context`

```typescript
// Headers: Authorization: Bearer {access_token}

// Response
{
  "accounts": [
    {
      "id": "account_uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "projects": [
        {
          "id": "project_uuid",
          "name": "Q1 Customer Discovery",
          "slug": "q1-discovery",
          "is_default": true
        }
      ]
    }
  ],
  "default_account_id": "account_uuid",
  "default_project_id": "project_uuid"
}
```

**Purpose:**
- Desktop app shows account/project selector
- Caches context for subsequent API calls
- Allows user to switch projects without re-auth

#### 4.3 Create Recall Upload Token

**Endpoint:** `POST /api/desktop/recall-token`

```typescript
// Request
{
  "account_id": "account_uuid",
  "project_id": "project_uuid"
}

// Response
{
  "upload_token": "recall_upload_token",
  "expires_at": "2025-12-27T23:59:59Z",
  "metadata": {
    "account_id": "account_uuid",
    "project_id": "project_uuid",
    "user_id": "user_uuid"
  }
}
```

**Purpose:** Generate Recall.ai upload token with embedded metadata for webhook routing

#### 4.4 List Interviews

**Endpoint:** `GET /api/desktop/interviews?account_id={id}&project_id={id}&limit=20&offset=0`

```typescript
// Response
{
  "interviews": [
    {
      "id": "interview_uuid",
      "title": "Customer Interview - John Doe",
      "created_at": "2025-12-27T10:00:00Z",
      "source_type": "recall",
      "meeting_platform": "zoom",
      "status": "completed",
      "duration_sec": 1800,
      "participant_count": 2,
      "evidence_count": 15,
      "media_url": "https://r2.../media.mp4" // Presigned URL
    }
  ],
  "total": 42,
  "has_more": true
}
```

**Purpose:** Show recent interviews in desktop app, allow playback/review

#### 4.5 Get Interview Detail

**Endpoint:** `GET /api/desktop/interviews/{interview_id}?account_id={id}&project_id={id}`

```typescript
// Response
{
  "id": "interview_uuid",
  "title": "Customer Interview - John Doe",
  "created_at": "2025-12-27T10:00:00Z",
  "source_type": "recall",
  "meeting_platform": "zoom",
  "recall_recording_id": "recall_uuid",
  "status": "completed",
  "media_r2_key": "media/account/project/recording.mp4",
  "media_url": "https://r2.../media.mp4", // Presigned URL, 1hr expiry
  "transcript": {
    "full_transcript": "...",
    "speaker_utterances": [...]
  },
  "participants": [
    {
      "person_id": "person_uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "participant"
    }
  ],
  "evidence_count": 15,
  "themes": ["pricing concerns", "feature requests"]
}
```

#### 4.6 Update Interview Metadata

**Endpoint:** `PATCH /api/desktop/interviews/{interview_id}`

```typescript
// Request
{
  "account_id": "account_uuid",
  "project_id": "project_uuid",
  "title": "Updated Interview Title",
  "notes": "Additional context about this interview"
}

// Response
{
  "success": true,
  "interview": { /* updated interview object */ }
}
```

**Purpose:** Allow desktop app to update interview titles, add notes post-recording

#### 4.7 Get Recording Status

**Endpoint:** `GET /api/desktop/recordings/{recall_recording_id}/status?account_id={id}`

```typescript
// Response
{
  "recall_recording_id": "recall_uuid",
  "status": "processing", // pending, processing, completed, error
  "interview_id": "interview_uuid", // null if not yet created
  "progress": {
    "media_downloaded": true,
    "transcript_complete": true,
    "evidence_extracted": false,
    "themes_linked": false
  },
  "estimated_completion": "2025-12-27T10:15:00Z"
}
```

**Purpose:** Desktop app polls this to show processing progress after recording ends

#### 4.8 Health Check

**Endpoint:** `GET /api/desktop/health`

```typescript
// Response
{
  "status": "healthy",
  "version": "1.0.0",
  "features": {
    "recall_integration": true,
    "real_time_coaching": false
  }
}
```

**Purpose:** Desktop app checks API availability and feature flags

---

### 4.9 Security Considerations

**Authentication:**
- All endpoints require `Authorization: Bearer {jwt_token}` header
- Tokens expire after 24 hours, refresh tokens valid for 30 days
- Desktop app stores tokens in OS-secure keychain (macOS Keychain, Windows Credential Manager)

**Rate Limiting:**
- 100 requests per minute per user
- 10 upload token requests per hour per user
- Webhook endpoints excluded from rate limits

**CORS:**
- Desktop app uses `electron://` or `file://` protocol
- Backend allows `Origin: electron://app` for Electron apps
- No CORS for native desktop apps (direct HTTP)

**Data Scoping:**
- All endpoints require `account_id` and `project_id` parameters
- Backend validates user has access to requested account/project via RLS
- Presigned media URLs expire after 1 hour

---

## 6. Desktop App Integration Guide

### 6.1 Complete Upload & Processing Flow

**Overview:** Desktop app uses Recall.ai SDK to capture meetings, then our backend processes them via webhooks and Trigger.dev tasks.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Desktop App Flow                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User authenticates → Get JWT token                               │
│ 2. User selects account/project → Cache context                     │
│ 3. User starts meeting → Request upload token from backend          │
│ 4. Desktop SDK captures meeting → Uploads to Recall.ai              │
│ 5. Recall.ai sends webhook → Backend processes automatically        │
│ 6. Desktop app polls status → Shows progress to user                │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Step-by-Step Implementation

#### Step 1: Authentication

```typescript
// Desktop app: Authenticate user
const response = await fetch('https://api.yourdomain.com/api/desktop/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    password: userPassword
  })
})

const { access_token, refresh_token, user } = await response.json()

// Store tokens securely in OS keychain
await secureStore.set('access_token', access_token)
await secureStore.set('refresh_token', refresh_token)
```

#### Step 2: Get User Context

```typescript
// Desktop app: Fetch accounts and projects
const response = await fetch('https://api.yourdomain.com/api/desktop/context', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
})

const { accounts, default_account_id, default_project_id } = await response.json()

// Show account/project selector UI
// User selects or uses defaults
const selectedAccountId = default_account_id
const selectedProjectId = default_project_id
```

#### Step 3: Request Recall Upload Token

```typescript
// Desktop app: Get upload token before starting recording
const response = await fetch('https://api.yourdomain.com/api/desktop/recall-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    account_id: selectedAccountId,
    project_id: selectedProjectId
  })
})

const { upload_token, expires_at, metadata } = await response.json()

// Store for SDK initialization
const recallUploadToken = upload_token
```

#### Step 4: Initialize Recall SDK & Start Recording

```typescript
// Desktop app: Initialize Recall.ai Desktop SDK
import { RecallSDK } from '@recall.ai/desktop-sdk'

const sdk = new RecallSDK({
  apiKey: process.env.RECALL_API_KEY // Your Recall.ai API key
})

// Start SDK and listen for meetings
await sdk.start()

sdk.on('meeting.detected', async (meeting) => {
  console.log('Meeting detected:', meeting.platform) // 'zoom', 'google_meet', 'teams'

  // Start recording with our upload token
  const recording = await sdk.startRecording({
    uploadToken: recallUploadToken, // Token from Step 3
    transcription: {
      provider: 'recallai_streaming', // Use Recall's transcription
      realTime: true // Enable real-time transcription
    },
    media: {
      captureVideo: true,
      captureAudio: true,
      captureScreenShare: true
    }
  })

  // Store recording ID for status polling
  const recallRecordingId = recording.id
  await localDB.set('current_recording_id', recallRecordingId)

  // Show recording indicator in UI
  showRecordingIndicator(meeting.platform)
})

sdk.on('recording.complete', async (recording) => {
  console.log('Recording complete:', recording.id)

  // Start polling for processing status
  startStatusPolling(recording.id)
})
```

#### Step 5: Backend Webhook Processing (Automatic)

**Backend automatically receives webhook from Recall.ai:**

```typescript
// Backend: app/routes/api.recall-webhook.tsx
export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.json()

  // Verify webhook signature
  const signature = request.headers.get('X-Recall-Signature')
  if (!verifyRecallSignature(payload, signature)) {
    return json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (payload.event === 'sdk_upload.complete') {
    const { id: recordingId, metadata, media_shortcuts } = payload.data

    // Extract account/project from upload token metadata
    const { account_id, project_id, user_id } = metadata

    // Download media from Recall to R2
    const mediaR2Key = await downloadRecallMediaToR2({
      downloadUrl: media_shortcuts.video_mixed.data.download_url,
      accountId: account_id,
      projectId: project_id,
      recordingId: recordingId
    })

    // Download transcript if available
    let transcript = null
    if (media_shortcuts.transcript?.data?.download_url) {
      const transcriptData = await fetch(media_shortcuts.transcript.data.download_url)
      transcript = await transcriptData.json()
    }

    // Create interview record
    const interview = await createInterview({
      account_id,
      project_id,
      source_type: 'recall',
      meeting_platform: payload.data.platform, // 'zoom', 'google_meet', 'teams'
      recall_recording_id: recordingId,
      media_r2_key: mediaR2Key,
      status: 'processing'
    })

    // Trigger processing pipeline
    await processRecallMeetingTask.trigger({
      interviewId: interview.id,
      accountId: account_id,
      projectId: project_id,
      recallRecordingId: recordingId,
      mediaR2Key: mediaR2Key,
      recallTranscript: transcript,
      participants: extractParticipantsFromTranscript(transcript)
    })

    return json({ success: true, interview_id: interview.id })
  }

  return json({ success: true })
}
```

#### Step 6: Poll Processing Status

```typescript
// Desktop app: Poll for processing status
async function startStatusPolling(recallRecordingId: string) {
  const pollInterval = setInterval(async () => {
    const response = await fetch(
      `https://api.yourdomain.com/api/desktop/recordings/${recallRecordingId}/status?account_id=${selectedAccountId}`,
      {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }
    )

    const status = await response.json()

    // Update UI with progress
    updateProgressUI({
      status: status.status, // 'pending', 'processing', 'completed', 'error'
      progress: status.progress,
      interviewId: status.interview_id
    })

    if (status.status === 'completed') {
      clearInterval(pollInterval)

      // Show success notification
      showNotification('Interview processed successfully!')

      // Optionally fetch full interview details
      const interview = await fetchInterviewDetail(status.interview_id)
      showInterviewDetail(interview)
    }

    if (status.status === 'error') {
      clearInterval(pollInterval)
      showError('Processing failed. Please try again.')
    }
  }, 5000) // Poll every 5 seconds
}
```

### 6.3 Trigger.dev Task Flow

**Backend processing task:**

```typescript
// Backend: src/trigger/meeting/processRecallMeeting.ts
import { task } from "@trigger.dev/sdk"

export const processRecallMeetingTask = task({
  id: "meeting.process-recall-meeting",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000
  },
  run: async (payload: {
    interviewId: string
    accountId: string
    projectId: string
    recallRecordingId: string
    mediaR2Key: string
    recallTranscript: RecallTranscriptEntry[]
    participants: ParticipantMetadata[]
  }) => {
    // 1. Transform Recall transcript to our format
    const utterances = transformRecallTranscript(payload.recallTranscript)

    // 2. Match or create people records
    const peopleIds = await matchOrCreatePeople({
      participants: payload.participants,
      accountId: payload.accountId,
      projectId: payload.projectId
    })

    // 3. Update interview with transcript and people
    await updateInterview({
      id: payload.interviewId,
      full_transcript: utterances.map(u => u.text).join(' '),
      speaker_utterances: utterances,
      status: 'transcribed'
    })

    await linkInterviewPeople({
      interviewId: payload.interviewId,
      peopleIds: peopleIds
    })

    // 4. Extract evidence using existing pipeline
    const evidenceResult = await extractEvidenceTask.triggerAndWait({
      interviewId: payload.interviewId,
      accountId: payload.accountId,
      projectId: payload.projectId,
      utterances: utterances
    })

    // 5. Link evidence to themes
    if (evidenceResult.ok) {
      await linkEvidenceToThemesTask.triggerAndWait({
        interviewId: payload.interviewId,
        accountId: payload.accountId,
        projectId: payload.projectId,
        evidenceIds: evidenceResult.output.evidenceIds
      })
    }

    // 6. Mark interview as completed
    await updateInterview({
      id: payload.interviewId,
      status: 'completed',
      processed_at: new Date()
    })

    return {
      success: true,
      interviewId: payload.interviewId,
      evidenceCount: evidenceResult.ok ? evidenceResult.output.evidenceIds.length : 0
    }
  }
})
```

### 6.4 Environment Variables Required

**Desktop App:**
```bash
# .env
RECALL_API_KEY=your_recall_api_key
BACKEND_API_URL=https://api.yourdomain.com
```

**Backend:**
```bash
# .env
RECALL_API_KEY=your_recall_api_key
RECALL_WEBHOOK_SECRET=your_webhook_secret
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
TRIGGER_SECRET_KEY=your_trigger_dev_key
```

### 6.5 Error Handling & Retry Logic

**Desktop App:**
- Network errors: Retry with exponential backoff
- Token expiration: Refresh token automatically
- Recording failures: Show error, allow retry
- Status polling timeout: Stop after 10 minutes, show manual refresh option

**Backend:**
- Webhook signature validation: Reject invalid requests
- Media download failures: Retry 3 times with Trigger.dev
- Transcript parsing errors: Log and continue with empty transcript
- Evidence extraction failures: Mark interview as "partial" but don't fail

### 6.6 Testing Checklist

**Desktop App:**
- [ ] Authentication flow works
- [ ] Account/project selection persists
- [ ] Upload token request succeeds
- [ ] Recall SDK detects meetings (Zoom, Meet, Teams)
- [ ] Recording starts with correct metadata
- [ ] Status polling shows progress
- [ ] Completed interviews appear in list
- [ ] Error states display properly

**Backend:**
- [ ] Webhook endpoint receives Recall events
- [ ] Signature verification works
- [ ] Media downloads to R2 successfully
- [ ] Transcript transforms correctly
- [ ] People matching/creation works
- [ ] Trigger.dev tasks execute
- [ ] Evidence extraction completes
- [ ] Interview status updates properly

---

## 7. Gotchas & Edge Cases

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

### 8.1 Extend Interviews Table

**Rationale:** Use existing `interviews` table instead of creating a separate `meeting_recordings` table. This:
- Leverages existing pipeline, evidence extraction, and UI
- Avoids data duplication and sync issues
- Enables conversation lenses for analytics (talk ratio, question density, etc.)
- Simplifies architecture and reduces maintenance burden

**Schema Updates:**

```sql
-- Add meeting platform tracking
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT; -- 'zoom', 'google_meet', 'teams', null for non-meeting sources

-- Add Recall.ai reference for idempotency and debugging
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS recall_recording_id TEXT UNIQUE; -- Recall's recording ID for deduplication

-- Existing source_type already supports this:
-- source_type: 'upload', 'recall', 'note', 'survey_response', 'public_chat'
```

**Notes:**
- `source_type = 'recall'` identifies Recall.ai meetings
- `meeting_platform` distinguishes Zoom vs Meet vs Teams
- `recall_recording_id` prevents duplicate processing if webhook fires twice
- All other fields (media_r2_key, transcript, participants via interview_people) already exist

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
