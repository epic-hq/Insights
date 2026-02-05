# Interview Processing Pipeline - Architecture Overview

## Current State (2025-12-02)

The interview processing pipeline is **complex and fragmented** across multiple systems:
- Supabase tables (`interviews`, `upload_jobs`, `analysis_jobs`)
- Trigger.dev tasks (v1 and v2 workflows)
- Direct processing (processInterview.server.ts)
- Multiple entry points with inconsistent state tracking

This document maps the current architecture and identifies areas for simplification.

---

## Tables Involved

### 1. `interviews`
**Purpose**: Main interview record
**Key Fields**:
- `id`, `project_id`, `account_id`
- `status`: `uploading` | `transcribed` | `processing` | `ready` | `error`
- `media_url`: R2 storage URL for audio/video
- `transcript`: Full text transcript
- `transcript_formatted`: Structured transcript with speakers/timestamps
- `original_filename`, `source_type`, `file_extension`

### 2. `upload_jobs`
**Purpose**: Track upload and transcription progress
**Key Fields**:
- `interview_id` (FK)
- `status`: `pending` | `in_progress` | `done` | `error`
- `status_detail`: Human-readable progress message
- `current_step`: Which step is running

**Problem**: Often gets stuck in `pending` or `in_progress` even after interview is `ready`

### 3. `analysis_jobs`
**Purpose**: Track AI analysis and evidence extraction
**Key Fields**:
- `interview_id` (FK)
- `status`: `pending` | `in_progress` | `done` | `error`
- `status_detail`, `current_step`
- `trigger_run_id`: Trigger.dev run ID
- `transcript_data`: Transcript payload passed to analysis
- `progress`: 0-100 percentage

**Problem**: Often stuck in `pending` even when interview is `ready`

---

## Processing Flows

### Flow 1: Audio/Video Upload (api.upload-file.tsx)

```
1. User uploads file → Create interview with status='uploading'
2. Store file in R2 → Get mediaUrl
3. Call AssemblyAI transcription → Get transcript
4. Update interview status='transcribed'
5. Call processInterviewTranscript()
   ├─ Create interview record (or update existing)
   ├─ Extract evidence with BAML
   ├─ Store evidence in DB
   ├─ Run conversation analysis
   ├─ Auto-group themes
   └─ Update interview status='ready'
```

**Entry Point**: `app/routes/api.upload-file.tsx`
**No Trigger.dev**: Runs directly in server action
**No upload_jobs or analysis_jobs created**: Just direct processing

### Flow 2: Text File Upload (api.upload-file.tsx, text branch)

```
1. User uploads .txt/.md file
2. Read text content directly (no transcription)
3. Call processInterviewTranscript() (same as Flow 1 step 5)
```

**Entry Point**: `app/routes/api.upload-file.tsx`
**No Trigger.dev**: Runs directly in server action

### Flow 3: Reprocess Interview (api.reprocess-interview.tsx)

```
1. Get interview with transcript
2. Update status='processing'
3. Call createAndProcessAnalysisJob()
   ├─ Create analysis_job with status='in_progress'
   ├─ Update interview status='processing'
   ├─ Trigger Trigger.dev task (v1 or v2 workflow)
   └─ Store trigger_run_id in analysis_job
4. Trigger.dev runs async
```

**Entry Point**: `app/routes/api.reprocess-interview.tsx`
**Uses Trigger.dev**: Yes (v1 or v2 workflow based on ENABLE_MODULAR_WORKFLOW env var)
**Creates analysis_job**: Yes

### Flow 4: Fix Stuck Interview (api.fix-stuck-interview.tsx)

```
1. Check interview state
2. If has transcript but status != 'ready', update to status='ready'
3. Mark stuck upload_jobs as status='done'
4. Mark stuck analysis_jobs as status='done'
```

**Entry Point**: `app/routes/api.fix-stuck-interview.tsx`
**Purpose**: Manual recovery from stuck states

---

## Trigger.dev Workflows

### V1 Workflow (Monolithic)
**Task**: `interview.upload-media-and-transcribe`
**File**: `src/trigger/interview/uploadMediaAndTranscribe.ts`

Steps (all in one task):
1. Upload & Transcribe
2. Extract Evidence & People
3. Analyze Themes & Persona
4. Attribute Answers
5. Finalize Interview

**Problem**: Single giant task, hard to debug, all-or-nothing retry

### V2 Workflow (Modular)
**Orchestrator**: `interview.v2.orchestrator`
**Files**: `src/trigger/interview/v2/*`

Steps (separate tasks):
1. `interview.v2.upload-and-transcribe`
2. `interview.v2.extract-evidence`
3. `interview.v2.generate-insights`
4. `interview.v2.assign-personas`
5. `interview.v2.attribute-answers`
6. `interview.v2.finalize-interview`

**Benefit**: Each step can be retried independently
**Enabled by**: `ENABLE_MODULAR_WORKFLOW=true` env var

---

## State Machine Problems

### Problem 1: Multiple State Trackers
- `interviews.status`
- `upload_jobs.status`
- `analysis_jobs.status`
- `analysis_jobs.trigger_run_id` (Trigger.dev run state)

**These get out of sync frequently**

### Problem 2: Stuck Jobs
Common scenario:
```
interview.status = 'ready'
interview.transcript = '...' (exists)
upload_jobs.status = 'in_progress' (stuck)
analysis_jobs.status = 'pending' (stuck)
```

**Why**: Job records are created but not updated when direct processing (Flow 1/2) bypasses Trigger.dev

### Problem 3: Inconsistent Entry Points
- Some uploads use direct processing (no Trigger.dev)
- Some use Trigger.dev v1
- Some use Trigger.dev v2
- Result: Different code paths, different state management

---

## Diagnosis: Why b8d86566-9001-4e69-9a7b-20d38447843e Is Stuck

Based on the code, likely scenarios:

### Scenario A: No Transcript
- Interview was created but transcription failed
- Status stuck at `uploading` or `transcribed`
- No upload_job or analysis_job was created

### Scenario B: Has Transcript, Wrong Status
- Interview has transcript but status != 'ready'
- Direct processing path didn't update status
- Fix: Run api.fix-stuck-interview

### Scenario C: Trigger.dev Task Failed
- analysis_job exists with trigger_run_id
- Trigger task failed but didn't update interview status
- Need to check Trigger.dev dashboard for run status

---

## Simplification Recommendations

### Option 1: Single Source of Truth (interviews table only)
- **Eliminate**: `upload_jobs`, `analysis_jobs` tables
- **Keep**: `interviews.status` + `interviews.processing_metadata` (JSONB)
- **Benefit**: No sync issues, simpler state machine
- **Trade-off**: Lose detailed step-by-step progress tracking

### Option 2: Trigger.dev Only (No Direct Processing)
- **Change**: All uploads trigger Trigger.dev tasks (even text files)
- **Benefit**: Consistent processing path, better retry/monitoring
- **Trade-off**: Slower for simple text uploads

### Option 3: Keep Both, Clear Separation
- **Direct processing**: For text files only (no jobs created)
- **Trigger.dev**: For all audio/video (creates analysis_job)
- **Rule**: If analysis_job exists, MUST update it; otherwise don't create it
- **Benefit**: Fast path for text, reliable path for media

### Option 4: Event-Driven State Updates
- **Change**: Trigger.dev tasks publish events to Supabase webhook
- **Supabase**: Listens for events and updates interview status
- **Benefit**: Decoupled, eventual consistency
- **Trade-off**: More complex infrastructure

A: I think we want options 1,2, 3 and 4, right? single status in interivew table, with detail in the jsonb, all v2 trigger uploads. only direct for text, and use webhooks to update interview table status?

---

## Immediate Actions

### 1. Add Status Query Tool
Create a debug endpoint that shows:
```json
{
  "interview": {
    "id": "...",
    "status": "ready",
    "has_transcript": true,
    "has_media": true
  },
  "upload_jobs": [...],
  "analysis_jobs": [...],
  "trigger_runs": [...]  // Query Trigger.dev API
}
```

### 2. Auto-Fix Stuck States
Add a cron job or database trigger:
- If interview has transcript + status='ready' → mark all jobs 'done'
- If analysis_job stuck for >30 min → check Trigger run, update accordingly

### 3. Document Decision Matrix
| Scenario | Direct Process | Trigger v1 | Trigger v2 |
|----------|---------------|-----------|-----------|
| Text file upload | ✅ | ❌ | ❌ |
| Audio/video upload | ❌ | ❌ | ✅ (if ENABLE_MODULAR_WORKFLOW=true) |
| Reprocess interview | ❌ | ✅ (if ENABLE_MODULAR_WORKFLOW=false) | ✅ (if ENABLE_MODULAR_WORKFLOW=true) |

---

## Key Files Reference

### Entry Points
- `app/routes/api.upload-file.tsx` - Upload handler
- `app/routes/api.reprocess-interview.tsx` - Reprocess handler
- `app/routes/api.fix-stuck-interview.tsx` - Manual fix handler

### Processing Logic
- `app/utils/processInterview.server.ts` - Direct processing (no Trigger)
- `app/utils/processInterviewAnalysis.server.ts` - Creates analysis_job + triggers Trigger.dev
- `app/utils/assemblyai.server.ts` - Transcription

### Trigger.dev Tasks
- `src/trigger/interview/uploadMediaAndTranscribe.ts` - V1 monolithic task
- `src/trigger/interview/v2/orchestrator.ts` - V2 orchestrator
- `src/trigger/interview/v2/*.ts` - V2 modular tasks

### Database
- `app/features/interviews/db.ts` - Interview CRUD operations
- `supabase/migrations/` - Schema definitions

---

## Questions to Answer

1. **Do we need both upload_jobs AND analysis_jobs?** Or can we consolidate?
A: We can consolidate
2. **Should all processing go through Trigger.dev?** Or keep fast path for text?
A: I tend to think consolidating everything in trigger.dev is cleaner as long as there's no realtime requirement.
3. **How do we handle stuck states automatically?** Cron job? Database trigger?
A: what are pros and cons of each? Best practice?
4. **What's the migration path?** Can we safely remove stuck job records?
A: Interviews we should let user do. Upload jobs and analysis jobs we can remove or consolidate.
5. **What monitoring do we need?** Dashboard showing stuck interviews?
Yes, we should have an admin dashboard with things like this.

---

## Next Steps for b8d86566-9001-4e69-9a7b-20d38447843e

1. Query database to check actual state:
   ```sql
   SELECT status, media_url IS NOT NULL as has_media,
          transcript IS NOT NULL as has_transcript
   FROM interviews
   WHERE id = 'b8d86566-9001-4e69-9a7b-20d38447843e';
   ```

2. Check for related jobs:
   ```sql
   SELECT * FROM upload_jobs
   WHERE interview_id = 'b8d86566-9001-4e69-9a7b-20d38447843e';

   SELECT * FROM analysis_jobs
   WHERE interview_id = 'b8d86566-9001-4e69-9a7b-20d38447843e';
   ```

3. Based on results:
   - **If has transcript**: Call api.fix-stuck-interview
   - **If no transcript**: Call api.reprocess-interview
   - **If Trigger run failed**: Check Trigger.dev dashboard, manually retry
