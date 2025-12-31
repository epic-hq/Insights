# Backend API Specification for Desktop App Integration

## Overview

This document specifies the exact API endpoints required on the UpSight backend (getupsight.com) to support the desktop app. All endpoints are under `/api/desktop/*` except the webhook which is `/api/recall-webhook`.

**Base URL:** `https://getupsight.com`

**Authentication:** All `/api/desktop/*` endpoints require `Authorization: Bearer {access_token}` header (Supabase JWT)

---

## 1. GET /api/desktop/context

**Purpose:** Get the authenticated user's available accounts and projects, plus defaults.

**Called when:** App starts after successful authentication.

### Request

```http
GET /api/desktop/context HTTP/1.1
Host: getupsight.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response (200 OK)

```json
{
  "accounts": [
    {
      "id": "acc_uuid_1234",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "projects": [
        {
          "id": "proj_uuid_5678",
          "name": "Q1 Customer Discovery",
          "slug": "q1-discovery",
          "is_default": true
        },
        {
          "id": "proj_uuid_9012",
          "name": "Product Feedback",
          "slug": "product-feedback",
          "is_default": false
        }
      ]
    }
  ],
  "default_account_id": "acc_uuid_1234",
  "default_project_id": "proj_uuid_5678"
}
```

### Response (401 Unauthorized)

```json
{
  "error": "Invalid or expired token"
}
```

### Implementation Notes

- Query `account_memberships` joined with `accounts` and `projects`
- Filter by authenticated user's `auth.uid()`
- Use RLS policies to ensure user only sees their accounts
- Default project can be stored in user preferences or use most recently accessed

---

## 2. POST /api/desktop/recall-token

**Purpose:** Generate a Recall.ai upload token with embedded metadata for webhook routing.

**Called when:** Recording starts (before `RecallAiSdk.startRecording()`).

### Request

```http
POST /api/desktop/recall-token HTTP/1.1
Host: getupsight.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "account_id": "acc_uuid_1234",
  "project_id": "proj_uuid_5678"
}
```

### Response (200 OK)

```json
{
  "upload_token": "recall_upload_token_abc123...",
  "expires_at": "2025-12-28T23:59:59Z",
  "metadata": {
    "account_id": "acc_uuid_1234",
    "project_id": "proj_uuid_5678",
    "user_id": "user_uuid_abcd"
  }
}
```

### Response (403 Forbidden)

```json
{
  "error": "User does not have access to this account/project"
}
```

### Implementation Notes

- Verify user has access to the specified account/project
- Call Recall.ai API to generate upload token:
  ```typescript
  const response = await fetch('https://us-west-2.recall.ai/api/v1/desktop-sdk-uploads/', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.RECALL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata: {
        account_id: accountId,
        project_id: projectId,
        user_id: userId,
      }
    })
  });
  ```
- Store the upload token ID in database for idempotency tracking
- Token typically expires in 24 hours

---

## 3. POST /api/recall-webhook

**Purpose:** Receive webhook events from Recall.ai after recording upload completes.

**Called by:** Recall.ai servers (not the desktop app).

### Webhook Configuration

Configure in Recall.ai dashboard:
- **URL:** `https://getupsight.com/api/recall-webhook`
- **Secret:** Store as `RECALL_WEBHOOK_SECRET` env var
- **Events:** `sdk_upload.complete`, `transcript.done`

### Request (sdk_upload.complete)

```http
POST /api/recall-webhook HTTP/1.1
Host: getupsight.com
Content-Type: application/json
X-Recall-Signature: sha256=abc123...

{
  "event": "sdk_upload.complete",
  "data": {
    "id": "recording_uuid",
    "metadata": {
      "account_id": "acc_uuid_1234",
      "project_id": "proj_uuid_5678",
      "user_id": "user_uuid_abcd"
    },
    "media_shortcuts": {
      "video_mixed": {
        "status": { "code": "done" },
        "data": { "download_url": "https://recall.ai/download/video..." }
      },
      "transcript": {
        "status": { "code": "done" },
        "data": { "download_url": "https://recall.ai/download/transcript..." }
      }
    },
    "meeting": {
      "platform": "google_meet",
      "title": "Weekly Sync",
      "start_time": "2025-12-28T10:00:00Z",
      "end_time": "2025-12-28T10:45:00Z",
      "participants": [
        { "id": 1, "name": "John Doe", "email": "john@example.com" },
        { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
      ]
    }
  }
}
```

### Response (200 OK)

```json
{
  "received": true,
  "interview_id": "interview_uuid"
}
```

### Webhook Signature Verification

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
}
```

### Webhook Handler Implementation

```typescript
export async function action({ request }: ActionFunctionArgs) {
  // 1. Verify signature
  const signature = request.headers.get('X-Recall-Signature');
  const payload = await request.text();

  if (!verifyWebhookSignature(payload, signature, process.env.RECALL_WEBHOOK_SECRET)) {
    return json({ error: 'Invalid signature' }, { status: 401 });
  }

  const webhook = JSON.parse(payload);

  // 2. Handle sdk_upload.complete
  if (webhook.event === 'sdk_upload.complete') {
    const { id: recordingId, metadata, media_shortcuts, meeting } = webhook.data;
    const { account_id, project_id, user_id } = metadata;

    // 3. Check for duplicate (idempotency)
    const existing = await db.interview.findFirst({
      where: { recall_recording_id: recordingId }
    });
    if (existing) {
      return json({ received: true, interview_id: existing.id });
    }

    // 4. Download media to R2
    const mediaR2Key = await downloadToR2({
      url: media_shortcuts.video_mixed.data.download_url,
      key: `media/${account_id}/${project_id}/${recordingId}.mp4`
    });

    // 5. Download transcript
    const transcriptUrl = media_shortcuts.transcript?.data?.download_url;

    // 6. Create interview record
    const interview = await db.interview.create({
      data: {
        account_id,
        project_id,
        user_id,
        recall_recording_id: recordingId,
        media_r2_key: mediaR2Key,
        source_type: 'recall',
        meeting_platform: meeting?.platform,
        title: meeting?.title || 'Untitled Meeting',
        status: 'processing',
      }
    });

    // 7. Trigger processing pipeline
    await processRecallMeetingTask.trigger({
      interviewId: interview.id,
      recordingId,
      accountId: account_id,
      projectId: project_id,
      mediaR2Key,
      recallTranscriptUrl: transcriptUrl,
    });

    return json({ received: true, interview_id: interview.id });
  }

  return json({ received: true });
}
```

---

## 4. GET /api/desktop/recordings/{recall_recording_id}/status

**Purpose:** Poll processing status after recording upload.

**Called when:** Desktop app polls after recording ends to show progress.

### Request

```http
GET /api/desktop/recordings/recording_uuid/status?account_id=acc_uuid HTTP/1.1
Host: getupsight.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response (200 OK - Processing)

```json
{
  "recall_recording_id": "recording_uuid",
  "status": "processing",
  "interview_id": "interview_uuid",
  "progress": {
    "media_downloaded": true,
    "transcript_complete": true,
    "evidence_extracted": false,
    "themes_linked": false
  },
  "created_at": "2025-12-28T10:45:00Z",
  "updated_at": "2025-12-28T10:46:30Z"
}
```

### Response (200 OK - Completed)

```json
{
  "recall_recording_id": "recording_uuid",
  "status": "completed",
  "interview_id": "interview_uuid",
  "progress": {
    "media_downloaded": true,
    "transcript_complete": true,
    "evidence_extracted": true,
    "themes_linked": true
  },
  "evidence_count": 12,
  "web_url": "https://getupsight.com/acme-corp/q1-discovery/interviews/interview_uuid"
}
```

### Response (404 Not Found)

```json
{
  "error": "Recording not found",
  "status": "pending"
}
```

This response means the webhook hasn't been received yet - desktop should continue polling.

### Implementation Notes

- Query `interviews` table by `recall_recording_id`
- Join with processing status (could be stored in interview or separate jobs table)
- Include web URL for "View in UpSight" button

---

## 5. GET /api/desktop/health

**Purpose:** Health check for desktop app to verify API availability.

**Called when:** App startup, periodic health checks.

### Request

```http
GET /api/desktop/health HTTP/1.1
Host: getupsight.com
```

### Response (200 OK)

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-12-28T12:00:00Z",
  "features": {
    "recall_integration": true,
    "realtime_coaching": false
  }
}
```

---

## Trigger.dev Task: processRecallMeetingTask

**File:** `src/trigger/meeting/processRecallMeeting.ts`

This task processes Recall recordings without using AssemblyAI (uses Recall transcript instead).

```typescript
import { task } from '@trigger.dev/sdk/v3';

interface RecallTranscriptEntry {
  participant: {
    id: number;
    name: string;
    email?: string;
    is_host: boolean;
  };
  words: Array<{
    text: string;
    start_timestamp: { relative: number; absolute: string };
    end_timestamp?: { relative: number; absolute: string };
  }>;
}

interface SpeakerUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export const processRecallMeetingTask = task({
  id: 'meeting.process-recall-meeting',
  retry: { maxAttempts: 3 },

  run: async (payload: {
    interviewId: string;
    recordingId: string;
    accountId: string;
    projectId: string;
    mediaR2Key: string;
    recallTranscriptUrl: string;
  }) => {
    const { interviewId, accountId, projectId, recallTranscriptUrl } = payload;

    // Step 1: Fetch Recall transcript
    const response = await fetch(recallTranscriptUrl);
    const recallTranscript: RecallTranscriptEntry[] = await response.json();

    // Step 2: Transform to our format (skip AssemblyAI)
    const utterances: SpeakerUtterance[] = [];
    for (const entry of recallTranscript) {
      for (const word of entry.words) {
        utterances.push({
          speaker: entry.participant.name || `Speaker ${entry.participant.id}`,
          text: word.text,
          start: word.start_timestamp.relative,
          end: word.end_timestamp?.relative ?? word.start_timestamp.relative + 1,
        });
      }
    }

    // Step 3: Extract unique participants
    const participantMap = new Map<number, {
      name: string;
      email?: string;
      is_host: boolean;
    }>();

    for (const entry of recallTranscript) {
      if (!participantMap.has(entry.participant.id)) {
        participantMap.set(entry.participant.id, {
          name: entry.participant.name,
          email: entry.participant.email,
          is_host: entry.participant.is_host,
        });
      }
    }

    // Step 4: Match or create people records
    const peopleIds: string[] = [];
    for (const [, participant] of participantMap) {
      // Try to match by email first
      let person = participant.email
        ? await db.person.findFirst({
            where: {
              project_id: projectId,
              primary_email: participant.email
            }
          })
        : null;

      // Try fuzzy name match if no email match
      if (!person && participant.name) {
        person = await db.person.findFirst({
          where: {
            project_id: projectId,
            OR: [
              { first_name: { contains: participant.name.split(' ')[0] } },
              { last_name: { contains: participant.name.split(' ').slice(-1)[0] } },
            ]
          }
        });
      }

      // Create new person if no match
      if (!person) {
        const nameParts = participant.name?.split(' ') || ['Unknown'];
        person = await db.person.create({
          data: {
            project_id: projectId,
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(' ') || null,
            primary_email: participant.email || null,
          }
        });
      }

      peopleIds.push(person.id);
    }

    // Step 5: Update interview with transcript and people
    const fullTranscript = utterances
      .map(u => `${u.speaker}: ${u.text}`)
      .join('\n');

    await db.interview.update({
      where: { id: interviewId },
      data: {
        full_transcript: fullTranscript,
        speaker_utterances: utterances,
        status: 'transcribed',
      }
    });

    // Link people to interview
    await db.interviewPerson.createMany({
      data: peopleIds.map(personId => ({
        interview_id: interviewId,
        person_id: personId,
      }))
    });

    // Step 6: Extract evidence (existing BAML pipeline)
    await extractEvidenceTask.triggerAndWait({
      interviewId,
      utterances,
    });

    // Step 7: Link themes
    await linkThemesTask.triggerAndWait({
      interviewId,
    });

    // Step 8: Mark complete
    await db.interview.update({
      where: { id: interviewId },
      data: { status: 'completed' }
    });

    return {
      interviewId,
      utteranceCount: utterances.length,
      participantCount: participantMap.size,
    };
  }
});
```

---

## Database Schema Changes

```sql
-- Add columns to interviews table for Recall integration
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT,
  ADD COLUMN IF NOT EXISTS recall_recording_id TEXT UNIQUE;

-- Index for webhook idempotency (find by recall_recording_id)
CREATE INDEX IF NOT EXISTS idx_interviews_recall_recording_id
  ON interviews(recall_recording_id)
  WHERE recall_recording_id IS NOT NULL;

-- Index for status polling (find by recall_recording_id + account)
CREATE INDEX IF NOT EXISTS idx_interviews_recall_status
  ON interviews(recall_recording_id, account_id, status)
  WHERE recall_recording_id IS NOT NULL;
```

---

## Environment Variables

Add to backend `.env`:

```bash
# Recall.ai Configuration
RECALL_API_KEY=your-recall-api-key
RECALL_WEBHOOK_SECRET=your-webhook-signing-secret

# Optional: Recall API URL (defaults to us-west-2)
RECALL_API_URL=https://us-west-2.recall.ai
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Error Codes

| Code | HTTP Status | Description |
| ---- | ----------- | ----------- |
| `UNAUTHORIZED` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Rate Limiting

| Endpoint | Limit | Window |
| -------- | ----- | ------ |
| `/api/desktop/context` | 60 | 1 minute |
| `/api/desktop/recall-token` | 10 | 1 hour |
| `/api/desktop/recordings/*/status` | 60 | 1 minute |
| `/api/recall-webhook` | No limit | - |

---

## Testing Checklist

- [ ] `/api/desktop/context` returns user's accounts/projects
- [ ] `/api/desktop/recall-token` generates valid Recall upload token
- [ ] `/api/recall-webhook` verifies HMAC signature correctly
- [ ] `/api/recall-webhook` handles `sdk_upload.complete` event
- [ ] `/api/recall-webhook` is idempotent (duplicate webhooks don't create duplicates)
- [ ] Media downloads to R2 successfully
- [ ] Transcript transforms correctly to speaker_utterances format
- [ ] Evidence extraction runs on transformed transcript
- [ ] `/api/desktop/recordings/*/status` returns correct progress
- [ ] End-to-end: recording → webhook → interview visible in web app
