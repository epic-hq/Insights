# Interview Processing Flows

This document describes the two main flows for processing interviews in the Insights application: Upload Recording and Realtime Recording.

## Overview

Both flows follow the same analysis pipeline after transcription to ensure consistent processing and insight extraction:

1. **Transcription**: Audio → Text transcript
2. **Analysis Job Creation**: Create tracking record
3. **AI Processing**: Extract insights, evidence, themes via BAML/OpenAI
4. **Database Storage**: Store insights, link participants, create personas

## 1. Upload Recording Flow

### Entry Points
- **URL Upload**: `api.upload-from-url` route
- **File Upload**: Onboarding flow via UploadScreen component (triggers webhook flow)

### Flow A: Direct URL Upload (`api.upload-from-url`)

**Files involved:**
- `app/routes/api.upload-from-url.tsx` - Main endpoint
- `app/utils/assemblyai.server.ts` - AssemblyAI integration
- `app/utils/processInterview.server.ts` - Analysis processing

**Process:**
```
1. POST /api.upload-from-url
   ├── Converts Google Drive URLs to direct download URLs
   ├── Calls transcribeRemoteFile()
   │   ├── Fetches remote file as stream
   │   ├── Uploads stream to AssemblyAI /upload endpoint
   │   ├── Starts transcription job with enhanced options:
   │   │   ├── speaker_labels: true
   │   │   ├── iab_categories: true (topic detection)
   │   │   ├── format_text: true
   │   │   ├── punctuate: true
   │   │   ├── auto_chapters: true
   │   │   └── sentiment_analysis: false
   │   └── Polls AssemblyAI status until completion (30min timeout)
   ├── Creates interview record directly via processInterviewTranscript()
   ├── Extracts evidence units via BAML
   ├── Generates insights via BAML + OpenAI GPT-4o
   └── Returns success + insights count
```

**Key Data Flow:**
- AssemblyAI returns: `audio_duration`, `confidence`, `text`, `utterances`, etc.
- Stored as: `duration_sec: transcriptData.audio_duration` in interviews table

### Flow B: File Upload via Webhook (`api.assemblyai-webhook`)

**Files involved:**
- Onboarding: `app/features/onboarding/components/UploadScreen.tsx`
- Webhook: `app/routes/api.assemblyai-webhook.tsx`
- Analysis: `app/utils/processInterviewAnalysis.server.ts`
- Processing: `app/utils/processInterview.server.ts`

Note the Webhook requirement: AssemblyAI processes async, so we need to wait for the webhook to complete before processing the transcript. In production, supabase hosts the webhok, but in dev we need to run ngrok to open a port:

```bash
ngrok http --url=cowbird-still-routinely.ngrok-free.app 4280
```


**Process:**
```
1. User uploads file via UploadScreen
   └── File stored in Supabase Storage

2. Upload job created → AssemblyAI submission
   ├── Creates upload_jobs record with assemblyai_id
   ├── Submits to AssemblyAI for transcription
   └── AssemblyAI processes async

3. POST /api/assemblyai-webhook (when transcription completes)
   ├── Finds upload_jobs record by assemblyai_id
   ├── Fetches full transcript data from AssemblyAI API
   ├── Updates interview record:
   │   ├── status: "transcribed"
   │   ├── transcript: transcriptData.text
   │   ├── transcript_formatted: formattedTranscriptData
   │   └── duration_sec: transcriptData.audio_duration (rounded)
   ├── Calls createAndProcessAnalysisJob()
   │   ├── Creates analysis_jobs record
   │   ├── Updates interview status: "processing"
   │   ├── Calls processInterviewTranscriptWithAdminClient()
   │   ├── Extracts evidence via BAML
   │   ├── Generates insights via BAML + GPT-4o
   │   ├── Creates people/personas/tags
   │   ├── Updates analysis_jobs status: "done"
   │   └── Updates interview status: "ready"
   └── Handles errors by marking jobs/interviews as "error"
```

## 2. Realtime Recording Flow

**Files involved:**
- Entry: `app/features/interviews/pages/realtime.tsx`
- Component: `app/features/realtime/components/InterviewCopilot.tsx`
- Finalize: `app/routes/api.interviews.realtime-finalize.tsx`
- Analysis: `app/utils/processInterviewAnalysis.server.ts`
- Processing: `app/utils/processInterview.server.ts`

**Process:**
```
1. GET /a/{accountId}/{projectId}/interviews/{interviewId}/realtime
   └── Loads InterviewCopilot component

2. InterviewCopilot Component Operations:
   ├── Establishes WebSocket connection to /ws/realtime-transcribe
   ├── Captures audio via AudioWorklet (PCM processing)
   ├── Streams 16kHz PCM audio chunks to WebSocket
   ├── Receives real-time transcript updates
   ├── Records audio locally via MediaRecorder (WebM/Opus)
   └── Shows live transcript + interview tools

3. User clicks "Finish" → stopStreaming()
   ├── Stops WebSocket connection
   ├── Stops MediaRecorder and creates audio blob
   ├── Uploads audio blob to Supabase Storage
   ├── Calls POST /api/interviews/realtime-finalize
   │   ├── Updates interview with transcript + media_url
   │   ├── Creates formattedTranscriptData:
   │   │   ├── full_transcript: transcript
   │   │   ├── confidence: 0.8 (default)
   │   │   ├── audio_duration: null (not available)
   │   │   ├── file_type: "realtime"
   │   │   └── original_filename: "realtime-{interviewId}"
   │   ├── Calls createAndProcessAnalysisJob()
   │   │   ├── Creates analysis_jobs record
   │   │   ├── Updates interview status: "processing"
   │   │   ├── Calls processInterviewTranscriptWithAdminClient()
   │   │   ├── Extracts evidence via BAML
   │   │   ├── Generates insights via BAML + GPT-4o
   │   │   ├── Creates people/personas/tags
   │   │   ├── Updates analysis_jobs status: "done"
   │   │   └── Updates interview status: "ready"
   │   └── Handles errors gracefully
   └── Navigates to interview detail page
```

## Shared Analysis Pipeline

Both flows converge at `createAndProcessAnalysisJob()` which ensures consistent processing:

**Files:**
- `app/utils/processInterviewAnalysis.server.ts` - Job orchestration
- `app/utils/processInterview.server.ts` - Core AI processing

**Steps:**
```
1. Create analysis_jobs record (status: "in_progress")
2. Update interview status: "processing"
3. Call processInterviewTranscriptWithAdminClient():
   ├── Extract evidence units via BAML ExtractEvidenceFromTranscript
   ├── Auto-generate themes from evidence
   ├── Extract insights via BAML ExtractInsights + GPT-4o
   ├── Create person record from interviewee data
   ├── Assign persona via BAML AssignPersonaToInterview
   ├── Create tags from insights.relatedTags
   └── Link insights to personas automatically
4. Update analysis_jobs status: "done"
5. Update interview status: "ready"
```

## Key Differences

| Aspect | Upload Flow | Realtime Flow |
|--------|-------------|---------------|
| **Audio Source** | External file/URL | Live recording |
| **Transcription** | AssemblyAI (full features) | WebSocket streaming |
| **Audio Duration** | ✅ From AssemblyAI | ✅ From audio blob |
| **Audio Storage** | ✅ Stored in Supabase Storage | ✅ Stored in Supabase Storage |
| **Processing Timing** | After upload completes | After recording finishes |
| **Error Handling** | Webhook resilience | UI error states |

## Audio Duration Handling

**Upload Flow**:
- ✅ `duration_sec` stored directly from AssemblyAI `audio_duration` field
- AssemblyAI provides accurate duration after transcription completes

**Realtime Flow**:
- ✅ `duration_sec` extracted from recorded audio blob using HTML5 Audio API
- `getAudioDuration()` function loads the blob and reads `audio.duration`
- Duration sent to `realtime-finalize` endpoint and stored in database

**Resolution**: Both flows now properly store audio duration in the `duration_sec` field.

**Database Storage**:
Both flows store duration in `interviews.duration_sec` field (integer seconds).

## Audio File Storage

**NEW**: All interview flows now store the original audio files in Supabase Storage for consistent media access.

### Storage Implementation

**Shared Utility**: `storeAudioFile.server.ts`
- Handles File, Blob, and URL sources
- Stores files in `interview-recordings` bucket
- Generates consistent filenames: `interviews/{projectId}/{interviewId}-{timestamp}.{ext}`
- Returns public URLs for database storage

### Upload Flows Storage:

**api.upload-file.tsx**:
1. ✅ Stores original file in Supabase Storage
2. Uploads to AssemblyAI for transcription
3. Uses stored URL as `media_url` in database

**api.upload-from-url.tsx**:
1. ✅ Downloads file from URL and stores in Supabase Storage
2. Uploads to AssemblyAI for transcription
3. Uses stored URL as `media_url` in database

**api.assemblyai-webhook.tsx**:
1. ✅ Downloads audio file from AssemblyAI `audio_url`
2. Stores in Supabase Storage
3. Uses stored URL as `media_url` in database

**Realtime Flow**:
1. ✅ Records audio locally via MediaRecorder
2. Stores recorded blob in Supabase Storage
3. Uses stored URL as `media_url` in database

### Benefits:
- **Consistent Access**: All interviews have persistent media URLs
- **Data Ownership**: Audio files stored in our infrastructure
- **Reliability**: Not dependent on external URLs or temporary AssemblyAI URLs
- **Performance**: Files served from Supabase CDN

## Data Flow Summary

```
Upload URL → Store → AssemblyAI → Webhook → Analysis → Database
     ↓          ↓         ↓          ↓         ↓         ↓
File/URL  Supabase  Transcription Processing   AI     Insights
         Storage  + audio_duration              ↓    + Evidence
                                          Themes   + People
                                                 + Personas

Realtime → WebSocket → Record+Store → Finalize → Analysis → Database
    ↓          ↓            ↓            ↓         ↓         ↓
 Live Audio  Streaming  Supabase    Processing    AI    Insights
           Transcription Storage   + duration           + Evidence
                                                       + People
                                                      + Personas
```