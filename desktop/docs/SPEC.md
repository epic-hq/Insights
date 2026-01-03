# upsight-desktop Specification

## Overview

**Product:** upsight-desktop
**Type:** Electron desktop application
**Purpose:** Capture meeting recordings and voice notes, integrating with UpSight's customer intelligence platform

## Problem Statement

UpSight transforms customer conversations into verified insights with receipts. Currently, users must manually upload recordings after calls. This creates friction:

- Users forget to record or upload
- Context is lost between call and upload
- No real-time visibility during calls
- Manual process doesn't scale for high-volume teams

**Solution:** A desktop app that automatically captures meetings and voice notes, displaying real-time transcription and seamlessly uploading to UpSight's processing pipeline.

## Target Users

### Primary Personas

| Persona | Use Case | Key Need |
|---------|----------|----------|
| **Product Researcher** | Customer discovery interviews | Capture insights → evidence → roadmap decisions |
| **Sales Rep** | Prospect and customer calls | BANT qualification → deal intelligence |

### User Characteristics

- B2B teams doing recurring customer conversations
- Mix of internal (2-4) and external (1-2) participants per call
- Primarily Google Meet users (Zoom/Teams secondary)
- macOS (Apple Silicon) and Windows users

## Functional Requirements

### Core MVP (Must Have)

#### R1: Authentication
- Login via existing UpSight account at auth.getupsight.com
- Support email/password authentication
- Support Google OAuth authentication
- Persist session securely (OS keychain)

#### R2: Account & Project Context
- Fetch user's accounts and projects from UpSight API
- Display account/project selector in app
- Persist last-used account/project as default
- Allow switching without re-authentication

#### R3: Meeting Detection & Recording
- Auto-detect Google Meet meetings (priority platform)
- Display "Meeting detected" notification
- One-click to start recording
- Capture audio with participant metadata
- Show recording indicator (duration, status)

#### R4: Real-Time Transcription
- Display live transcription during call
- Show speaker names with their utterances
- Auto-scroll to latest content
- Visual distinction between speakers

#### R5: Post-Call Processing
- Auto-upload recording on call end
- Trigger UpSight processing pipeline
- Display processing status: Recording → Uploading → Processing → Done
- Show confirmation when evidence extraction complete

#### R6: Participant Handling
- Extract participant names and emails from meeting metadata
- Match to existing People records in UpSight (by email)
- Create new Person records for unmatched participants
- Link all participants to the interview record

### Expanded MVP (Should Have)

#### R7: Voice Notes
- Manual "Record Voice Note" button
- Capture microphone audio
- Same upload/processing pipeline as meetings
- Quick capture for thoughts outside meetings

#### R8: Auto-Record Setting
- Toggle: "Automatically record when meeting detected"
- Persist preference per user
- Skip confirmation when enabled

#### R9: Recent Recordings
- List last 10 recordings in app
- Show: title, date, duration, status, participant count
- Click to open in UpSight web app

#### R10: Edit Recording Metadata
- Rename recording title post-call
- Add notes before upload
- Edit syncs to UpSight

### Future Vision (Nice to Have)

| Feature | Description |
|---------|-------------|
| Calendar integration | Auto-prompt for scheduled customer calls |
| Real-time coaching | Talk time balance, question prompts, topic alerts |
| Zoom + Teams support | Expand beyond Google Meet |
| In-meeting insights | Live evidence extraction display |
| Mobile app | When Recall mobile SDK available |

## Non-Functional Requirements

### Performance
- App launch: < 3 seconds
- Meeting detection: < 5 seconds after joining
- Real-time transcription latency: < 2 seconds
- Upload start: < 10 seconds after call ends

### Security
- OAuth tokens stored in OS-secure keychain
- No recording data persisted locally after upload
- All API calls over HTTPS
- Webhook signatures validated (HMAC)

### Compatibility
- macOS: Apple Silicon (M1/M2/M3)
- Windows: 10/11 (x64)
- Note: Intel Macs not supported by Recall SDK

### Reliability
- Graceful handling of network interruptions
- Resume upload if connection restored
- Clear error states with retry options

## Success Criteria

### 30-Day Validation

| Metric | Target |
|--------|--------|
| Installs | 30 users |
| Meetings recorded | 20 recordings |
| Upload success rate | > 99% |
| Transcript quality | Parity with manual uploads |

### Failure Signals (Pivot Triggers)

- Users unwilling to install desktop app
- Recording quality issues (audio, speaker detection)
- Upload failures or pipeline errors
- Participant linking accuracy problems

## Dependencies

### External Services
- **Recall.ai Desktop SDK** - Meeting detection and recording
- **UpSight API** - Authentication, project context, interview management
- **Deepgram** (via Recall) - Real-time transcription

### Internal Systems
- UpSight authentication (auth.getupsight.com)
- UpSight API endpoints (existing + new desktop-specific)
- Trigger.dev processing pipeline
- Cloudflare R2 media storage

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Build from scratch or fork Muesli? | Fork Muesli - Recall SDK integration already working |
| Voice notes via Recall SDK or separate? | Use Recall SDK, fallback to existing upload pipeline |
| Browser extension vs desktop? | Desktop required - browsers can't capture system audio |

## References

- [UpSight App Spec](./upsight-app-spec.md) - Main product specification
- [Meeting Agent Spec](./meeting-agent-spec.md) - Detailed PRD with API endpoints
- [Recall.ai Desktop SDK Docs](https://docs.recall.ai/docs/desktop-sdk)
