# Stuck Interview Fix - Complete Solution

## Problem Identified

Interview `156715a5-093e-4303-8fbf-6165f9a5b5fd` was stuck in limbo because:

1. **Status was likely `'transcribing'`, `'processing'`, or `'uploaded'`** - not in a terminal state
2. **The "Reprocess" button only appeared when**:
   - `interview.hasTranscript` OR
   - `interview.hasFormattedTranscript` OR
   - `interview.status === "error"`
3. **Stuck interviews in intermediate states couldn't be fixed** because the button was hidden

## Solution Implemented

### 1. **Expanded Button Visibility Condition** (`detail.tsx` line 1568-1573)

Changed from:
```typescript
{(interview.hasTranscript || interview.hasFormattedTranscript || interview.status === "error") && (
```

To:
```typescript
{(interview.hasTranscript ||
  interview.hasFormattedTranscript ||
  interview.status === "error" ||
  interview.status === "transcribing" ||
  interview.status === "processing" ||
  interview.status === "uploaded") && (
```

**Why**: Now the "Reprocess" button appears for interviews stuck in intermediate processing states.

### 2. **Added "Fix Stuck Interview Status" Menu Item** (`detail.tsx` line 1586-1612)

Added a new dropdown menu item that:
- **Only appears** when `status` is `'transcribing'`, `'processing'`, or `'uploaded'`
- **Calls** the existing `/api/fix-stuck-interview` endpoint
- **Updates** the interview status to `'ready'` and marks workflow as complete
- **Revalidates** the page to show updated state
- **Styled** with orange color (🔧) to indicate it's a fix/repair action

### 3. **Existing Fix API** (`/api/fix-stuck-interview`)

The endpoint already exists and:
- Checks if interview has a transcript
- Updates `status` to `'ready'` if transcript exists
- Updates `conversation_analysis` metadata to mark workflow as complete
- Returns success/error response

## How to Use

1. **Navigate to the stuck interview**: http://localhost:4280/a/{accountId}/{projectId}/interviews/156715a5-093e-4303-8fbf-6165f9a5b5fd

2. **Click the "Reprocess" button** (three dots icon) - it should now be visible

3. **Select "🔧 Fix Stuck Interview Status"** from the dropdown menu

4. **Wait for confirmation** - the page will reload with updated status

5. **After fixing**, the interview should show:
   - Status: `'ready'`
   - Reprocess options available for rerunning transcription/evidence/themes

## Interview Status Flow

Valid interview statuses (from `supabase/schemas/20_interviews.sql`):
- `'draft'` - Initial state
- `'scheduled'` - Scheduled for future
- `'uploading'` - File upload in progress
- `'uploaded'` - File uploaded, ready for transcription ⚠️ **Can get stuck here**
- `'transcribing'` - Transcription in progress ⚠️ **Can get stuck here**
- `'transcribed'` - Transcription complete
- `'processing'` - Analysis in progress ⚠️ **Can get stuck here**
- `'ready'` - ✅ **Complete and ready for viewing**
- `'tagged'` - Additional tagging applied
- `'archived'` - Archived
- `'error'` - ❌ **Error state**

## What Gets Fixed

When you click "Fix Stuck Interview Status", the API:

1. **Checks** if interview has a transcript
2. **Updates** `status` from stuck state → `'ready'`
3. **Updates** `conversation_analysis` JSON field:
   ```json
   {
     "status_detail": "Manually marked as complete",
     "current_step": "complete",
     "completed_steps": ["transcription", "analysis"]
   }
   ```

## Prevention

To prevent interviews from getting stuck in the future:
- Ensure Trigger.dev workflows complete properly
- Monitor `conversation_analysis.status` field
- Check for failed Trigger.dev runs
- Consider adding timeout logic to auto-fix stuck interviews after X hours

## Files Modified

1. `/app/features/interviews/pages/detail.tsx` - Added button visibility and fix menu item
2. `/app/routes/api.fix-stuck-interview.tsx` - Already existed, no changes needed

## Testing

After applying this fix, test with:
1. A stuck interview in `'transcribing'` status
2. A stuck interview in `'processing'` status
3. A stuck interview in `'uploaded'` status
4. Verify button appears and fix works for all cases
