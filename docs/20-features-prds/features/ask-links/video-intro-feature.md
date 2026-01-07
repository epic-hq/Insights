# Ask Links - Video Intro Feature

## Overview

Allow Ask link creators to record a short (~30 second) personal intro video that plays at the beginning of the survey. This adds a human touch and increases response rates.

## User Stories

**As a researcher**, I want to record a short intro video explaining why I'm asking these questions, so respondents feel more connected and are more likely to complete the survey.

**As a respondent**, I want to see who's asking me these questions and understand the context, so I feel comfortable sharing my thoughts.

## Implementation Scope

### Database Changes

Add column to `research_links` table:

```sql
ALTER TABLE public.research_links
ADD COLUMN intro_video_url text DEFAULT NULL;
```

### Edit Page (Creator Experience)

**Location:** Options section, new "Video Intro" card above Chat mode toggle

**UI Elements:**
1. Empty state: "Add a personal intro" with record button
2. Recording state: Live preview with countdown timer (max 60s), stop button
3. Preview state: Video player, re-record button, remove button
4. Uploading state: Progress indicator

**Technical:**
- Use existing `use-media-recorder.ts` hook
- Upload to R2: `ask-intros/{research_link_id}/{timestamp}.webm`
- Transcode via existing Trigger.dev worker (if needed)
- Store public URL in `intro_video_url` column

### Public Page (Respondent Experience)

**Location:** Hero section, before email capture

**UI Elements:**
1. Video player with play button overlay
2. "Skip intro" link below player
3. Auto-advance to email after video ends

**Behavior:**
- Video does NOT auto-play (respects user preference)
- Click to play, shows native controls
- After video ends, auto-scroll to email input
- Skip link always visible

### API Endpoints

**POST `/api/ask/:listId/upload-intro`**
- Accepts video blob
- Uploads to R2
- Updates `intro_video_url` on research_link
- Returns public URL

**DELETE `/api/ask/:listId/intro`**
- Removes video from R2
- Sets `intro_video_url` to null

### Components

1. `VideoIntroRecorder.tsx` - Recording UI for edit page
2. `VideoIntroPlayer.tsx` - Playback UI for public page
3. Reuse existing R2 upload utilities

## Technical Considerations

- Max video duration: 60 seconds
- Max file size: ~50MB (after compression)
- Supported formats: webm (native), mp4 (transcoded)
- Storage path: `ask-intros/{research_link_id}/intro.{ext}`
- Thumbnail generation: Optional, use first frame

## Out of Scope (v1)

- Multiple intro videos (e.g., per question)
- Video transcription/captions
- AI-generated video summaries
- Upload existing video file (record-only in v1)

## Rollout

1. **Phase 1:** Basic recording + playback (MVP)
2. **Phase 2:** Thumbnail preview, better encoding
3. **Phase 3:** Analytics (video completion rate)
