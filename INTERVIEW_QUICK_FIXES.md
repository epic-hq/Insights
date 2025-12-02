# Interview Processing - Quick Fixes

## Diagnose a Stuck Interview

```bash
npx dotenvx run -- npx tsx scripts/diagnose-stuck-interview.ts <interview-id>
```

This will show:
- Interview status and details
- Whether it has transcript/media
- Upload and analysis jobs state
- Specific issues found
- Recommended fix commands

## Common Scenarios & Fixes

### Scenario 1: Has Media, No Transcript
**Symptoms**:
- Interview status shows `ready` but can't view
- `media_url` exists
- `transcript` is NULL
- No upload_jobs or analysis_jobs

**Fix**:
```bash
curl -X POST http://localhost:4280/api/reprocess-interview \
  -H "Content-Type: application/json" \
  -d '{"interviewId": "<interview-id>"}'
```

This will:
1. Send media URL to Trigger.dev
2. Transcribe via AssemblyAI
3. Extract evidence + themes
4. Update interview to `ready` with data

### Scenario 2: Has Transcript, Wrong Status
**Symptoms**:
- Interview has `transcript` field populated
- Status is not `ready` (stuck at `processing`, `transcribed`, etc.)
- Upload/analysis jobs stuck at `pending` or `in_progress`

**Fix**:
```bash
curl -X POST http://localhost:4280/api/fix-stuck-interview \
  -H "Content-Type: application/json" \
  -d '{"interviewId": "<interview-id>"}'
```

This will:
1. Update interview status to `ready`
2. Mark stuck upload_jobs as `done`
3. Mark stuck analysis_jobs as `done`

### Scenario 3: Has Transcript, No Evidence
**Symptoms**:
- Interview has `transcript`
- Status is `ready`
- But no evidence extracted (theme/evidence pages empty)

**Fix**:
```bash
curl -X POST http://localhost:4280/api/reprocess-interview \
  -H "Content-Type: application/json" \
  -d '{"interviewId": "<interview-id>"}'
```

This will re-run evidence extraction using existing transcript.

## Check Trigger.dev Status

If `/api/reprocess-interview` returns a `runId`, check it in Trigger.dev dashboard:

1. Go to Trigger.dev dashboard (https://cloud.trigger.dev or your self-hosted instance)
2. Search for the run ID
3. View logs to see transcription/analysis progress
4. If failed, check error messages

## Architecture Issues

See `INTERVIEW_PROCESSING.md` for:
- Full pipeline architecture
- All 4 processing flows
- Why state gets out of sync
- Simplification recommendations

## Files Reference

**Diagnostic Tool**:
- `scripts/diagnose-stuck-interview.ts` - Diagnose stuck interviews

**Fix APIs**:
- `app/routes/api.reprocess-interview.tsx` - Reprocess with/without transcript
- `app/routes/api.fix-stuck-interview.tsx` - Fix stuck status/jobs

**Processing Logic**:
- `app/utils/processInterview.server.ts` - Direct processing (no Trigger)
- `app/utils/processInterviewAnalysis.server.ts` - Trigger.dev pipeline
- `src/trigger/interview/v2/orchestrator.ts` - V2 modular workflow

**Database Tables**:
- `interviews` - Main interview record
- `upload_jobs` - Upload/transcription tracking (often stuck)
- `analysis_jobs` - Analysis progress (often stuck)
