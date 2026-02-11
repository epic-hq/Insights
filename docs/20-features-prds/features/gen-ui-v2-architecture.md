# Gen-UI v2 Architecture

## Overview

A2UI-aligned generative UI system. Agents produce declarative UI descriptions; the client renders them using registered components.

## Key Principles (from a2ui.org v0.8)

1. **Flat adjacency list** — components reference children by ID, not nested trees
2. **Data binding** — JSON Pointer paths separate structure from state
3. **4 message types** — surfaceUpdate, dataModelUpdate, beginRendering, deleteSurface
4. **Custom components** — domain-specific components registered with Zod schemas

## Data Flow

```
Agent tool call
  → returns { ...result, a2ui: buildSingleComponentSurface(...) }
  → frontend detects a2ui payload in tool result
  → A2UISurfaceContext.applyMessages(payload.messages)
  → A2UIRenderer renders from component registry
  → User interactions → emitUiEvent() → event store
```

## File Structure

```
app/lib/gen-ui/
├── a2ui.ts                  # Core types: flat adjacency list, 4 message types, surface state
├── capabilities.ts          # Validate components against capability allowlist
├── component-registry.ts    # Registry class + defineComponent() helper
├── data-binding.ts          # JSON Pointer resolution for data model bindings
├── emit-event.server.ts     # Server-side event emission to Supabase event store
├── index.ts                 # Barrel exports
├── json-patch.ts            # RFC 6902 JSON Patch for incremental state updates
├── registered-components.tsx # All registered gen-ui components
├── tool-helpers.ts          # Agent tool helpers: buildSingleComponentSurface(), etc.
└── __tests__/
    ├── a2ui.test.ts
    ├── data-binding.test.ts
    └── tool-helpers.test.ts

app/components/gen-ui/
└── A2UIRenderer.tsx         # React renderer: walks adjacency list → component registry

app/contexts/
└── a2ui-surface-context.tsx # React context: holds SurfaceState, applies messages

app/features/generative-ui/components/
├── InterviewPrompts.tsx     # Interactive interview question checklist
└── SimpleBANT.tsx           # BANT scorecard visualization

supabase/migrations/
└── 20260202222720_gen_ui_event_store.sql  # Event store schema
```

## Message Types

### surfaceUpdate
Adds or updates components in a surface.

```json
{
  "type": "surfaceUpdate",
  "surfaceId": "thread-abc",
  "rootId": "prompts-root",
  "components": [
    { "id": "prompts-root", "component": { "InterviewPrompts": { "dataBinding": "/data" } } }
  ]
}
```

### dataModelUpdate
Updates the data model. Components bound to paths automatically re-render.

```json
{
  "type": "dataModelUpdate",
  "surfaceId": "thread-abc",
  "data": {
    "data": {
      "title": "Customer Discovery",
      "prompts": [{ "id": "1", "text": "What problem are you solving?" }]
    }
  }
}
```

### beginRendering
Signals the client to render. Used to batch multiple surfaceUpdate + dataModelUpdate before showing.

### deleteSurface
Removes the surface entirely.

## Agent Tool Pattern

```typescript
// In a Mastra tool's execute():
import { buildSingleComponentSurface } from "~/lib/gen-ui/tool-helpers"

return {
  success: true,
  message: "Here are your interview prompts",
  a2ui: buildSingleComponentSurface({
    surfaceId: threadId,
    componentType: "InterviewPrompts",
    data: { title: "Customer Discovery", prompts },
  }),
}
```

## Database Schema

- **threads** — conversation containers
- **thread_seq** — monotonic sequence counters per thread
- **ui_events** — immutable event log (who did what, when, at what seq)
- **ui_state** — materialized current state (rebuilt from events)
- **artifacts** — persisted A2UI surface snapshots with versioning + etag

## What Changed from codex-genui Branch

| Before (codex-genui) | After (genui-v2) |
|---|---|
| Nested component tree | Flat adjacency list |
| Custom instruction/event types | Standard A2UI message types |
| Props passed directly | Data binding via JSON Pointer |
| GenUiContext (258 lines) | A2UISurfaceContext (~80 lines) |
| GenUiCanvas (413 lines) | A2UIRenderer (~140 lines) |
| LLM intent classifier per event | Removed — tool call IS the intent |
| Orchestrator with realtime sub | Removed — premature for v1 |
| Event store schema | Kept as-is (solid) |
| Component registry | Kept as-is (solid) |
| JSON Patch | Kept as-is (solid) |
