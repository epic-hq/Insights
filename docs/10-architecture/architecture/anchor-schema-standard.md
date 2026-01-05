# Media Anchor Schema Standard

**Status**: ✅ Active Standard (as of Dec 2024)
**Last Updated**: 2025-12-02

## Overview

All media anchors (timestamp references to audio/video content) use the **TurnAnchors** schema with millisecond-based integer timestamps for precise media playback.

## Canonical Schema

### BAML Definition
```baml
// baml_src/extract_evidence.baml
class TurnAnchors {
  start_ms int? @description("Start time in milliseconds")
  end_ms int? @description("End time in milliseconds")
  chapter_title string? @description("Optional chapter/section title")
  char_span int[]? @description("Optional [start,end] character offsets in transcript")
}
```

### TypeScript Interface
```typescript
// app/utils/media-url.client.ts
export interface MediaAnchor {
  start_ms?: number
  end_ms?: number
  media_key?: string          // R2 object key for stable media reference
  chapter_title?: string
  char_span?: any
  // Legacy fields (for backwards compatibility)
  target?: string
  start_seconds?: number
}
```

### Database Storage
```sql
-- evidence.anchors column stores JSONB array
-- Example:
[
  {
    "start_ms": 369231,
    "end_ms": 487880,
    "media_key": "interviews/uuid/audio.m4a",
    "chapter_title": "Product Discovery Discussion"
  }
]
```

## Field Definitions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `start_ms` | int | Yes* | Start time in milliseconds | `369231` (6:09) |
| `end_ms` | int | No | End time in milliseconds | `487880` (8:07) |
| `media_key` | string | No | R2 object path (without domain) | `"interviews/abc-123/audio.m4a"` |
| `chapter_title` | string | No | Human-readable section label | `"Onboarding challenges"` |
| `char_span` | int[] | No | Character offsets in transcript | `[1240, 1580]` |

*Required for media playback functionality

## Usage in Code

### Reading Anchors
```typescript
import { getAnchorStartSeconds } from "~/utils/media-url.client"

// Extract timestamp from anchor
const anchor: MediaAnchor = evidence.anchors[0]
const startSeconds = getAnchorStartSeconds(anchor) // Converts start_ms to seconds
```

### Generating Media URLs
```typescript
import { generateMediaUrl } from "~/utils/media-url.client"

// Generate presigned URL with timestamp
const url = await generateMediaUrl(anchor, fallbackMediaUrl)
// Returns: "https://r2.../audio.m4a?X-Amz-Signature=...&t=369"
```

### React Components
```tsx
import type { MediaAnchor } from "~/utils/media-url.client"

const anchors = (evidence.anchors as MediaAnchor[]) || []
const mediaAnchors = anchors.filter(a =>
  a.start_ms !== undefined || a.media_key !== undefined
)
```

## Migration from Legacy Formats

### Legacy Format (Deprecated)
```typescript
// OLD - Do not use
{
  type: "audio",
  start: "6:09",        // String format
  end: "8:07",
  target: "https://..."  // Full URL (expires)
}
```

### Current Format
```typescript
// NEW - Use this
{
  start_ms: 369000,
  end_ms: 487000,
  media_key: "interviews/uuid/audio.m4a"
}
```

### Handling Legacy Data
Components should prioritize `start_ms` but fall back to legacy fields:

```typescript
const startSeconds =
  anchor.start_ms ? anchor.start_ms / 1000 :
  anchor.start_seconds ??
  parseTimeString(anchor.start) ??
  0
```

## Component Integration

### Components Using MediaAnchor
- ✅ `EvidenceCard.tsx` - Evidence display with media playback
- ✅ `ChronologicalEvidenceList.tsx` - Timeline view of evidence
- ✅ `SimpleMediaPlayer.tsx` - Media playback component
- ✅ `ConversationLenses.tsx` - Multi-perspective evidence views

### Best Practices
1. **Always import MediaAnchor type**: Don't create custom anchor types
2. **Use utility functions**: `getAnchorStartSeconds()`, `generateMediaUrl()`
3. **Filter for valid anchors**: Check `start_ms !== undefined` before rendering
4. **Handle missing media gracefully**: Show fallback UI when media unavailable

## Testing Anchor Data

### Valid Anchor Example
```json
{
  "start_ms": 120000,
  "end_ms": 180000,
  "media_key": "interviews/abc-123/recording.m4a",
  "chapter_title": "Feature requests"
}
```

### Common Issues
❌ **Missing start_ms**: Anchor won't play at correct timestamp
❌ **String timestamps**: Component expects integers in milliseconds
❌ **Full URLs in target**: URLs expire; use `media_key` instead
❌ **Seconds instead of milliseconds**: Multiply by 1000

## Related Documentation
- [Interview Processing Architecture](./interview-processing-refactor.md)
- [Evidence Extraction](./evidence-based-extraction.md)
- [BAML Extract Evidence Schema](../../baml_src/extract_evidence.baml)
