# Generative UI - Proof of Concept

This folder contains PoC components demonstrating **agent-driven user interfaces** where agents dynamically choose which components to render based on user context, data state, and query intent.

## What's Different?

Instead of fixed UI templates, agents decide what to show:

```typescript
// ❌ Fixed UI (current)
if (query === "show pipeline") {
  return <DealList deals={deals} />
}

// ✅ Generative UI (PoC)
const agent = projectStatusAgent
const response = await agent.run("show pipeline", context)
// Agent chooses component based on:
// - Data count (3 deals → DealCards, 13 deals → BANTMatrix)
// - User query intent (show vs analyze vs create)
// - Active lens (BANT vs JTBD)
// - Streaming state (loading → complete)
return response.ui // React component chosen by agent
```

## Demo

Visit `/demo/gen-ui` to see working examples:

1. **SetupWizard** - Agent recommends lens based on stated goal
2. **BANTScorecard** - Real-time evidence extraction with streaming updates

## Components

### SetupWizard

Agent-driven onboarding that adapts to user goals.

**Props:**
- `recommendedLens` - Lens agent chose based on user's goal
- `userGoal` - User's stated objective
- `currentStep` - Progress through wizard
- `onAcceptLens` - Callback when user confirms lens

**Agent Decision Logic:**
```typescript
User: "I need to qualify enterprise deals"
Agent reasoning:
1. Detects intent: "qualify" + "enterprise" → sales qualification
2. Recommends: BANT lens
3. Returns: <SetupWizard recommendedLens="bant" userGoal="..." />
```

### BANTScorecard

Real-time BANT qualification display that updates as evidence is extracted.

**Props:**
- `budget/authority/need/timeline` - BANT facets with scores and evidence clips
- `isStreaming` - Whether currently receiving updates
- `onPlayClip` - Callback when user clicks evidence to play audio/video

**Streaming Pattern:**
```typescript
// During voice recording, every 3 seconds:
1. Transcribe audio chunk
2. Extract BANT evidence (Budget, Authority, Need, Timeline)
3. Update scorecard via createStreamableUI()

<BANTScorecard
  budget={{
    score: 85,
    evidence: [
      { verbatim: "costs $50K annually", timestamp: 8.5, confidence: 0.95 }
    ],
    status: "complete",
    updating: true // Shows pulsing indicator
  }}
  isStreaming={true}
/>
```

## Architecture Patterns

### Tool → UI Pattern

Mastra tools return React components dynamically:

```typescript
import { createTool } from "@mastra/core/tools"
import { SetupWizard } from "~/features/generative-ui"

export const assessProjectStatusTool = createTool({
  id: "assess-project-status",
  execute: async (input, context) => {
    const { projectId } = context
    const deals = await fetchDeals(projectId)

    // Agent decides component based on state
    if (deals.length === 0) {
      return {
        text: "No deals yet. Let's set up your research goals.",
        ui: <SetupWizard recommendedLens="bant" />
      }
    }

    if (deals.length <= 3) {
      return {
        text: `Found ${deals.length} deals. Here's the detail view:`,
        ui: <DealCards deals={deals} highlightMode="detailed" />
      }
    }

    // 10+ deals → aggregated matrix view
    return {
      text: `${deals.length} deals in pipeline. Here's the overview:`,
      ui: <BANTMatrix deals={deals} interactive />
    }
  }
})
```

### Streaming UI Pattern

Real-time updates during long-running operations:

```typescript
import { createStreamableUI } from "ai/rsc"

const ui = createStreamableUI(<VoiceRecorder status="init" />)

// User grants permission
ui.update(<VoiceRecorder status="recording" />)

// Every 3 seconds: transcribe + extract
for await (const chunk of audioStream) {
  const { transcript, evidence } = await extractEvidence(chunk)

  ui.append(<TranscriptLine text={transcript} />)
  ui.update(
    <BANTScorecard
      budget={{ score: 40, evidence: [...], updating: true }}
    />
  )
}

// Complete
ui.done(<BANTScorecardComplete score={85} />)

return ui.value
```

## Next Steps (Not Implemented Yet)

To integrate this into the actual flow:

1. **Create Agent Tools** that return these components
2. **Wire up AI SDK** streaming in chat routes
3. **Add Component Registry** for tool → component mapping
4. **Build More Components**:
   - DealCards (1-3 deals, detailed view)
   - BANTMatrix (10+ deals, aggregated view)
   - LensSelector (choose/switch frameworks)
   - EvidenceTimeline (chronological evidence playback)

## Related Documentation

- `docs/20-features-prds/features/onboarding/generative-ui-architecture.md` - Full architecture spec
- `docs/20-features-prds/features/onboarding/generative-ui-story.md` - User narrative walkthrough
- `docs/20-features-prds/features/onboarding/adaptive-companion-spec-v2.md` - Lens integration

## Credits

Built on branch `feature/unified-research-flow` as proof-of-concept for agent-driven UI.
