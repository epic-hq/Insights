# Interview Processing Optimization

## Overview
Refactored interview processing to eliminate code duplication and modernize AssemblyAI integration.

## Problems Identified

### 1. Code Duplication in Regeneration
**Issue:** `processInterviewTranscriptWithClient` duplicated the entire processing pipeline that already existed as Trigger.dev tasks.

**Duplicated Code:**
- `uploadMediaAndTranscribeCore` → Already in `uploadMediaAndTranscribeTask`
- `extractEvidenceAndPeopleCore` → Already in `extractEvidenceAndPeopleTask`
- `analyzeThemesAndPersonaCore` → Already in `analyzeThemesAndPersonaTask`
- `attributeAnswersAndFinalizeCore` → Already in `attributeAnswersTask`

**Impact:**
- ❌ Maintenance burden: Changes needed in two places
- ❌ Bug risk: Fixes might not be applied consistently
- ❌ Testing complexity: Two code paths to test
- ❌ DRY violation: Clear anti-pattern

### 2. Manual AssemblyAI Integration
**Issue:** Using raw `fetch()` calls instead of the official AssemblyAI SDK.

**Problems:**
- Manual polling logic (360 attempts × 5s intervals)
- No type safety for API responses
- Manual error handling
- Verbose code (~80 lines for what SDK does in ~40)

## Solutions Implemented

### 1. Refactored Regeneration to Use Trigger.dev Tasks

**Before:**
```typescript
await processInterviewTranscriptWithClient({
  metadata,
  mediaUrl: interview.media_url || "",
  transcriptData,
  userCustomInstructions: undefined,
  client: supabase,
  existingInterviewId: interview.id,
})
```

**After:**
```typescript
const result = await tasks.trigger<typeof uploadMediaAndTranscribeTask>(
  "interview.upload-media-and-transcribe",
  {
    metadata,
    mediaUrl: interview.media_url || "",
    transcriptData,
    userCustomInstructions: undefined,
    existingInterviewId: interview.id,
  }
)
```

**Benefits:**
- ✅ Single source of truth for processing logic
- ✅ Consistent behavior between new uploads and regeneration
- ✅ Automatic retry/error handling from Trigger.dev
- ✅ Progress tracking and observability
- ✅ No code duplication

### 2. Migrated to AssemblyAI SDK

**Before:**
```typescript
// Manual fetch to create transcript
const createResp = await fetch(`${ASSEMBLY_API_URL}/transcript`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: apiKey },
  body: JSON.stringify({ audio_url: url, speaker_labels: true, ... }),
})

// Manual polling loop
while (attempts < maxAttempts) {
  await new Promise((r) => setTimeout(r, 5000))
  const statusResp = await fetch(`${ASSEMBLY_API_URL}/transcript/${id}`, ...)
  // ... manual status checking
}
```

**After:**
```typescript
const client = new AssemblyAI({ apiKey })

// SDK handles polling automatically
const transcript = await client.transcripts.transcribe({
  audio: url,
  speech_model: "slam-1", // Latest high-accuracy model
  speaker_labels: true,
  iab_categories: true,
  format_text: true,
  punctuate: true,
  auto_chapters: true,
})
```

**Benefits:**
- ✅ Type-safe API responses
- ✅ Automatic polling with smart defaults
- ✅ Built-in error handling
- ✅ Cleaner, more maintainable code
- ✅ Better IDE autocomplete and documentation
- ✅ Reduced from ~80 lines to ~40 lines
- ✅ Using slam-1 speech model for better accuracy

### 3. Eliminated Redundant File Upload

**Before:**
Files stored on Cloudflare R2 were being downloaded and re-uploaded to AssemblyAI:
```typescript
// 1. Fetch from R2
const remoteResp = await fetch(r2Url)

// 2. Upload to AssemblyAI (unnecessary!)
const uploadUrl = await client.files.upload(remoteResp.body)

// 3. Transcribe
return await transcribeAudioFromUrl(uploadUrl)
```

**After:**
R2 URLs (presigned or public) are passed directly to AssemblyAI:
```typescript
// R2 URLs are already accessible, pass directly to AssemblyAI
return await transcribeAudioFromUrl(r2Url)
```

**Benefits:**
- ✅ No redundant file transfer
- ✅ Faster processing (no upload delay)
- ✅ Lower bandwidth usage
- ✅ Simpler code flow
- ✅ Works with R2 presigned URLs (similar to S3 presigned URLs)

## Files Modified

### 1. `/app/utils/assemblyai.server.ts`
- Replaced manual `fetch()` calls with AssemblyAI SDK
- Added `getAssemblyAIClient()` helper function
- Simplified `transcribeAudioFromUrl()` from 80+ lines to ~40 lines
- Removed redundant file upload - now passes R2 URLs directly
- Added `speech_model: "slam-1"` for better transcription accuracy

### 2. `/app/utils/regenerateEvidence.server.ts`
- Removed dependency on `processInterviewTranscriptWithClient`
- Now triggers `uploadMediaAndTranscribeTask` via Trigger.dev
- Added better logging for regeneration operations
- Maintains same external API but uses task-based implementation

## Architecture Benefits

### Single Source of Truth
All interview processing now flows through Trigger.dev tasks:
```
New Upload → uploadMediaAndTranscribeTask → extractEvidenceAndPeopleTask → ...
Regenerate → uploadMediaAndTranscribeTask → extractEvidenceAndPeopleTask → ...
```

### Consistent Behavior
- Same retry logic for both paths
- Same error handling
- Same progress tracking
- Same database operations

### Better Observability
- All processing visible in Trigger.dev dashboard
- Centralized error tracking
- Progress monitoring
- Run history and debugging

## Migration Notes

### Breaking Changes
None - external API remains the same.

### Behavioral Changes
1. **Regeneration is now async**: Returns immediately with Trigger.dev run ID instead of waiting for completion
2. **Better error handling**: Trigger.dev provides automatic retries and error tracking
3. **Progress tracking**: Can monitor regeneration progress in Trigger.dev dashboard

### Testing Considerations
- Test regeneration triggers Trigger.dev tasks correctly
- Verify AssemblyAI SDK handles all transcript formats
- Ensure error handling works with SDK exceptions

## Performance Impact

### AssemblyAI SDK
- **Neutral**: SDK uses same polling strategy, just cleaner implementation
- **Better**: Type safety prevents runtime errors
- **Better**: Built-in retry logic for transient failures

### Trigger.dev Tasks
- **Better**: Regeneration no longer blocks HTTP requests
- **Better**: Automatic retry on failures
- **Better**: Can process multiple interviews in parallel

## Future Improvements

1. **Batch Regeneration**: Use `tasks.batchTrigger()` for multiple interviews
2. **Progress Webhooks**: Add webhook notifications for regeneration completion
3. **Selective Regeneration**: Add options to regenerate only specific stages
4. **Cost Tracking**: Add AssemblyAI usage tracking via SDK

## Related Documentation
- [Trigger.dev Tasks Documentation](../AGENTS.md#trigger-dev-basic-tasks-v4)
- [AssemblyAI SDK Documentation](https://www.assemblyai.com/docs/getting-started/transcribe-an-audio-file)
- [Interview Processing Flows](../interview-processing-flows.md)
