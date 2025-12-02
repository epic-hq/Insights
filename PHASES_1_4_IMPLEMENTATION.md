# Interview Pipeline Simplification - Phases 1-4 Implementation

## Overview

Consolidating interview processing state from 3 tables + Trigger.dev runs into a single source of truth with event-driven updates.

---

## Phase 1: Consolidate State ✅ IN PROGRESS

### Goal
Add `processing_metadata` JSONB column to interviews table and auto-cleanup triggers to prevent stuck jobs.

### Changes

#### 1. Database Migration
**File**: `supabase/migrations/20251202_add_processing_metadata.sql`

**Added**:
- `processing_metadata` JSONB column on `interviews` table
- Index on `status='processing'` for stuck interview queries
- Trigger: `auto_cleanup_jobs_on_ready()` - marks upload/analysis jobs `done` when interview becomes `ready`
- Trigger: `auto_mark_jobs_error()` - marks jobs `error` when interview errors
- Schema documentation in comments

**Metadata Schema**:
```typescript
interface ProcessingMetadata {
  current_step?: "uploading" | "transcribing" | "extracting_evidence" | "generating_themes" | "assigning_personas" | "complete"
  progress?: number // 0-100
  trigger_run_id?: string
  started_at?: string // ISO timestamp
  completed_at?: string // ISO timestamp
  last_error?: string
  transcription_job_id?: string // AssemblyAI job ID
  evidence_count?: number
  theme_count?: number
}
```

**To Apply**:
```bash
npx supabase db push
```

#### 2. Safety Net Cron Job (Weekly Cleanup)
**File**: `src/trigger/maintenance/cleanup-stuck-interviews.ts` (TO CREATE)

```typescript
import { schedules } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

export const cleanupStuckInterviews = schedules.task({
  id: "cleanup-stuck-interviews",
  cron: "0 2 * * 0", // Sundays at 2 AM
  run: async () => {
    const supabase = createSupabaseAdminClient()

    // Find interviews stuck in processing > 24 hours
    const { data: stuckInterviews } = await supabase
      .from("interviews")
      .select("id, status, updated_at")
      .eq("status", "processing")
      .lt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (!stuckInterviews || stuckInterviews.length === 0) {
      return { message: "No stuck interviews found", count: 0 }
    }

    // Mark them as error
    for (const interview of stuckInterviews) {
      await supabase
        .from("interviews")
        .update({
          status: "error",
          processing_metadata: {
            last_error: "Interview stuck in processing for >24 hours",
            current_step: "error",
          }
        })
        .eq("id", interview.id)
    }

    return {
      message: `Marked ${stuckInterviews.length} stuck interviews as error`,
      count: stuckInterviews.length,
      interviewIds: stuckInterviews.map(i => i.id)
    }
  }
})
```

#### 3. Test the Triggers
After migration completes:

**Test auto-cleanup**:
```sql
-- Manually set interview to ready to trigger cleanup
UPDATE interviews
SET status = 'ready'
WHERE id = '<some-interview-id>';

-- Check that upload_jobs/analysis_jobs were marked done
SELECT * FROM upload_jobs WHERE interview_id = '<interview-id>';
SELECT * FROM analysis_jobs WHERE interview_id = '<interview-id>';
```

**Test auto-error**:
```sql
-- Manually set interview to error
UPDATE interviews
SET status = 'error'
WHERE id = '<some-interview-id>';

-- Check that jobs were marked error
SELECT * FROM upload_jobs WHERE interview_id = '<interview-id>';
SELECT * FROM analysis_jobs WHERE interview_id = '<interview-id>';
```

---

## Phase 2: Migrate to Trigger.dev v2 Only

### Goal
All media processing through v2 modular workflow. Remove v1 monolithic workflow.

### Changes

#### 1. Remove ENABLE_MODULAR_WORKFLOW Check
**File**: `app/utils/processInterviewAnalysis.server.ts` (line ~183)

**Before**:
```typescript
const useV2Workflow = process.env.ENABLE_MODULAR_WORKFLOW === "true"

const handle = useV2Workflow
  ? await tasks.trigger("interview.v2.orchestrator", { ... })
  : await tasks.trigger("interview.upload-media-and-transcribe", { ... })
```

**After**:
```typescript
// Always use v2 orchestrator for all media processing
const handle = await tasks.trigger("interview.v2.orchestrator", {
  analysisJobId: analysisJob.id,
  metadata,
  transcriptData,
  mediaUrl: mediaUrl || interview.media_url || "",
  existingInterviewId: interviewId,
  userCustomInstructions: customInstructions,
})
```

#### 2. Keep Direct Processing for Text Files Only
**File**: `app/routes/api.upload-file.tsx` (lines ~62-78)

**No changes needed** - text files already use direct processing via `processInterviewTranscript()`, not Trigger.dev.

#### 3. Deprecate V1 Tasks (Optional)
**Files to mark as deprecated**:
- `src/trigger/interview/uploadMediaAndTranscribe.ts` (v1 monolithic)
- `src/trigger/interview/extractEvidenceAndPeople.ts` (v1)
- `src/trigger/interview/analyzeThemesAndPersona.ts` (v1)
- `src/trigger/interview/attributeAnswers.ts` (v1)

Add deprecation comments:
```typescript
/**
 * @deprecated Use v2 modular workflow instead (src/trigger/interview/v2/orchestrator.ts)
 * This v1 monolithic task is kept for backward compatibility only.
 */
```

#### 4. Remove ENABLE_MODULAR_WORKFLOW from Env
**File**: `.env` (and wherever documented)

Delete line:
```bash
ENABLE_MODULAR_WORKFLOW=true
```

**Update docs** to mention v2 is default.

---

## Phase 3: Event-Driven Status Updates

### Goal
Trigger.dev tasks update `interviews.status` + `processing_metadata` directly, eliminating need for `analysis_jobs` state.

### Changes

#### 1. Update Each V2 Task to Write Metadata
Pattern to apply to all v2 tasks:

**Example: extractEvidence.ts**

**Add at start of run()**:
```typescript
// Update processing_metadata at task start
await client
  .from("interviews")
  .update({
    status: "processing",
    processing_metadata: {
      current_step: "extracting_evidence",
      progress: 40,
      trigger_run_id: ctx.run.id,
      started_at: new Date().toISOString(),
    }
  })
  .eq("id", payload.interviewId)
```

**Add at end of run()**:
```typescript
// Update metadata on completion
const updatedMetadata = {
  ...existingMetadata, // Load current metadata first
  current_step: "extracting_evidence",
  progress: 60,
  completed_at: new Date().toISOString(),
  evidence_count: evidenceIds.length,
}

await client
  .from("interviews")
  .update({ processing_metadata: updatedMetadata })
  .eq("id", payload.interviewId)
```

**Files to update**:
- `src/trigger/interview/v2/uploadAndTranscribe.ts` ✅ (already has progress updates via analysisJob)
- `src/trigger/interview/v2/extractEvidence.ts`
- `src/trigger/interview/v2/generateInsights.ts`
- `src/trigger/interview/v2/assignPersonas.ts`
- `src/trigger/interview/v2/attributeAnswers.ts`
- `src/trigger/interview/v2/finalizeInterview.ts` (should set `status='ready'`)

#### 2. Final Task Sets Status to Ready
**File**: `src/trigger/interview/v2/finalizeInterview.ts`

**Add**:
```typescript
// Mark interview as ready
await client
  .from("interviews")
  .update({
    status: "ready",
    processing_metadata: {
      current_step: "complete",
      progress: 100,
      completed_at: new Date().toISOString(),
    }
  })
  .eq("id", payload.interviewId)
```

This will trigger the `auto_cleanup_jobs_on_ready()` database trigger from Phase 1.

#### 3. Error Handling
Each task's catch block should update interview status:

```typescript
catch (error) {
  await client
    .from("interviews")
    .update({
      status: "error",
      processing_metadata: {
        current_step: state.currentStep,
        last_error: errorMessage(error),
      }
    })
    .eq("id", payload.interviewId)

  throw error
}
```

---

## Phase 4: Remove Legacy Tables

### Goal
Drop `upload_jobs` and `analysis_jobs` tables after verifying all processing uses `processing_metadata`.

### Prerequisites
- ✅ Phase 1 complete (processing_metadata column exists)
- ✅ Phase 2 complete (all processing uses v2)
- ✅ Phase 3 complete (tasks update processing_metadata)
- ✅ No active jobs in upload_jobs/analysis_jobs tables

### Steps

#### 1. Verify No Active Jobs
```sql
-- Check for any non-terminal jobs
SELECT COUNT(*) FROM upload_jobs
WHERE status IN ('pending', 'in_progress');

SELECT COUNT(*) FROM analysis_jobs
WHERE status IN ('pending', 'in_progress');

-- Should both return 0
```

#### 2. Create Backup (Optional)
```sql
-- Backup job data before deletion
CREATE TABLE upload_jobs_archive AS
SELECT * FROM upload_jobs;

CREATE TABLE analysis_jobs_archive AS
SELECT * FROM analysis_jobs;
```

#### 3. Find and Remove Code References

**Search for references**:
```bash
grep -r "upload_jobs" app/
grep -r "analysis_jobs" app/
grep -r "upload_jobs" src/
grep -r "analysis_jobs" src/
```

**Files likely to have references**:
- `app/routes/api.fix-stuck-interview.tsx` (lines 59-80, 83-105)
- `app/routes/api.interview-status.tsx` (if it queries jobs)
- Any admin dashboard queries

**Remove or comment out these sections**.

#### 4. Drop Tables
**File**: `supabase/migrations/20251203_drop_job_tables.sql`

```sql
-- Drop upload_jobs and analysis_jobs tables
-- These are replaced by processing_metadata in interviews table

DROP TABLE IF EXISTS upload_jobs CASCADE;
DROP TABLE IF EXISTS analysis_jobs CASCADE;

-- If you created backups:
-- COMMENT: Backup tables exist as upload_jobs_archive and analysis_jobs_archive
```

**Apply**:
```bash
npx supabase db push
```

#### 5. Update Type Definitions
**File**: `supabase/types.ts` will auto-update after migration

Run:
```bash
npx supabase gen types typescript --local > supabase/types.ts
```

---

## Phase 5: Admin Dashboard (Separate Project)

### Features
- List interviews stuck in `processing` > 1 hour
- Query Trigger.dev API for run status
- One-click "Fix Stuck Interview" button
- Re-process button for failed interviews
- View `processing_metadata` timeline
- Filter by project/account
- Export stuck interview report

### Implementation Notes
- Create new route: `app/routes/admin/interviews.tsx`
- Use Trigger.dev SDK to query run status
- Display `processing_metadata` as timeline
- Add bulk operations (fix all stuck, retry all failed)

**Document in separate file**: `ADMIN_DASHBOARD.md`

---

## Testing Checklist

### Phase 1
- [ ] Migration applies successfully
- [ ] `processing_metadata` column exists on interviews
- [ ] Database trigger marks jobs `done` when interview becomes `ready`
- [ ] Database trigger marks jobs `error` when interview errors
- [ ] Cron job runs without errors (test manually)

### Phase 2
- [ ] All new interviews use v2 orchestrator
- [ ] Text file uploads still use direct processing
- [ ] V1 tasks no longer triggered for new interviews
- [ ] Existing in-progress interviews complete successfully

### Phase 3
- [ ] Each v2 task updates `processing_metadata` at start
- [ ] Each v2 task updates `processing_metadata` on completion
- [ ] Final task sets `status='ready'`
- [ ] Error handling updates `status='error'`
- [ ] `processing_metadata` reflects actual progress

### Phase 4
- [ ] No active jobs in upload_jobs/analysis_jobs
- [ ] All code references removed
- [ ] Migration drops tables successfully
- [ ] No runtime errors after table drop
- [ ] Type definitions updated

---

## Rollback Plan

### Phase 1
- Revert migration: Drop triggers and column
- No data loss (triggers don't delete data)

### Phase 2
- Re-enable `ENABLE_MODULAR_WORKFLOW` env var
- V1 tasks still exist, can be used again

### Phase 3
- Tasks still write to analysis_jobs (dual write mode)
- Can revert to reading from analysis_jobs if needed

### Phase 4
- Restore from backup tables
- Re-apply foreign keys
- Redeploy code with references

**Critical**: Test each phase in development before production deployment.

---

## Estimated Timeline

- **Phase 1**: ~1-2 hours (migration + test triggers + create cron)
- **Phase 2**: ~30 minutes (remove env var check, add deprecation comments)
- **Phase 3**: ~3-4 hours (update 6 v2 tasks with metadata writes)
- **Phase 4**: ~1 hour (verify no refs, drop tables, update types)

**Total**: ~6-8 hours of implementation + testing

**Deployment**: Can be done incrementally (Phase 1 → 2 → 3 → 4) over days/weeks.

---

## Success Metrics

### Before
- 3 sources of truth (interviews.status, upload_jobs.status, analysis_jobs.status)
- Manual intervention required for stuck interviews
- Complex debugging (check 3 tables + Trigger.dev dashboard)

### After
- 1 source of truth (interviews.status + processing_metadata)
- Auto-recovery via database triggers
- Simple debugging (check 1 table + processing_metadata timeline)
- Cleaner codebase (2 fewer tables, less sync logic)
