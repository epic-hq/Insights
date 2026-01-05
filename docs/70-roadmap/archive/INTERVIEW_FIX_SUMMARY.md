# Interview Processing Fix - Summary

## Issue Fixed

**Problem**: Interview `b8d86566-9001-4e69-9a7b-20d38447843e` had media uploaded but no transcript generated.

**Root Cause**: The v2 `uploadAndTranscribe` task didn't handle the case where `needs_transcription: true` was set in the payload. It expected transcript to already exist in `transcriptData`.

## Solution Implemented

### 1. Enhanced `/api/reprocess-interview` endpoint
**File**: `app/routes/api.reprocess-interview.tsx`

**Changes**:
- Now handles interviews with **media but no transcript**
- Passes `needs_transcription: true` flag to Trigger.dev
- Also handles interviews with transcript (re-run analysis only)

**Usage**:
```bash
curl -X POST http://localhost:4280/api/reprocess-interview \
  -H "Content-Type: application/json" \
  -d '{"interviewId": "<id>"}'
```

### 2. Added transcription logic to v2 task
**File**: `src/trigger/interview/v2/uploadAndTranscribe.ts`

**Changes**:
- Detects `needs_transcription` flag in payload
- Generates presigned R2 URL from media key
- Calls AssemblyAI's `transcribeAudioFromUrl`
- Passes resulting transcript to `uploadMediaAndTranscribeCore`

**Key code**:
```typescript
if ((transcriptData as any).needs_transcription && mediaUrl) {
  // Generate presigned URL from R2 key
  const presigned = createR2PresignedUrl({
    key: mediaUrl,
    expiresInSeconds: 3600,
  })

  // Transcribe via AssemblyAI
  const assemblyResult = await transcribeAudioFromUrl(presigned.url)
  processedTranscriptData = assemblyResult
}
```

### 3. Registered missing API routes
**File**: `app/routes.ts`

**Added**:
```typescript
route("api/reprocess-interview", "./routes/api.reprocess-interview.tsx"),
route("api/fix-stuck-interview", "./routes/api.fix-stuck-interview.tsx"),
```

## Result

✅ Interview now has transcript
✅ Transcription working via Trigger.dev v2
⏳ Evidence extraction in progress (current run: `run_cmip22qxmd7fr2mn9mts02xn5`)

## Next Steps

Interview is currently processing. Once complete, it should have:
- ✅ Transcript
- ✅ Evidence extracted
- ✅ Themes generated
- ✅ Status = `ready`

If it gets stuck again, use:
```bash
npx dotenvx run -- npx tsx scripts/diagnose-stuck-interview.ts <id>
```

## Tools Created

1. **diagnose-stuck-interview.ts** - Diagnostic script
2. **INTERVIEW_PROCESSING.md** - Full architecture doc
3. **INTERVIEW_QUICK_FIXES.md** - Quick reference guide

---

## Remaining Work: Pipeline Simplification (Phases 1-4)

See implementation plan in conversation. Key changes:
1. Add `processing_metadata` JSONB column
2. Database trigger for auto-cleanup
3. Migrate all processing to Trigger.dev v2
4. Event-driven status updates
5. Remove `upload_jobs` and `analysis_jobs` tables
