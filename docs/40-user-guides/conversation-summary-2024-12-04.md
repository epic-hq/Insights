# Conversation Summary: AI Takeaways Regeneration & People Associations

## Overview

This session focused on improving the AI Interview summary system and adding people association management for interviews.

## Changes Made

### 1. Fixed AI Summary Evidence References

**Problem**: AI summaries were referencing "Evidence #213" which didn't map to anything usable by mastra tools.

**Solution** (`baml_src/conversation_takeaways.baml`):
- Changed from `Evidence #{{ loop.index }} (ID: {{ item.id[:8] }})` to just `ID: {{ item.id[:8] }}`
- Added guidance: "Reference what was discussed, not evidence numbers"
- Simplified tone throughout to practical business English

### 2. AI Summary Regeneration System

Created ability to regenerate AI summaries with optional custom instructions.

**Files Created**:
- `src/trigger/sales/regenerateAISummary.ts` - Trigger.dev task for regeneration
- `app/routes/api.regenerate-ai-summary.tsx` - API endpoint

**UI Changes** (`app/features/interviews/pages/detail.tsx`):
- Added dropdown button on "AI Takeaways" section
- Popover with textarea for custom instructions
- Two buttons: "Regenerate" and "Regenerate with Instructions"

### 3. Custom Instructions Fix

**Problem**: Custom instructions were being appended to output instead of guiding generation.

**Solution**:
- Added `custom_instructions: string?` parameter to BAML function
- Moved custom instructions to appear prominently before Task section with **IMPORTANT:** prefix
- Added explicit instruction: "adapt the content, tone, language, and focus according to the custom instructions"
- Removed appending logic from trigger task
- Updated both `regenerateAISummary.ts` and `generateSalesLens.ts` to pass the parameter

### 4. People Associations Management

**Problem**: "Participant 1" from different interviews could overlap, causing wrong person associations.

**Solution**: Created manual management UI instead of relying on automatic matching.

**Files Created**:
- `app/features/interviews/components/ManagePeopleAssociations.tsx` - Component for linking speakers to people
- `app/routes/api.link-interview-participant.tsx` - API endpoint for link/unlink operations

**Features**:
- Visual list of all interview participants/speakers
- Searchable Command dropdown to link existing people
- "Create new person" button in search
- Link/unlink functionality

### 5. Route Registration

Added new API routes to `app/routes.ts`:
```typescript
route("api/regenerate-ai-summary", "./routes/api.regenerate-ai-summary.tsx"),
route("api/link-interview-participant", "./routes/api.link-interview-participant.tsx"),
```

## Key Files Modified

| File | Changes |
|------|---------|
| `baml_src/conversation_takeaways.baml` | Added custom_instructions param, strengthened prompt, simplified tone |
| `src/trigger/sales/regenerateAISummary.ts` | New file - regeneration task |
| `src/trigger/sales/generateSalesLens.ts` | Added null param for custom_instructions |
| `app/routes/api.regenerate-ai-summary.tsx` | New file - API endpoint |
| `app/routes/api.link-interview-participant.tsx` | New file - API endpoint |
| `app/features/interviews/components/ManagePeopleAssociations.tsx` | New file - UI component |
| `app/features/interviews/pages/detail.tsx` | Added regeneration UI dropdown |
| `app/routes.ts` | Registered new API routes |

## Pending Work

1. **Auto-refresh**: Interview detail page doesn't automatically refresh when regeneration completes. Consider using `useRevalidator()` or real-time subscriptions.

2. **Integrate ManagePeopleAssociations**: Component is created but needs to be wired into the interview detail page with proper data loading.

## Testing Notes

- Custom instructions should now properly guide AI generation (tested with "output in Spanish" instruction)
- The regeneration task is `sales.regenerate-ai-summary` in Trigger.dev
