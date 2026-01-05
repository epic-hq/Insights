# Project Settings Architecture

## Overview

Project-level settings (research_mode, interview_duration, etc.) are now managed with a clear single source of truth pattern.

## Architecture Decision

**Goals Page = Source of Truth**

- **ProjectGoalsScreenRedesigned** is the single place to configure project settings
- **InterviewQuestionsManager** reads these settings but does not modify them
- This creates a clear mental model: "Configure project → Select questions"

## Database Storage

Settings are stored in `project_sections` table:
- **kind**: `"settings"`
- **meta**: JSON object containing all settings

### Standardized Field Names

| Setting | Field Name | Type | Values |
|---------|-----------|------|--------|
| Research Mode | `research_mode` | string | `"exploratory"`, `"validation"`, `"user_testing"` |
| Interview Duration | `interview_duration` | number | 15, 30, 45, 60 (minutes) |
| Target Conversations | `target_conversations` | number | 1-100 |
| Custom Instructions | `custom_instructions` | string | Free text |
| Familiarity | `familiarity` | string | `"cold"`, `"warm"` |
| Go Deep Mode | `goDeepMode` | boolean | true/false |

### Legacy Field Names (Supported for Backward Compatibility)

- `timeMinutes` → now `interview_duration`
- `conversation_type` → now `research_mode`
- `customInstructions` → now `custom_instructions`

## Data Flow

```
┌─────────────────────────────┐
│  ProjectGoalsScreen         │
│  (Goals Page)               │
│                             │
│  - User configures settings │
│  - Saves to DB via          │
│    saveProjectSection()     │
│                             │
│  kind = "settings"          │
└──────────────┬──────────────┘
               │
               │ Saves to DB
               ▼
┌─────────────────────────────┐
│  project_sections           │
│  kind = "settings"          │
│  meta = {                   │
│    research_mode,           │
│    interview_duration,      │
│    ...                      │
│  }                          │
└──────────────┬──────────────┘
               │
               │ Reads from DB
               ▼
┌─────────────────────────────┐
│  InterviewQuestionsManager  │
│  (Questions Page)           │
│                             │
│  - Loads settings from DB   │
│  - Uses as constraints      │
│  - Does NOT modify          │
└─────────────────────────────┘
```

## Implementation Details

### Goals Page (Write)

```typescript
// ProjectGoalsScreenRedesigned.tsx
const saveSettings = useCallback((updates: {
  target_conversations?: number
  research_mode?: ResearchMode
  interview_duration?: number
}) => {
  const payload = updates.research_mode
    ? { ...updates, conversation_type: updates.research_mode }
    : updates
  saveProjectSection("settings", payload)
}, [saveProjectSection])
```

### Questions Page (Read)

```typescript
// InterviewQuestionsManager.tsx
const loadQuestions = useCallback(async () => {
  // Load settings from kind="settings" (source of truth)
  const settingsRes = await supabase
    .from("project_sections")
    .select("meta")
    .eq("project_id", projectId)
    .eq("kind", "settings")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const settingsMeta = (settingsRes.data?.meta as Record<string, unknown>) || {}
  
  // Support both new and legacy field names
  const interviewDuration = 
    (settingsMeta.interview_duration as number | undefined) ?? 
    (settingsMeta.timeMinutes as number | undefined)
  
  if (typeof interviewDuration === "number") {
    setTimeMinutes(interviewDuration)
  }
  
  // Load research_mode
  const storedMode = 
    typeof settingsMeta.research_mode === "string"
      ? toManagerResearchMode(settingsMeta.research_mode)
      : typeof settingsMeta.conversation_type === "string"
        ? toManagerResearchMode(settingsMeta.conversation_type)
        : undefined
  
  if (storedMode) {
    setResearchMode(storedMode === "user_testing" ? "followup" : storedMode)
  }
}, [projectId])
```

## Benefits

1. **Single Source of Truth**: No conflicts from editing settings in multiple places
2. **Clear Separation**: Goals page = configuration, Questions page = selection
3. **Backward Compatible**: Supports legacy field names during migration
4. **Type Safe**: Standardized field names with proper TypeScript types
5. **Predictable**: Users know where to change project settings

## Migration Notes

- Existing projects with `kind = "questions"` and settings in `meta.settings` will continue to work
- New projects save settings to `kind = "settings"` at the root level
- Questions page reads from `kind = "settings"` first, falls back to legacy location
- No data migration required - both patterns supported

## Future Enhancements

Consider adding:
- Settings validation at the database level
- Settings history/audit trail
- Project templates with preset settings
- Settings export/import for reusable configurations
