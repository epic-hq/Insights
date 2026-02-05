# Fixes Summary

## Issue 1: Migration Table Out of Sync ✅ FIXED

### Problem
```
20251202       |                | 20251202
20251202001726 | 20251202001726 | 2025-12-02 00:17:26
```

The migration `20251202_drop_upload_jobs.sql` was missing a full timestamp, causing conflicts.

### Fix
1. ✅ Renamed migration file: `20251202_drop_upload_jobs.sql` → `20251202133000_drop_upload_jobs.sql`
2. ✅ Repaired migration history: `supabase migration repair --status applied 20251202133000`
3. ✅ Reverted phantom migration: `supabase migration repair --status reverted 20251202`

### Result
Migration table is now properly synced with no conflicts.

---

## Issue 2: Evidence Anchor Timestamps Not Working ✅ FIXED

### Problem
When navigating to an evidence page with `?t=332` parameter (e.g., `http://localhost:4280/.../evidence/xxx?t=332`), the media player was not jumping to the specified timestamp.

### Root Cause
**File**: `app/features/evidence/pages/evidenceDetail.tsx` (line 42)

The loader was creating an anchor with:
```typescript
anchorOverride = {
  type: "media",
  start: `${seconds * 1000}ms`, // ❌ Wrong format
  end: null,
}
```

But `getAnchorStartSeconds()` in `app/utils/media-url.client.ts` only recognizes:
```typescript
export function getAnchorStartSeconds(anchor: MediaAnchor): number {
  if (anchor.start_ms !== undefined) return Math.floor(anchor.start_ms / 1000)
  if (anchor.start_seconds !== undefined) return anchor.start_seconds
  return 0 // ❌ Returns 0 for unrecognized formats
}
```

### Fix
**File**: `app/features/evidence/pages/evidenceDetail.tsx` (lines 40-44)

Changed anchor format to match expected interface:
```typescript
anchorOverride = {
  type: "media",
  start_ms: seconds * 1000,      // ✅ Correct format (milliseconds)
  start_seconds: seconds,         // ✅ Compatibility fallback
}
```

### How It Works Now

1. **User clicks evidence link with timestamp**: `?t=332`
2. **Loader parses parameter**: `332` seconds
3. **Creates anchor override**:
   ```typescript
   {
     type: "media",
     start_ms: 332000,  // 332 seconds in milliseconds
     start_seconds: 332
   }
   ```
4. **Prepends to anchors array**: `[anchorOverride, ...existingAnchors]`
5. **EvidenceCard renders**: Uses first anchor (the override)
6. **MediaAnchorPlayer extracts time**: `getAnchorStartSeconds()` returns `332`
7. **SimpleMediaPlayer starts at**: 332 seconds ✅

### Result
Evidence pages now correctly jump to the specified timestamp when accessed via `?t=` parameter.

---

## Testing

### Test Migration Sync
```bash
npx supabase migration list
# Should show no conflicts, all migrations in order
```

### Test Evidence Timestamps
1. Navigate to: `http://localhost:4280/a/[accountId]/[projectId]/evidence/[evidenceId]?t=332`
2. Media player should automatically seek to 5:32 (332 seconds)
3. Clock icon should show correct timestamp
4. Play button should start from the specified time

---

## Files Modified

### Migration Fix
- ✅ Renamed: `supabase/migrations/20251202_drop_upload_jobs.sql` → `20251202133000_drop_upload_jobs.sql`

### Evidence Timestamp Fix
- ✅ `app/features/evidence/pages/evidenceDetail.tsx` - Fixed anchor format (lines 40-44)

---

## Related Files (No Changes Needed)

These files work correctly with the fix:
- `app/utils/media-url.client.ts` - Already expects `start_ms` / `start_seconds`
- `app/features/evidence/components/EvidenceCard.tsx` - Uses first anchor correctly
- `app/components/ui/SimpleMediaPlayer.tsx` - Receives correct startTime

---

## Conclusion

Both issues resolved:
1. ✅ Migration table synced properly
2. ✅ Evidence timestamps now work correctly with `?t=` parameter
