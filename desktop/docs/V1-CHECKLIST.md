# V1 Launch Checklist

## Overview

This checklist tracks all components needed for v1 launch of upsight-desktop with backend integration.

## Desktop App (This Repo)

### Authentication

- [x] Supabase Auth integration (`src/auth.js`)
- [x] Email/password login
- [x] Google OAuth flow with `upsight://auth/callback`
- [x] Session storage in OS keychain (keytar)
- [x] Token refresh logic
- [x] User name lookup (OAuth metadata → people table fallback)
- [x] Logout with session clear

### Recording

- [x] Recall SDK initialization
- [x] Meeting detection (Zoom, Meet, Teams)
- [x] Meeting-detected notification
- [x] Start/stop recording
- [x] Real-time transcript display
- [x] Participant tracking
- [x] Local summary generation (OpenRouter)

### Backend Integration

- [x] `createDesktopSdkUpload()` calls UpSight backend for upload token
- [x] `getUserContext()` fetches account/project from backend
- [x] Upload token includes account_id, project_id for webhook routing
- [ ] Poll `/api/desktop/recordings/{id}/status` for processing progress
- [ ] Display processing status UI

### UI Polish

- [x] Login page styling (matches getupsight.com)
- [x] User avatar/name in dropdown
- [ ] Processing status view after recording ends
- [ ] "View in UpSight" button linking to web app
- [ ] Error states and retry UI

## Backend (UpSight - getupsight.com)

### API Endpoints Required

| Endpoint | Method | Status | Notes |
| -------- | ------ | ------ | ----- |
| `/api/desktop/context` | GET | ❓ | Returns user's accounts/projects |
| `/api/desktop/recall-token` | POST | ❓ | Generates Recall upload token with metadata |
| `/api/recall-webhook` | POST | ❓ | Receives webhooks from Recall.ai |
| `/api/desktop/recordings/{id}/status` | GET | ❓ | Processing status for desktop polling |
| `/api/desktop/health` | GET | ❓ | Health check endpoint |

### Webhook Handler (`/api/recall-webhook`)

- [ ] Verify HMAC signature from Recall
- [ ] Parse `sdk_upload.complete` event
- [ ] Extract account_id, project_id from upload token metadata
- [ ] Download media from Recall to R2
- [ ] Download transcript from Recall
- [ ] Create interview record in Supabase
- [ ] Trigger `processRecallMeetingTask` in Trigger.dev

### Trigger.dev Pipeline

- [ ] Create `processRecallMeetingTask` task
- [ ] Fetch and transform Recall transcript (skip AssemblyAI)
- [ ] `transformRecallTranscript()` - Recall format → speaker_utterances
- [ ] `extractParticipantsFromTranscript()` - Get participant metadata
- [ ] `matchOrCreatePeople()` - Match email/name to existing people
- [ ] Create interview with transcript and people links
- [ ] Trigger `extractEvidence` task (existing BAML)
- [ ] Trigger `linkThemes` task (existing)

### Database Schema

```sql
-- Add columns to interviews table
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT,
  ADD COLUMN IF NOT EXISTS recall_recording_id TEXT UNIQUE;

-- Index for webhook idempotency
CREATE INDEX IF NOT EXISTS idx_interviews_recall_id
  ON interviews(recall_recording_id)
  WHERE recall_recording_id IS NOT NULL;
```

### Environment Variables

```bash
# Backend .env
RECALL_API_KEY=your-recall-api-key
RECALL_WEBHOOK_SECRET=your-webhook-signing-secret
```

## Recall.ai Configuration

- [ ] Configure webhook URL: `https://getupsight.com/api/recall-webhook`
- [ ] Set webhook secret for signature verification
- [ ] Enable async transcription (for final transcript download)

## Testing Checklist

### Desktop App

- [ ] Fresh install shows login screen
- [ ] Email/password login works
- [ ] Google OAuth login works and redirects back
- [ ] Meeting detection works for Google Meet
- [ ] Recording starts and shows live transcript
- [ ] Recording stops and shows local summary
- [ ] Upload to Recall succeeds (check upload-progress events)

### Backend Integration

- [ ] Upload token endpoint returns valid Recall token
- [ ] Webhook receives `sdk_upload.complete` after upload
- [ ] Media downloaded to R2 successfully
- [ ] Transcript transformed correctly
- [ ] Interview created in Supabase
- [ ] Evidence extraction runs
- [ ] Interview visible in web app

### End-to-End

- [ ] User logs in to desktop app
- [ ] User records a Google Meet call
- [ ] Recording ends, local summary appears
- [ ] Upload completes in background
- [ ] Interview appears in web app within ~5 minutes
- [ ] Evidence and themes extracted

## Launch Blockers

### Must Have

1. Backend webhook endpoint (`/api/recall-webhook`)
2. Backend token endpoint (`/api/desktop/recall-token`)
3. Backend context endpoint (`/api/desktop/context`)
4. Trigger.dev task for Recall processing
5. Recall webhook configuration

### Nice to Have (Can Launch Without)

- Processing status UI in desktop app
- "View in UpSight" deep link
- Error recovery/retry UI
- Multiple account/project selection

## Cost Summary

| Component | Cost | Notes |
| --------- | ---- | ----- |
| Recall SDK | $0.15/hr | Includes transcription |
| AssemblyAI | $0.00 | Skipped - using Recall transcript |
| OpenRouter (local summary) | ~$0.02/call | gpt-4o-mini |
| BAML (evidence extraction) | ~$0.10/call | Existing pipeline |
| **Total per interview** | ~$0.27/hr | Assuming 1hr meeting |

## References

- [DESIGN.md](./DESIGN.md) - Architecture and data flow
- [meeting-agent-spec.md](./meeting-agent-spec.md) - Detailed backend spec
- [REALTIME-ANALYSIS-PROPOSAL.md](./REALTIME-ANALYSIS-PROPOSAL.md) - Future enhancement
