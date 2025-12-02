# UI Update Complete ✅

## Summary

Updated the interview detail page to read progress from `interviews.processing_metadata` instead of `analysis_jobs` legacy status fields.

---

## What Changed

### File: `app/hooks/useInterviewProgress.ts`

**Before**: Read from `analysis_jobs` status fields (status, progress, status_detail, current_step)

**After**: Read from `interviews.processing_metadata` JSONB column

### Key Changes

1. **Primary Source** (lines 267-357): Now reads from `interview.processing_metadata`
   - `metadata.current_step` → Current workflow step
   - `metadata.progress` → Progress percentage (0-100)
   - `metadata.status_detail` → Human-readable status
   - `metadata.trigger_run_id` → Link to Trigger.dev run for cancellation
   - `metadata.failed_at` / `metadata.error` → Error state

2. **Fallback Logic** (line 365-366): Skip fallback if `processing_metadata` exists
   - Only uses interview status-based progress when no metadata available
   - Ensures smooth transition for legacy interviews

3. **Status Mapping**:
   - `interview.status === "ready"` → 100% complete
   - `interview.status === "error"` → Show error message
   - `interview.status === "processing"` → Show live progress from metadata

---

## UI Behavior

### During Processing

The UI now displays real-time progress from `processing_metadata`:

```typescript
{
  current_step: "evidence",
  progress: 40,
  status_detail: "Extracting evidence from transcript",
  trigger_run_id: "run_abc123"
}
```

**Displays**:
- Progress bar at 40%
- Label: "Extracting evidence from transcript"
- Cancel button enabled (if trigger_run_id present)

### On Completion

```typescript
{
  current_step: "complete",
  progress: 100,
  completed_at: "2025-12-02T10:30:00Z"
}
```

**Displays**:
- Progress bar at 100%
- Label: "Initial analysis complete!"
- No cancel button

### On Error

```typescript
{
  current_step: "insights",
  progress: 65,
  failed_at: "2025-12-02T10:25:00Z",
  error: "Generate insights failed: API timeout"
}
```

**Displays**:
- Progress bar at 0%
- Label: "Generate insights failed: API timeout"
- Error state styling

---

## Benefits

1. ✅ **Single source of truth**: UI reads from same place as backend writes
2. ✅ **Real-time updates**: No polling Trigger.dev API needed
3. ✅ **Automatic updates**: Supabase realtime subscription picks up changes
4. ✅ **Better error messages**: Shows specific step and error details
5. ✅ **Cancel support**: Uses trigger_run_id from metadata for cancellation

---

## Testing

### Test Real-time Updates

1. Start a new interview upload with media
2. Watch the interview detail page
3. Progress should update automatically through:
   - Upload & Transcribe (0-30%)
   - Extract Evidence (30-50%)
   - Generate Insights (50-75%)
   - Assign Personas (75-85%)
   - Attribute Answers (85-95%)
   - Finalize (95-100%)

### Test Error Handling

1. Trigger an interview processing error (e.g., invalid media URL)
2. UI should show:
   - Red error state
   - Specific error message from `processing_metadata.error`
   - Failed at timestamp

### Test Legacy Interviews

1. Find an interview processed before this update (no processing_metadata)
2. UI should fall back to status-based progress
3. No errors in console

---

## Migration Notes

### Existing Interviews

Interviews processed before this update will:
- Have no `processing_metadata` column data
- Fall back to `interview.status` for progress display
- Work correctly without requiring reprocessing

### New Interviews

All new interviews (processed via v2 orchestrator) will:
- Have `processing_metadata` populated
- Show detailed real-time progress
- Support cancellation via trigger_run_id

---

## Related Files

- ✅ `app/hooks/useInterviewProgress.ts` - Updated to read from processing_metadata
- ✅ `app/features/interviews/pages/detail.tsx` - Uses useInterviewProgress hook (no changes needed)
- ✅ `supabase/schemas/20_interviews.sql` - Contains processing_metadata column definition
- ✅ All v2 tasks write to processing_metadata (Phase 3 complete)

---

## Conclusion

The UI now displays real-time progress directly from `interviews.processing_metadata`, completing the full circle:

1. **Backend writes**: v2 tasks update processing_metadata
2. **Database updates**: Triggers ensure consistency
3. **Frontend reads**: useInterviewProgress reads processing_metadata
4. **User sees**: Real-time progress without polling

The interview pipeline is now fully integrated with a single source of truth for progress tracking.
