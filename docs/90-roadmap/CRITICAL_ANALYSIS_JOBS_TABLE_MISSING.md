# CRITICAL BUG: Upload Processing Stuck Due to Deleted analysis_jobs Table

**Status:** 🔴 CRITICAL - Production Blocker
**Discovered:** 2026-02-11
**Affected Feature:** All interview upload flows (Desktop, Recall.ai, URL import)
**Symptom:** Interviews stuck in "processing" state indefinitely

---

## Executive Summary

The `analysis_jobs` table was dropped in migration `20251202150000_consolidate_analysis_jobs.sql`, which consolidated job tracking into `interviews.conversation_analysis`. However, **9 files** across the codebase still attempt to insert into or query from this deleted table, causing  all upload processing to fail silently.

### Impact

- **All desktop recording uploads fail** after media upload
- **Recall.ai meeting imports fail** at analysis job creation
- **No error shown to user** - interviews appear to be "processing" forever
- **Trigger.dev orchestrator never runs** - no evidence extraction, no insights

---

## Root Cause Analysis

### Timeline of Changes

1. **Migration executed:** `20251202150000_consolidate_analysis_jobs.sql`
   - Dropped `analysis_jobs` table
   - Moved data to `interviews.conversation_analysis` JSONB column
   - Updated schema to use single source of truth

2. **Partial code updates:**
   - ✅ `src/trigger/interview/v2/state.ts` - Updated to use `interviews.conversation_analysis`
   - ✅ `src/trigger/interview/v2/orchestrator.ts` - Works with new structure
   - ❌ **Multiple trigger files NOT updated** - still reference deleted table

3. **Result:** Schema/code mismatch causing silent failures

### The Bug

**File:** `src/trigger/interview/processRecallMeeting.ts`
**Lines:** 209-219

```typescript
// Step 3: Create analysis job and trigger v2 orchestrator
const { data: analysisJob, error: jobError } = await client
  .from("analysis_jobs")  // ❌ TABLE DOES NOT EXIST
  .insert({
    account_id: accountId,
    project_id: projectId,
    interview_id: interviewId,
    status: "pending",
    status_detail: "Created from Recall.ai recording",
  })
  .select("id")
  .single();

if (jobError) {
  throw new Error(`Failed to create analysis job: ${jobError.message}`);
}
```

**Error thrown:** `relation "analysis_jobs" does not exist`
**Handling:** Exception caught, job stops, interview left in "processing" state

---

## Affected Files

Found **9 files** still referencing the deleted `analysis_jobs` table:

### High Priority (Active Upload Flows)

1. **`src/trigger/interview/processRecallMeeting.ts`** ⚠️ CRITICAL
   - Handles Recall.ai meeting imports
   - Tries to create analysis_job record before triggering orchestrator
   - Lines: 209-219

2. **`src/trigger/interview/uploadMediaAndTranscribe.ts`** ⚠️ CRITICAL
   - Handles desktop recording uploads
   - May reference analysis_jobs for job tracking

3. **`src/trigger/interview/generateInterviewInsights.ts`**
   - Post-processing insights generation
   - May query analysis_jobs for status

4. **`src/trigger/interview/extractEvidenceAndPeople.ts`**
   - Evidence extraction step
   - May query/update analysis_jobs

5. **`src/trigger/interview/attributeAnswers.ts`**
   - Answer attribution step
   - May query/update analysis_jobs

### Medium Priority (Debug/Support Tools)

6. **`scripts/diagnose-stuck-interview.ts`**
   - Debug script for troubleshooting stuck interviews
   - Will fail when trying to query analysis_jobs

7. **`scripts/check-workflow-state.ts`**
   - Workflow state inspection tool
   - Will fail when querying analysis_jobs

8. **`check-interview.ts`** (temporary debug script)
   - Created during this investigation
   - Lines 27-34: Attempts to query analysis_jobs

### Low Priority (Legacy/Alternative Flows)

9. **`supabase/functions/analysis_worker/index.ts`**
   - Edge function worker
   - May be deprecated or alternate flow

---

## Reproduction Steps

1. Go to desktop app
2. Record a new interview
3. Upload the recording
4. Observe:
   - Upload succeeds (file goes to R2)
   - Interview record created with `status='processing'`
   - Processing spinner shows "Analyzing transcript and generating insights"
   - **Never completes** - stuck forever
5. Check Trigger.dev dashboard:
   - `processRecallMeeting` task shows FAILED
   - Error: `relation "analysis_jobs" does not exist`
6. Check database:
   - `interviews.status = 'processing'`
   - `interviews.conversation_analysis` is null or minimal
   - No workflow_state data

### Example Stuck Interview

**Interview ID:** `931e3b81-ef32-48c3-b6f3-382461b362e4`
**URL:** http://localhost:4280/a/d7b69d5e-a952-41a6-931f-e2fed1d82e85/6dbcbb68-0662-4ebc-9f84-dd13b8ff758d/interviews/931e3b81-ef32-48c3-b6f3-382461b362e4
**Duration stuck:** 8+ hours
**Status:** `processing`

---

## Proposed Fix

### Phase 1: Immediate Remediation (Unstuck Existing Interviews)

Create a repair script to manually trigger orchestrator for stuck interviews:

```typescript
// scripts/repair-stuck-interviews.ts
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { processInterviewOrchestratorV2 } from "~/src/trigger/interview/v2/orchestrator";

async function repairStuckInterview(interviewId: string) {
  const client = createSupabaseAdminClient();

  // Get interview details
  const { data: interview } = await client
    .from("interviews")
    .select("*")
    .eq("id", interviewId)
    .single();

  if (!interview) {
    throw new Error(`Interview ${interviewId} not found`);
  }

  // Trigger orchestrator with interview ID as analysisJobId
  await processInterviewOrchestratorV2.trigger({
    metadata: {
      accountId: interview.account_id,
      projectId: interview.project_id,
      userId: interview.created_by,
    },
    existingInterviewId: interviewId,
    analysisJobId: interviewId, // KEY: Interview ID IS the analysis job ID now
    mediaUrl: interview.media_url,
    transcriptData: interview.transcript_formatted,
  });

  console.log(`✅ Triggered orchestrator for interview ${interviewId}`);
}
```

**Action Items:**
- [ ] Create repair script
- [ ] Run for interview `931e3b81-ef32-48c3-b6f3-382461b362e4`
- [ ] Query for all stuck interviews: `SELECT id FROM interviews WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '1 hour'`
- [ ] Batch repair all stuck interviews

### Phase 2: Code Fixes (Prevent Future Occurrences)

For each affected file, apply this pattern:

**BEFORE (❌ Broken):**
```typescript
// Create analysis job
const { data: analysisJob, error: jobError } = await client
  .from("analysis_jobs")
  .insert({ ... })
  .select("id")
  .single();

// Trigger orchestrator
await processInterviewOrchestratorV2.trigger({
  analysisJobId: analysisJob.id,
  existingInterviewId: interviewId,
  ...
});
```

**AFTER (✅ Fixed):**
```typescript
// No analysis_job creation needed - interview ID is the analysis job ID

// Trigger orchestrator directly
await processInterviewOrchestratorV2.trigger({
  analysisJobId: interviewId, // Interview ID = Analysis Job ID
  existingInterviewId: interviewId,
  ...
});
```

**Files to update:**
1. `src/trigger/interview/processRecallMeeting.ts` - Remove lines 209-227
2. `src/trigger/interview/uploadMediaAndTranscribe.ts` - Check for analysis_jobs references
3. `src/trigger/interview/generateInterviewInsights.ts` - Update job queries to use interviews table
4. `src/trigger/interview/extractEvidenceAndPeople.ts` - Update job queries
5. `src/trigger/interview/attributeAnswers.ts` - Update job queries
6. `scripts/diagnose-stuck-interview.ts` - Query interviews.conversation_analysis instead
7. `scripts/check-workflow-state.ts` - Query interviews.conversation_analysis instead
8. `supabase/functions/analysis_worker/index.ts` - Assess if still needed, update or remove

### Phase 3: Testing & Validation

**Test Cases:**
1. **Desktop Recording Upload**
   - Record new interview
   - Upload media file
   - Verify orchestrator triggers successfully
   - Verify interview reaches "ready" status

2. **Recall.ai Meeting Import**
   - Import meeting from Recall.ai
   - Verify processRecallMeeting completes
   - Verify orchestrator processes successfully

3. **URL Import**
   - Import interview from URL
   - Verify processing completes

4. **Error Handling**
   - Simulate orchestrator failure
   - Verify interview status set to "error"
   - Verify error message captured in conversation_analysis

**Acceptance Criteria:**
- [ ] All 3 upload flows complete successfully
- [ ] No references to `analysis_jobs` table remain in active code paths
- [ ] Stuck interviews can be repaired via script
- [ ] Error handling properly updates interview status
- [ ] Debug scripts query correct tables

---

## Migration Notes

The original migration (`20251202150000_consolidate_analysis_jobs.sql`) documented the new structure:

```json
interviews.conversation_analysis = {
  "trigger_run_id": "run_abc123",
  "current_step": "evidence_extraction",
  "completed_steps": ["transcription", "upload"],
  "custom_instructions": "Focus on pain points",
  "transcript_data": { ... },
  "workflow_state": { ... },
  "evidence_count": 42,
  "last_error": null
}
```

**Key Insight:** The `analysisJobId` parameter in the orchestrator is now expected to be the **interview ID**, not a separate analysis_jobs.id.

---

## Lessons Learned

1. **Schema migrations must include code audits** - Grep for all table references before dropping
2. **Add deprecation warnings** - Could have added console warnings before dropping table
3. **Integration tests needed** - E2E tests would have caught this immediately
4. **Staged rollout** - Should have feature-flagged the new flow
5. **Better error handling** - Silent failures hide critical bugs

---

## Recommended Actions

### Immediate (Today)
- [ ] Create repair script for stuck interviews
- [ ] Fix `processRecallMeeting.ts` (highest impact)
- [ ] Run repair script on production stuck interviews
- [ ] Deploy fix to production

### Short Term (This Week)
- [ ] Fix remaining 8 files referencing analysis_jobs
- [ ] Add integration tests for upload flows
- [ ] Update debug/support scripts
- [ ] Document new workflow state structure

### Long Term (Next Sprint)
- [ ] Add pre-migration code audits to checklist
- [ ] Improve error visibility (user-facing errors for stuck jobs)
- [ ] Add monitoring/alerting for stuck interviews
- [ ] Consider adding migration validation tests

---

## References

- **Migration:** `supabase/migrations/20251202150000_consolidate_analysis_jobs.sql`
- **Orchestrator:** `src/trigger/interview/v2/orchestrator.ts`
- **State Management:** `src/trigger/interview/v2/state.ts`
- **UI Progress Hook:** `app/hooks/useInterviewProgress.ts`
- **Stuck Interview:** http://localhost:4280/a/d7b69d5e-a952-41a6-931f-e2fed1d82e85/6dbcbb68-0662-4ebc-9f84-dd13b8ff758d/interviews/931e3b81-ef32-48c3-b6f3-382461b362e4

---

**Next Steps:** Awaiting decision on fix priority - immediate repair script vs. comprehensive code fix vs. both.
