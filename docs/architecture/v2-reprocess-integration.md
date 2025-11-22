# V2 Reprocess Commands Integration

## Overview

All interview reprocess commands in the detail page now support the v2 modular workflow when `ENABLE_MODULAR_WORKFLOW=true`. This provides better error recovery, state management, and resume capabilities.

## Reprocess Commands

### 1. "Rerun Transcription" (`/api.analysis-retry`)

**What it does:**
- Fully re-processes the interview from the beginning
- Re-transcribes audio if available
- Re-extracts evidence
- Re-generates insights/themes
- Re-assigns personas
- Re-attributes answers

**V2 Integration:** ✅ Complete
- Uses `createAndProcessAnalysisJob()` which checks the feature flag
- Automatically routes to v2 orchestrator when enabled
- Starts from step: `upload` (beginning)

**Files:**
- Route: `app/routes/api.analysis-retry.tsx`
- Integration: `app/utils/processInterviewAnalysis.server.tsx:173-203`

---

### 2. "Rerun Evidence Collection" (`/api.reprocess-evidence`)

**What it does:**
- Skips transcription (uses existing transcript)
- Re-extracts evidence units from transcript
- Re-generates insights/themes
- Re-assigns personas
- Re-attributes answers

**V2 Integration:** ✅ Complete
- Checks `ENABLE_MODULAR_WORKFLOW` feature flag
- Routes to v2 orchestrator with `resumeFrom: "evidence"`
- Skips upload/transcription steps
- Falls back to v1 `interview.extract-evidence-and-people` when flag disabled

**Files:**
- Route: `app/routes/api.reprocess-evidence.tsx:84-145`

**Key Changes:**
```typescript
if (useV2Workflow) {
  handle = await tasks.trigger("interview.v2.orchestrator", {
    analysisJobId,
    metadata,
    transcriptData,
    mediaUrl,
    existingInterviewId,
    resumeFrom: "evidence", // Skip upload/transcription
  })
} else {
  // V1 fallback
  handle = await tasks.trigger("interview.extract-evidence-and-people", {...})
}
```

---

### 3. "Re-analyze Themes" (`/api.reanalyze-themes`)

**What it does:**
- Skips transcription and evidence extraction (uses existing evidence)
- Re-generates insights/themes from existing evidence
- Re-assigns personas
- Re-attributes answers

**V2 Integration:** ✅ Complete
- Checks `ENABLE_MODULAR_WORKFLOW` feature flag
- Routes to v2 orchestrator with `resumeFrom: "insights"`
- Loads existing evidence from database
- Pre-populates workflow state with evidence units
- Skips upload/transcription/evidence steps
- Falls back to v1 `interview.analyze-themes-and-persona` when flag disabled

**Files:**
- Route: `app/routes/api.reanalyze-themes.tsx:319-395`

**Key Changes:**
```typescript
if (useV2Workflow) {
  // Pre-populate workflow state with existing evidence
  await admin.from("analysis_jobs").update({
    workflow_state: {
      interviewId,
      evidenceIds,
      evidenceUnits: validatedEvidenceUnits,
      personId: primaryPersonId,
      completedSteps: ["upload", "evidence"],
      currentStep: "insights",
    }
  })

  handle = await tasks.trigger("interview.v2.orchestrator", {
    analysisJobId,
    metadata,
    transcriptData,
    mediaUrl,
    existingInterviewId,
    userCustomInstructions,
    resumeFrom: "insights", // Skip upload/transcription/evidence
  })
} else {
  // V1 fallback
  handle = await tasks.trigger("interview.analyze-themes-and-persona", {...})
}
```

---

## Benefits of V2 Integration

### 1. **Consistent Resume Points**
All reprocess commands use the same orchestrator with different `resumeFrom` values:
- Full reprocess: starts from `upload`
- Evidence reprocess: starts from `evidence`
- Theme reprocess: starts from `insights`

### 2. **State Persistence**
- Workflow state stored in `analysis_jobs.workflow_state`
- Can resume from failures without re-running successful steps
- Clear progress tracking through the pipeline

### 3. **Better Error Recovery**
- If theme generation fails, state is saved
- Can retry just the failed step without re-extracting evidence
- Comprehensive error logging

### 4. **Gradual Rollout**
- Single feature flag controls all workflows
- Easy A/B testing between v1 and v2
- Safe fallback to v1 if issues arise

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Interview Detail Page - Reprocess Menu                    │
└─────────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬────────────────┐
        │                │                │                │
        ▼                ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Rerun        │ │ Rerun        │ │ Re-analyze   │ │ (Future      │
│ Transcription│ │ Evidence     │ │ Themes       │ │ commands)    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │                │                │                │
        │                │                │                │
        ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│  Feature Flag Check: ENABLE_MODULAR_WORKFLOW               │
└─────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │ true                        │ false
          ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│ V2 Orchestrator     │       │ V1 Legacy Tasks     │
│ with resumeFrom:    │       │ (fallback)          │
│ - upload            │       │ - uploadMediaAnd... │
│ - evidence          │       │ - extractEvidence...│
│ - insights          │       │ - analyzeThemes...  │
└─────────────────────┘       └─────────────────────┘
```

---

## Testing

### Enable V2 Workflow
```bash
export ENABLE_MODULAR_WORKFLOW=true
```

### Test Each Reprocess Command

1. **Test "Rerun Transcription":**
   - Upload an interview with audio
   - Click "Reprocess" → "Rerun Transcription"
   - Verify v2 orchestrator is used (check logs)
   - Verify all steps run from beginning

2. **Test "Rerun Evidence Collection":**
   - Use an interview with existing transcript
   - Click "Reprocess" → "Rerun Evidence Collection"
   - Verify logs show: `Using v2 orchestrator with resumeFrom: 'evidence'`
   - Verify transcription is skipped

3. **Test "Re-analyze Themes":**
   - Use an interview with existing evidence
   - Click "Reprocess" → "Re-analyze Themes"
   - Verify logs show: `Using v2 orchestrator with resumeFrom: 'insights'`
   - Verify evidence extraction is skipped

### Verify Fallback

1. Disable v2: `export ENABLE_MODULAR_WORKFLOW=false`
2. Test each command
3. Verify v1 tasks are used (check logs for task names)

---

## Migration Notes

### Database Requirements
Ensure the workflow state migration is applied:
```bash
supabase db push
```

Required columns in `analysis_jobs`:
- `workflow_state` (jsonb)
- `completed_steps` (text[])
- `current_step` (text)
- `evidence_count` (integer)

### Monitoring

Watch for these log messages:
- ✅ `Using v2 orchestrator with resumeFrom: 'evidence'`
- ✅ `Using v2 orchestrator with resumeFrom: 'insights'`
- ⚠️ `Using v1 extract-evidence-and-people task`
- ⚠️ `Using v1 analyze-themes-and-persona task`

---

## Future Enhancements

### Potential Additional Resume Points

1. **"Re-assign Personas"** - `resumeFrom: "personas"`
   - Skip everything except persona assignment
   - Useful for testing persona changes

2. **"Re-attribute Answers"** - `resumeFrom: "answers"`
   - Skip everything except answer attribution
   - Useful when project questions change

3. **"Finalize Only"** - `resumeFrom: "finalize"`
   - Re-run analytics and side effects
   - Useful for fixing PostHog events

---

## Summary

✅ **All reprocess commands now support v2 modular workflow**
✅ **Feature flag enables gradual rollout**
✅ **Resume capability reduces wasted compute**
✅ **State persistence enables better error recovery**
✅ **Consistent architecture across all reprocess paths**

The v2 integration is **complete and ready for testing** when `ENABLE_MODULAR_WORKFLOW=true`.
