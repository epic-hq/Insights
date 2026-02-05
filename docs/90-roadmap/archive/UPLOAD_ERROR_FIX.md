# Upload Error Fix - upload_jobs Table Dropped

## Error Details

**Error Message**:
```
ERROR  Assembly AI submission failed: Failed to create upload job: undefined
    at action (app/routes/api.onboarding-start.tsx:803:17)
```

**Context**:
- Upload to R2 succeeds ✅
- Assembly AI job creation succeeds ✅
- Trying to create `upload_jobs` record fails ❌
- `upload_jobs` table was **dropped** in migration `20251202133000_drop_upload_jobs.sql`

## Root Cause

Migration `20251202133000_drop_upload_jobs.sql` dropped the `upload_jobs` table because it was replaced by `interviews.processing_metadata` JSONB column.

**From migration comments**:
```sql
-- Drop upload_jobs table
-- This table has been fully replaced by interviews.processing_metadata
-- All upload progress tracking now happens via processing_metadata JSONB column
```

However, the application code in **8 files** still references `upload_jobs`:

1. ❌ `app/routes/api.onboarding-start.tsx` - Lines 806-824 (trying to insert)
2. ❌ `app/routes/api.fix-stuck-interview.tsx` - Likely references
3. ❌ `app/routes/api.assemblyai-webhook.tsx` - Likely reads/updates
4. ❌ `app/routes/api.assemblyai-webhook.test.ts` - Test references
5. ❌ `app/test/integration/webhook-idempotency.integration.test.ts` - Test references
6. ❌ `app/test/integration/onboarding-pipeline.integration.test.ts` - Test references
7. ⚠️ `app/types/supabase.types.ts` - Type definitions (auto-generated, will update)
8. ⚠️ `app/database.types.ts` - Type definitions (auto-generated, will update)

## Required Fix

### 1. Update `api.onboarding-start.tsx` (Lines 806-824)

**Current Code** (BROKEN):
```typescript
// Create upload_job to track transcription
const { data: uploadJob, error: uploadJobError } = await supabaseAdmin
  .from("upload_jobs")
  .insert({
    interview_id: interview.id,
    file_name: file.name,
    file_type: file.type,
    external_url: presignedUrl,
    assemblyai_id: transcriptData.id,
    custom_instructions: customInstructions,
    status: "in_progress" as const,
    status_detail: "Transcribing with Assembly AI",
    created_by: user.sub,
  })
  .select()
  .single()

if (uploadJobError || !uploadJob) {
  throw new Error(`Failed to create upload job: ${uploadJobError?.message}`)
}
```

**New Code** (FIXED):
```typescript
// Update interview processing_metadata to track transcription
const { error: metadataError } = await supabaseAdmin
  .from("interviews")
  .update({
    processing_metadata: {
      upload: {
        file_name: file.name,
        file_type: file.type,
        external_url: presignedUrl,
        r2_key: r2Key,
        uploaded_at: new Date().toISOString(),
      },
      transcription: {
        assemblyai_id: transcriptData.id,
        status: "in_progress",
        status_detail: "Transcribing with Assembly AI",
        started_at: new Date().toISOString(),
      },
      custom_instructions: customInstructions,
    },
  })
  .eq("id", interview.id)

if (metadataError) {
  throw new Error(`Failed to update interview metadata: ${metadataError.message}`)
}
```

### 2. Update `api.assemblyai-webhook.tsx`

**Likely Current Code**:
```typescript
// Find upload_job by assemblyai_id
const { data: uploadJob } = await supabaseAdmin
  .from("upload_jobs")
  .select()
  .eq("assemblyai_id", transcript.id)
  .single()

// Update upload_job status
await supabaseAdmin
  .from("upload_jobs")
  .update({ status: "completed" })
  .eq("id", uploadJob.id)
```

**New Code**:
```typescript
// Find interview by assemblyai_id in processing_metadata
const { data: interview } = await supabaseAdmin
  .from("interviews")
  .select("id, processing_metadata")
  .eq("processing_metadata->transcription->assemblyai_id", transcript.id)
  .single()

// Update processing_metadata
const currentMetadata = interview.processing_metadata || {}
await supabaseAdmin
  .from("interviews")
  .update({
    processing_metadata: {
      ...currentMetadata,
      transcription: {
        ...(currentMetadata.transcription || {}),
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    },
  })
  .eq("id", interview.id)
```

### 3. Update `api.fix-stuck-interview.tsx`

Need to read this file to understand current usage and update accordingly.

### 4. Update Tests

All test files need to be updated to:
- Remove `upload_jobs` table references
- Use `interviews.processing_metadata` instead
- Update assertions to check JSONB fields

### 5. Regenerate Types

After fixing code:
```bash
npx supabase gen types typescript --local > app/database.types.ts
```

This will remove `upload_jobs` types from generated files.

## Migration Path

### Option 1: Fix Code (Recommended)
1. Update all 8 files to use `processing_metadata`
2. Regenerate TypeScript types
3. Test upload flow end-to-end
4. Deploy fix

### Option 2: Rollback Migration (NOT Recommended)
1. Revert `20251202133000_drop_upload_jobs.sql`
2. Recreate `upload_jobs` table
3. Keep dual-write to both `upload_jobs` and `processing_metadata`
4. Gradually migrate code over time

**Recommendation**: Option 1 - The migration was correct, code just needs updating.

## Processing Metadata Schema

The `interviews.processing_metadata` JSONB column should follow this structure:

```typescript
interface ProcessingMetadata {
  upload?: {
    file_name: string
    file_type: string
    external_url: string
    r2_key?: string
    uploaded_at: string
  }
  transcription?: {
    assemblyai_id: string
    status: "pending" | "in_progress" | "completed" | "failed"
    status_detail?: string
    started_at?: string
    completed_at?: string
    error?: string
  }
  analysis?: {
    status: "pending" | "in_progress" | "completed" | "failed"
    started_at?: string
    completed_at?: string
    stages?: {
      evidence_extraction?: { status: string; completed_at?: string }
      theme_clustering?: { status: string; completed_at?: string }
      lens_analysis?: { status: string; completed_at?: string }
    }
  }
  custom_instructions?: string
}
```

## Testing Checklist

After fixing code, test:
- [ ] Upload new interview via onboarding flow
- [ ] Verify R2 upload succeeds
- [ ] Verify Assembly AI job creation succeeds
- [ ] Verify `processing_metadata` is updated correctly
- [ ] Verify webhook can find interview by `assemblyai_id`
- [ ] Verify webhook updates transcription status
- [ ] Verify analysis pipeline triggers correctly
- [ ] Check all integration tests pass

## Files to Update

**Priority 1 (Breaks uploads)**:
1. `app/routes/api.onboarding-start.tsx` - Lines 806-824 ⚠️ URGENT
2. `app/routes/api.assemblyai-webhook.tsx` - Webhook handler ⚠️ URGENT

**Priority 2 (Breaks existing flows)**:
3. `app/routes/api.fix-stuck-interview.tsx` - Stuck interview fixer

**Priority 3 (Tests)**:
4. `app/routes/api.assemblyai-webhook.test.ts`
5. `app/test/integration/webhook-idempotency.integration.test.ts`
6. `app/test/integration/onboarding-pipeline.integration.test.ts`

**Auto-Generated (Regenerate after fixes)**:
7. `app/types/supabase.types.ts`
8. `app/database.types.ts`

---

**Created**: 2025-12-02
**Status**: ❌ BLOCKING UPLOADS - Requires immediate fix
**Assignee**: Next task
**Priority**: 🔴 URGENT
