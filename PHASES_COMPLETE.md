# Interview Pipeline Simplification - Phases 1-4 COMPLETE ✅

## Summary

Successfully consolidated interview processing state from 3 sources of truth into a single source with event-driven updates.

---

## Phase 1: Consolidate State ✅ COMPLETE

### What Changed
- ✅ Added `processing_metadata` JSONB column to `interviews` table
- ✅ Created database triggers to auto-cleanup stuck jobs
  - `auto_cleanup_jobs_on_ready()`: Marks jobs `done` when interview becomes `ready`
  - `auto_mark_jobs_error()`: Marks jobs `error` when interview fails
- ✅ Added index `idx_interviews_status_processing` for stuck interview queries

### Result
**Single source of truth for UI progress**: `interviews.processing_metadata`

```typescript
interface ProcessingMetadata {
  current_step: "upload" | "evidence" | "insights" | "personas" | "answers" | "complete"
  progress: number // 0-100
  status_detail: string
  trigger_run_id: string
  started_at: string
  completed_at?: string
  failed_at?: string
  error?: string
}
```

---

## Phase 2: Migrate to v2 Only ✅ COMPLETE

### What Changed
- ✅ Removed `ENABLE_MODULAR_WORKFLOW` environment variable check
- ✅ All media processing now uses v2 modular orchestrator
- ✅ Deprecated v1 monolithic `uploadMediaAndTranscribeTask`

### Files Modified
- `app/utils/processInterviewAnalysis.server.ts`: Always trigger v2 orchestrator
- `src/trigger/interview/uploadMediaAndTranscribe.ts`: Added deprecation notice

### Result
**Consistent processing path**: All interviews use v2 modular workflow (`interview.v2.orchestrator`)

---

## Phase 3: Update Tasks to Write processing_metadata ✅ COMPLETE

### What Changed
All v2 tasks now update `interviews.processing_metadata` at:
- ✅ Task start (with current_step, progress, status_detail, trigger_run_id)
- ✅ Task error (with failed_at, error message)
- ✅ Workflow completion (with completed_at, progress: 100)

### Files Modified
- ✅ `src/trigger/interview/v2/orchestrator.ts`: Initialize on start, update on error
- ✅ `src/trigger/interview/v2/extractEvidence.ts`: Update on start & error
- ✅ `src/trigger/interview/v2/generateInsights.ts`: Update on start & error
- ✅ `src/trigger/interview/v2/assignPersonas.ts`: Update on start & error
- ✅ `src/trigger/interview/v2/attributeAnswers.ts`: Update on start & error
- ✅ `src/trigger/interview/v2/finalizeInterview.ts`: Set status='ready' with completed metadata

### Result
**Real-time progress tracking**: UI can query `processing_metadata` for live updates without polling Trigger.dev

---

## Phase 4a: Drop upload_jobs Table ✅ COMPLETE

### What Changed
- ✅ Dropped `upload_jobs` table (fully replaced by `processing_metadata`)
- ✅ Removed upload_jobs references from database triggers
- ✅ Updated schema documentation

### Migration Applied
- `supabase/migrations/20251202_drop_upload_jobs.sql`

### Result
**Simplified architecture**: Upload progress tracked via `interviews.processing_metadata` only

---

## Phase 4b: Keep analysis_jobs (Documented) ✅ COMPLETE

### Decision
**KEEP** `analysis_jobs` table for workflow state storage.

### Why?
1. **Workflow resumption**: Stores intermediate data needed to resume from any step
   - `workflow_state.evidenceUnits[]`: Array of extracted evidence (not persisted elsewhere)
   - `workflow_state.transcriptData`: Full transcript object for retries
   - `workflow_state.fullTranscript`: Plain text transcript
2. **Separation of concerns**:
   - `processing_metadata` = UI display (progress, status)
   - `workflow_state` = resumption data (large JSONB blobs)
3. **Minimal overhead**: Only one job per interview, auto-cleaned by triggers

### Updated Schema
File: `supabase/schemas/80_transcription_pipeline.sql`

```sql
-- Analysis jobs - stores workflow state for Trigger.dev v2 orchestrator
-- Progress tracking moved to interviews.processing_metadata
create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,

  -- Legacy status fields (maintained by database triggers)
  progress int default 0,
  status job_status not null default 'pending',
  status_detail text,
  trigger_run_id text,

  -- V2 modular workflow state (primary purpose)
  workflow_state jsonb,      -- Full workflow state for resume capability
  completed_steps text[],
  current_step text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Result
**Pragmatic balance**: UI progress via `processing_metadata`, workflow resumption via `analysis_jobs.workflow_state`

---

## Final Architecture

### State Management (After Phases 1-4)

| Data | Location | Purpose |
|------|----------|---------|
| **Progress & Status** | `interviews.processing_metadata` | UI display, real-time updates |
| **Workflow Resumption** | `analysis_jobs.workflow_state` | Resume from mid-point, retry logic |
| **Interview Data** | `interviews.transcript`, `interviews.media_url` | Permanent storage |
| **Extracted Evidence** | `evidence` table | Structured insights |
| **Generated Themes** | `themes` table | Project-level groupings |

### Processing Flow

```
User uploads media
  ↓
Trigger: interview.v2.orchestrator
  ↓
Creates analysis_job with workflow_state
  ↓
Each task updates interviews.processing_metadata
  ↓
On completion: interviews.status = 'ready'
  ↓
Database trigger marks analysis_job as 'done'
```

### Benefits

1. ✅ **Single source of truth for UI**: `processing_metadata`
2. ✅ **Automatic cleanup**: Database triggers prevent stuck states
3. ✅ **Consistent workflow**: All processing via v2 orchestrator
4. ✅ **Real-time updates**: Tasks write progress directly
5. ✅ **Resumable workflows**: `workflow_state` enables mid-point resume
6. ✅ **Simplified schema**: 1 fewer table (upload_jobs dropped)

---

## Testing Checklist

### Phase 1 ✅
- [x] Migration applies successfully
- [x] `processing_metadata` column exists on interviews
- [x] Database trigger marks jobs `done` when interview becomes `ready`
- [x] Database trigger marks jobs `error` when interview errors

### Phase 2 ✅
- [x] All new interviews use v2 orchestrator
- [x] V1 tasks no longer triggered for new interviews

### Phase 3 ✅
- [x] Each v2 task updates `processing_metadata` at start
- [x] Each v2 task updates `processing_metadata` on error
- [x] Final task sets `status='ready'`
- [x] Orchestrator updates `processing_metadata` on workflow start and error

### Phase 4 ✅
- [x] upload_jobs table dropped
- [x] Schema updated to remove upload_jobs references
- [x] Database triggers updated
- [x] analysis_jobs retained for workflow_state storage

---

## Next Steps (Optional Future Work)

### Phase 5: Admin Dashboard
- [ ] Create `/admin/interviews` page for monitoring stuck interviews
- [ ] Query Trigger.dev API for run status
- [ ] One-click "Fix Stuck Interview" button
- [ ] Display `processing_metadata` timeline

### Phase 6: Further Simplification (If Needed)
- [ ] Move `workflow_state` into `interviews` table (if JSONB size acceptable)
- [ ] Drop `analysis_jobs` entirely
- [ ] Simplify state management to single table

---

## Files Modified

### Database Schema
- ✅ `supabase/schemas/20_interviews.sql` - Added processing_metadata, triggers
- ✅ `supabase/schemas/80_transcription_pipeline.sql` - Dropped upload_jobs, updated analysis_jobs docs
- ✅ `supabase/migrations/20251202_drop_upload_jobs.sql` - DROP TABLE migration

### Trigger.dev Tasks
- ✅ `src/trigger/interview/v2/orchestrator.ts` - Added ctx, processing_metadata updates
- ✅ `src/trigger/interview/v2/uploadAndTranscribe.ts` - (Already had progress updates)
- ✅ `src/trigger/interview/v2/extractEvidence.ts` - Added processing_metadata updates
- ✅ `src/trigger/interview/v2/generateInsights.ts` - Added processing_metadata updates
- ✅ `src/trigger/interview/v2/assignPersonas.ts` - Added processing_metadata updates
- ✅ `src/trigger/interview/v2/attributeAnswers.ts` - Added processing_metadata updates
- ✅ `src/trigger/interview/v2/finalizeInterview.ts` - Set processing_metadata on completion

### Application Code
- ✅ `app/utils/processInterviewAnalysis.server.ts` - Always use v2, removed ENABLE_MODULAR_WORKFLOW
- ✅ `src/trigger/interview/uploadMediaAndTranscribe.ts` - Added deprecation notice

---

## Conclusion

The interview processing pipeline has been successfully simplified from 3 sources of truth to 1 primary source (`interviews.processing_metadata`) with a lightweight workflow state store (`analysis_jobs.workflow_state`).

**Before**:
- 3 tables tracking status (interviews, upload_jobs, analysis_jobs)
- Multiple code paths (direct, v1, v2)
- Frequent sync issues

**After**:
- 1 table for UI progress (`interviews.processing_metadata`)
- 1 table for workflow resumption (`analysis_jobs.workflow_state`)
- Single code path (v2 orchestrator)
- Auto-cleanup triggers prevent stuck states

The system is now more maintainable, easier to debug, and provides real-time progress updates without polling external services.
