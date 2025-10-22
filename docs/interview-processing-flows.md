# Interview Processing Flows

This document describes the two main flows for processing interviews in the Insights application: Upload Recording and Realtime Recording.

## Overview

Both flows follow the same analysis pipeline after transcription to ensure consistent processing and insight extraction:

1. **Audio Upload**: File → Cloudflare R2 (multipart for large files) → Presigned URL
2. **Transcription**: AssemblyAI downloads from R2 → Text transcript
3. **Analysis Orchestration**: Trigger.dev task pipeline
4. **Two-Pass AI Processing**: 
   - Pass 1: Extract evidence units and insights via BAML/OpenAI
   - Pass 2: Enrich insights with persona facets
5. **Database Storage**: Store insights, link participants, create personas with facets

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
1. User uploads file via UploadScreen (or api.onboarding-start)
   ├── File uploaded to Cloudflare R2 using multipart upload:
   │   ├── Files > 100MB: Multipart (10MB chunks, 2 parallel, 3 retries, 60s timeout)
   │   ├── Files < 100MB: Single upload
   │   └── Stored at: interviews/{projectId}/{interviewId}-{timestamp}.{ext}
   ├── Generate presigned URL (valid 24 hours):
   │   ├── Uses AWS Signature V4 with R2 credentials
   │   ├── Includes X-Amz-Algorithm, X-Amz-Credential, X-Amz-Signature in query params
   │   └── Allows AssemblyAI to download from private R2 bucket
   └── Creates interview record with media_url (presigned URL)

2. AssemblyAI transcription submission
   ├── Creates upload_jobs record with assemblyai_id
   ├── POST to AssemblyAI /v2/transcript with:
   │   ├── audio_url: presigned R2 URL (NOT uploaded to AssemblyAI)
   │   ├── webhook_url: /api/assemblyai-webhook
   │   ├── speaker_labels: true
   │   ├── iab_categories: true
   │   ├── format_text: true
   │   ├── punctuate: true
   │   ├── auto_highlights: true
   │   ├── summarization: true
   │   └── summary_model: "informative"
   └── AssemblyAI downloads from R2 and processes async

3. POST /api/assemblyai-webhook (when transcription completes)
   ├── Finds upload_jobs record by assemblyai_id
   ├── Fetches full transcript data from AssemblyAI API
   ├── Updates interview record:
   │   ├── status: "transcribed"
   │   ├── transcript: transcriptData.text
   │   ├── transcript_formatted: formattedTranscriptData
   │   └── duration_sec: transcriptData.audio_duration (rounded)
   ├── Triggers Trigger.dev task pipeline:
   │   └── processInterviewTask.trigger({ interviewId, accountId, projectId })
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
   ├── Uploads audio blob to Cloudflare R2
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

## Recall Meeting Bots (`api.interviews.recall-bot`)

**Files involved:**
- API entrypoint: `app/routes/api.interviews.recall-bot.tsx`
- Webhook: `app/routes/api.recall-webhook.tsx`
- Trigger.dev task: `src/trigger/recall/ingestRecallBot.ts`
- Persistence: `meeting_bots`, `upload_jobs`, `interviews`

**Process:**
```
1. POST /api/interviews/recall-bot
   ├── Creates interview + upload_job records scoped to the project
   ├── Calls Recall.ai to deploy a meeting bot (Svix authentication)
   └── Persists meeting_bots row (status = pending)

2. Recall.ai webhook (Svix signature verified)
   ├── Updates meeting_bots + upload_jobs status
   └── When status == done → queue recall.ingest-bot Trigger.dev run

3. Trigger.dev task recall.ingest-bot
   ├── Fetches Recall recording + transcript
   ├── Stores raw video + normalized audio in Cloudflare R2
   ├── Normalizes transcript via `normalizeRecallTranscript` + `safeSanitizeTranscriptPayload`
   └── Calls `processInterviewTranscriptWithAdminClient` to reuse the existing analysis pipeline
```

## Shared Analysis Pipeline (Trigger.dev)

Both flows converge at the Trigger.dev task pipeline which orchestrates async processing:

**Files:**
- `app/trigger/tasks/process-interview.ts` - Main orchestration task
- `app/trigger/tasks/enrich-insights-with-facets.ts` - Persona facet enrichment
- `app/utils/processInterview.server.ts` - Core AI processing

**Architecture:**
```
Trigger.dev Task Pipeline (v4 SDK)
├── processInterviewTask (main orchestrator)
│   ├── Pass 1: Extract & Analyze
│   │   ├── Extract evidence units via BAML ExtractEvidenceFromTranscript
│   │   ├── Auto-generate themes from evidence
│   │   ├── Extract insights via BAML ExtractInsights + GPT-4o
│   │   ├── Create person record from interviewee data
│   │   ├── Assign persona via BAML AssignPersonaToInterview
│   │   ├── Create tags from insights.relatedTags
│   │   └── Link insights to personas via junction tables
│   ├── Pass 2: Enrich with Persona Facets
│   │   └── enrichInsightsWithFacetsTask.triggerAndWait()
│   │       ├── Fetches all insights for interview
│   │       ├── Fetches persona facets for assigned persona
│   │       ├── For each insight:
│   │       │   ├── Analyzes relevance to each facet
│   │       │   ├── Generates facet-specific analysis
│   │       │   └── Links insight to relevant facets via insight_persona_facets
│   │       └── Returns enrichment statistics
│   └── Updates interview status: "ready"
└── Error handling with proper status updates
```

**Trigger.dev Features Used:**
- **Task Orchestration**: `task()` for defining long-running background jobs
- **Task Chaining**: `triggerAndWait()` for sequential task execution
- **Retry Logic**: Automatic retries with exponential backoff
- **Progress Tracking**: Real-time status updates via Trigger.dev dashboard
- **No Timeouts**: Tasks can run indefinitely (unlike serverless functions)

**Persona Facets:**
Each persona has multiple facets (e.g., "Goals & Motivations", "Pain Points", "Decision Criteria") that provide structured dimensions for analysis. The enrichment task:
1. Analyzes each insight against all persona facets
2. Determines relevance and generates facet-specific insights
3. Creates `insight_persona_facets` junction records for traceability
4. Enables facet-based filtering and analysis in the UI

## Key Differences

| Aspect | Upload Flow | Realtime Flow |
|--------|-------------|---------------|
| **Audio Source** | External file/URL | Live recording |
| **Transcription** | AssemblyAI (full features) | WebSocket streaming |
| **Audio Duration** | ✅ From AssemblyAI | ✅ From audio blob |
| **Audio Storage** | ✅ Stored in Cloudflare R2 | ✅ Stored in Cloudflare R2 |
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

**NEW**: All interview flows now store the original audio files in Cloudflare R2 for consistent media access.

### Storage Implementation

**Shared Utility**: `storeAudioFile.server.ts`
- Handles File, Blob, and URL sources
- Stores files in R2 bucket with multipart upload for large files:
  - **Multipart Upload** (files > 100MB):
    - 10MB chunks uploaded in parallel (max 2 concurrent)
    - 3 retry attempts per chunk with exponential backoff
    - 60-second timeout per chunk
    - Reduced concurrency for network stability
  - **Single Upload** (files < 100MB):
    - Direct upload with retry logic
- Generates consistent filenames: `interviews/{projectId}/{interviewId}-{timestamp}.{ext}`
- **Returns presigned URLs** (not public URLs):
  - Valid for 24 hours
  - Uses AWS Signature V4 with R2 credentials
  - Allows temporary access to private bucket
  - Required for AssemblyAI to download files

### Upload Flows Storage:

**api.onboarding-start.tsx** (main upload flow):
1. ✅ Stores original file in Cloudflare R2 (multipart if > 100MB)
2. ✅ Generates presigned URL (24-hour expiry)
3. ✅ Submits presigned URL to AssemblyAI /v2/transcript (AssemblyAI downloads from R2)
4. ✅ Stores presigned URL as `media_url` in database
5. ✅ Creates upload_jobs record for webhook tracking

**api.upload-file.tsx**:
1. ✅ Stores original file in Cloudflare R2 (multipart if > 100MB)
2. ✅ Generates presigned URL (24-hour expiry)
3. ✅ Submits presigned URL to AssemblyAI (NOT uploaded to AssemblyAI)
4. ✅ Uses presigned URL as `media_url` in database

**api.upload-from-url.tsx**:
1. ✅ Downloads file from URL and stores in Cloudflare R2
2. ✅ Generates presigned URL (24-hour expiry)
3. ✅ Submits presigned URL to AssemblyAI
4. ✅ Uses presigned URL as `media_url` in database

**Realtime Flow**:
1. ✅ Records audio locally via MediaRecorder
2. Stores recorded blob in Cloudflare R2
3. Uses stored URL as `media_url` in database

### Benefits:
- **No Duplicate Uploads**: File uploaded once to R2, AssemblyAI downloads from there (50% faster)
- **Large File Support**: Multipart upload handles files up to 2.2GB reliably
- **Network Resilience**: Retry logic and reduced concurrency prevent timeout errors
- **Secure**: Presigned URLs provide temporary access without making bucket public
- **Data Ownership**: Audio files stored in our infrastructure
- **Cost Efficient**: No bandwidth costs for uploading to AssemblyAI
- **Performance**: Files served from Cloudflare R2 CDN

## Data Flow Summary

```
Upload Flow:
File → R2 Multipart Upload → Presigned URL → AssemblyAI Download → Webhook → Trigger.dev
  ↓         ↓                      ↓                ↓                  ↓           ↓
Browser  10MB chunks         AWS Sig V4      Transcription      Status Update  Task Pipeline
         (2 parallel)      (24hr expiry)   + audio_duration                      ↓
                                                                          Pass 1: Extract
                                                                          ├── Evidence
                                                                          ├── Insights
                                                                          ├── People
                                                                          └── Personas
                                                                                  ↓
                                                                          Pass 2: Enrich
                                                                          └── Persona Facets
                                                                                  ↓
                                                                            Database

Realtime Flow:
Live Audio → WebSocket → Record+Store → Finalize → Trigger.dev → Database
    ↓            ↓            ↓            ↓             ↓            ↓
 Microphone  Streaming    R2 Upload   Update Status  Task Pipeline  Insights
            Transcription  + Presigned  + Transcript                + Facets
                           URL                                       + Evidence
```
