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

## Generic displayComponent Tool

Instead of one tool per component, a single `displayComponent` tool renders any registered component. The tool description is built dynamically from the registry's `useWhen` hints so the agent knows which component to pick.

```typescript
// Agent calls displayComponent with:
{
  componentType: "InsightCard",   // any registered type
  data: { id: "ins-1", name: "...", statement: "..." },
  title: "Key Finding"            // optional
}
// Tool validates data against registry schema, returns A2UI payload
```

**Registered components (12):** InterviewPrompts, BANTScorecard, AiInsightCard, StatCard, PersonaCard, ThemeList, ProjectContextStatus, InsightCard, EvidenceCard, SurveyCreated, SurveyResponseCard, SurveyResponseList

## Bidirectional Architecture

```
┌─────────────────────────────────────────────┐
│                   USER                       │
│                                              │
│   ┌─────────────┐      ┌──────────────┐     │
│   │  Chat Panel  │◄────►│    Canvas    │     │
│   │  (inline UI) │      │  (surfaces)  │     │
│   └──────┬───┬──┘      └──────┬───────┘     │
│          │   │                 │              │
│    type  │   │ select/       │ onAction      │
│   answer │   │ configure     │ (click,edit)  │
│          │   │               │               │
└──────────┼───┼───────────────┼───────────────┘
           │   │               │
           ▼   ▼               ▼
┌──────────────────────────────────────────────┐
│              AGENT (Mastra)                   │
│                                               │
│  System prompt includes:                      │
│  - Active surface state (what's displayed)    │
│  - Available components (registry summary)    │
│  - User's last interaction context            │
│                                               │
│  Tools:                                       │
│  - displayComponent (render on canvas)        │
│  - updateSurface (patch existing surface)     │
│  - requestUserInput (inline chat selector)    │
│  - dismissSurface                             │
└──────────────────────────────────────────────┘
```

### Data flow: Canvas → Agent

1. User clicks/edits something on a canvas component
2. `onAction` callback fires in `A2UIRenderer`
3. Action is injected as a tool result message into the chat stream
4. Agent sees the action and can respond (update canvas, reply in chat, etc.)

### Data flow: Chat → Canvas

1. Agent calls `requestUserInput` tool → renders inline selector/form in chat
2. User makes selection or types answer in chat
3. Selection is sent as tool result → agent processes
4. Agent calls `displayComponent` or `updateSurface` to update canvas

## Key UX Flows

### Flow 1: Survey Setup (agent-guided)

```
User: "Help me create a feedback survey for our beta users"

Agent: [calls displayComponent → SurveyCreated on canvas]
       [calls requestUserInput in chat]:
       "What type of feedback are you looking for?"
       ○ Product usability
       ○ Feature requests
       ○ NPS / satisfaction
       ○ Bug reports

User: [clicks "Feature requests" OR types "feature requests"]

Agent: [calls displayComponent → InterviewPrompts on canvas with generated questions]
       "I've drafted 5 questions focused on feature requests.
        Review them on the canvas — edit, reorder, or add more."

User: [edits a question on canvas — onAction fires]

Agent: "Updated. Want me to make that question more specific?
        I noticed it's pretty broad — I could split it into..."
```

### Flow 2: Interview Question Review (HITL feedback)

```
User: "Review my interview questions for the enterprise discovery project"

Agent: [fetches prompts from DB]
       [calls displayComponent → InterviewPrompts on canvas]
       [in chat]: "I see 8 questions. A few observations:
        - Q3 is a leading question — it assumes the user has the problem
        - Q5 and Q7 overlap significantly
        - Missing: no question about buying process/authority

        Want me to fix these?"

User: "yes, fix Q3 and merge 5+7, add the authority question"

Agent: [calls updateSurface → patches InterviewPrompts data on canvas]
       [in chat]: "Done. Updated 3 questions:
        - Q3: Rephrased to be open-ended
        - Q5: Merged with Q7 into a single focused question
        - Q9: New — 'Walk me through how a purchase decision gets made'

        The canvas shows the updated list."
```

### Flow 3: Research Choices / Configuration

```
User: "Show me the key themes from our last 5 interviews"

Agent: [fetches themes + evidence]
       [calls displayComponent → ThemeList on canvas]
       [calls requestUserInput in chat]:
       "Here are 12 themes. Which ones should I dig deeper on?"
       ☑ Manual data entry (Impact: 5/5)
       ☑ Real-time collaboration (Impact: 4/5)
       ☐ Security compliance (Impact: 3/5)
       ☐ ...

User: [checks top 3 OR types "the first two"]

Agent: [calls displayComponent → updates canvas with detailed evidence for selected themes]
       "Drilling into those 2 themes. Here's the evidence breakdown..."
```

### Flow 4: Providing Feedback on Intent & Specificity

```
User: "Analyze this interview transcript"

Agent: [processes transcript]
       [calls displayComponent → InsightCard + EvidenceCard on canvas]
       [in chat]: "I extracted 4 insights and 12 evidence snippets.

        Confidence check — did I get the intent right?
        ○ Yes, looks good
        ○ Partially — some insights are off
        ○ No, re-analyze with different focus"

User: [clicks "Partially"] OR types "the second insight is wrong,
       they were talking about their OLD workflow not current"

Agent: [re-analyzes with correction context]
       [calls updateSurface → patches canvas with corrected insights]
       "Good catch. Updated Insight #2 — it now reflects the legacy
        workflow context. The evidence attribution also shifted."
```

## Implementation Status

### Shipped (Branch: genui-v2, 5 commits)

| Phase | What | Key Files |
|-------|------|-----------|
| P0 | A2UI types, data binding, JSON Patch, renderer, context | `app/lib/gen-ui/*`, `app/components/gen-ui/A2UIRenderer.tsx` |
| P1 | Component registry + 12 registered components | `app/lib/gen-ui/registered-components.tsx` |
| P2 | Chat stream bridge (tool → frontend → render) | `ProjectStatusAgentChat.tsx`, `display-interview-prompts.ts` |
| P3 | Safety harness: `ffGenUI` flag + `/test/gen-ui` route | `app/routes/test.gen-ui.tsx` |
| P4 | Generic `displayComponent` tool + component gallery | `app/mastra/tools/display-component.ts` |

### Roadmap

| Phase | Priority | Description | Status |
|-------|----------|-------------|--------|
| P5 | **P0** | Bidirectional: `onAction` → agent feedback loop | Next |
| P6 | **P0** | Agent context: inject active surface state into system prompt | Next |
| P7 | **P1** | UX flow components: `requestUserInput` (chat-inline selectors), `updateSurface` (patch existing) | Planned |
| P8 | **P1** | New domain components: PersonCard, ConversationLensInsights, SurveyResultsSummary | Planned |
| P9 | **P2** | Persistence: event store + surface replay on page load | Deferred |
| P10 | **P2** | Multi-component surfaces (dashboard-style layouts) | Future |

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
| 1 tool per component | Generic `displayComponent` tool |
| Event store schema | Kept as-is (solid) |
| Component registry | Kept as-is (solid) |
| JSON Patch | Kept as-is (solid) |
