# upsight-desktop Implementation Plan

## Overview

This plan covers the implementation of upsight-desktop from forking Muesli to shipping the MVP.

## Phase 0: Foundation

### 0.1 Fork & Rebrand Muesli

- [ ] Fork this repo as `upsight-desktop`
- [ ] Update package.json (name, version, author)
- [ ] Replace branding assets (icons, splash)
- [ ] Update window title and menu items
- [ ] Remove Muesli-specific demo code
- [ ] Verify Recall SDK still works after cleanup

### 0.2 Backend API Endpoints

Create new routes in UpSight Remix app:

- [ ] `POST /api/desktop/auth` - Token exchange
- [ ] `GET /api/desktop/context` - Accounts + projects
- [ ] `POST /api/desktop/recall-token` - Generate Recall upload token
- [ ] `GET /api/desktop/interviews` - List interviews
- [ ] `GET /api/desktop/interviews/:id` - Get interview detail
- [ ] `PATCH /api/desktop/interviews/:id` - Update interview
- [ ] `GET /api/desktop/recordings/:id/status` - Processing status
- [ ] `GET /api/desktop/health` - Health check

### 0.3 Database Schema

- [ ] Add `meeting_platform` column to `interviews`
- [ ] Add `recall_recording_id` column to `interviews`
- [ ] Create index on `recall_recording_id`
- [ ] Test RLS policies work with new columns

### 0.4 Webhook Handler

- [ ] Create `POST /api/recall-webhook` endpoint
- [ ] Implement HMAC signature verification
- [ ] Handle `sdk_upload.complete` event
- [ ] Download media to R2
- [ ] Create interview record
- [ ] Trigger processing pipeline
- [ ] Test with Recall webhook simulator

---

## Phase 1: Authentication

### 1.1 OAuth Flow

- [ ] Register custom protocol `upsight://`
- [ ] Create login button that opens browser
- [ ] Build OAuth callback page in UpSight web
- [ ] Handle redirect back to desktop app
- [ ] Exchange auth code for tokens
- [ ] Store tokens in OS keychain (keytar)

### 1.2 Token Management

- [ ] Implement token refresh logic
- [ ] Handle expired token gracefully
- [ ] Clear tokens on logout
- [ ] Show login screen when unauthenticated

### 1.3 User Context

- [ ] Fetch accounts/projects on login
- [ ] Display account/project selector
- [ ] Persist last-used selection
- [ ] Allow switching without re-auth

**Go/No-Go:** User can log in, select project, and see their context.

---

## Phase 2: Recording Core

### 2.1 Meeting Detection

- [ ] Connect to Recall SDK meeting detection
- [ ] Display "Meeting detected" notification
- [ ] Show meeting info (platform, title if available)
- [ ] Timeout/dismiss after 30 seconds

### 2.2 Recording Controls

- [ ] "Start Recording" button
- [ ] Recording indicator with duration
- [ ] "Stop Recording" button
- [ ] Handle meeting ended automatically

### 2.3 Recall SDK Integration

- [ ] Pass account/project metadata to upload token
- [ ] Configure webhook URL
- [ ] Handle recording start/stop events
- [ ] Graceful error handling (no meeting, permissions)

**Go/No-Go:** User can detect and record a Google Meet call.

---

## Phase 3: Real-Time Transcription

### 3.1 Transcription Display

- [ ] Create TranscriptionView component
- [ ] Subscribe to Recall `transcript.data` events
- [ ] IPC bridge from main to renderer
- [ ] Display speaker name + text
- [ ] Auto-scroll to latest

### 3.2 Speaker Handling

- [ ] Extract speaker names from Recall metadata
- [ ] Color-code different speakers
- [ ] Handle missing speaker names gracefully

### 3.3 UI Polish

- [ ] Smooth scrolling behavior
- [ ] Visual recording pulse indicator
- [ ] Responsive to window resize
- [ ] Dark/light mode support

**Go/No-Go:** User sees live transcription during call with speaker names.

---

## Phase 4: Post-Call Processing

### 4.1 Upload Status

- [ ] Show "Uploading..." after call ends
- [ ] Progress indicator if available
- [ ] Handle upload failures with retry

### 4.2 Processing Status

- [ ] Poll `/recordings/:id/status` endpoint
- [ ] Display progress steps:
  - Media downloaded
  - Transcription complete
  - Evidence extracted
  - Themes linked
- [ ] Show completion confirmation

### 4.3 View in UpSight

- [ ] "View in UpSight" button
- [ ] Open browser to interview detail page
- [ ] Deep link with account/project context

**Go/No-Go:** Recording appears in UpSight with evidence extracted.

---

## Phase 5: Participant Linking

### 5.1 Participant Extraction

- [ ] Parse Recall participant metadata
- [ ] Extract name and email for each
- [ ] Handle missing emails gracefully

### 5.2 People Matching

- [ ] Match email to existing `people.primary_email`
- [ ] Fuzzy match on name if no email
- [ ] Create new Person for unmatched

### 5.3 Interview Linking

- [ ] Create `interview_people` records
- [ ] Show participants in processing status
- [ ] Verify links in UpSight web

**Go/No-Go:** Participants appear correctly linked in UpSight.

---

## Phase 6: Expanded MVP

### 6.1 Voice Notes

- [ ] "Record Voice Note" button
- [ ] Microphone audio capture
- [ ] Same upload pipeline
- [ ] Simpler UI (no transcription display)

### 6.2 Auto-Record Toggle

- [ ] Settings panel
- [ ] "Auto-record meetings" toggle
- [ ] Skip confirmation when enabled
- [ ] Persist preference

### 6.3 Recent Recordings

- [ ] Fetch last 10 interviews
- [ ] Display list in app
- [ ] Click to open in UpSight

### 6.4 Edit Recording Title

- [ ] Editable title field
- [ ] Save to API
- [ ] Optimistic UI update

---

## Phase 7: Polish & Ship

### 7.1 Error Handling

- [ ] Network error recovery
- [ ] Recall SDK error states
- [ ] Clear user-facing error messages
- [ ] Retry mechanisms

### 7.2 Build & Distribution

- [ ] Configure electron-builder
- [ ] macOS code signing
- [ ] Windows code signing
- [ ] Auto-update with electron-updater
- [ ] GitHub releases integration

### 7.3 Testing

- [ ] Unit tests for API client
- [ ] Integration tests for auth flow
- [ ] Manual testing checklist
- [ ] Pilot user testing (5 users)

### 7.4 Documentation

- [ ] Update README with install instructions
- [ ] In-app help/FAQ link
- [ ] Troubleshooting guide

**Ship:** Release to pilot customers.

---

## Rollout Plan

| Phase | Scope | Validation |
|-------|-------|------------|
| **Alpha** | Internal team | Record 10 meetings, fix bugs |
| **Beta** | 5 pilot customers | 30 installs target, gather feedback |
| **GA** | All customers | Monitor metrics, iterate |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Recall SDK issues | Keep Muesli as reference, use Recall support |
| Auth complexity | Start with email/pass, add OAuth second |
| Upload failures | Implement retry, local queue |
| Slow adoption | Clear value prop, in-app onboarding |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Installs | 30 in 30 days | Download count |
| Recordings | 20 in 30 days | Interviews with source_type='recall' |
| Upload success | >99% | Webhook success rate |
| Activation | >50% of installs | Users who record at least 1 meeting |

---

## Next Steps

After this plan is approved:

1. Run `/plan Phase 0.1: Fork and rebrand Muesli`
2. Work through phases sequentially
3. Go/No-Go checkpoints after each phase
4. Ship to alpha after Phase 5

---

## References

- [SPEC.md](./SPEC.md) - Requirements specification
- [DESIGN.md](./DESIGN.md) - Architecture and design
- [Meeting Agent Spec](./meeting-agent-spec.md) - Detailed PRD
