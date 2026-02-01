# Integrating Generative UI with Existing Setup Flow

## What You Already Have (Keep It!)

Your existing setup flow at `/a/:accountId/:projectId/setup` already has:

```
┌─────────────────────────────────────┐
│  Set up your research               │
│  [Chat] [Voice] [Form]  ← Keep this!│
├──────────────┬──────────────────────┤
│  Chat Panel  │  Captured Panel      │
│  (existing)  │  (existing)          │
└──────────────┴──────────────────────┘
```

## What to Add: Agent-Chosen Components

Instead of the captured panel *only* showing checkmarks, have the agent **render lens-specific visualizations** based on user intent.

### Example Flow

**User in chat mode says:** "I need to qualify enterprise deals"

**Current behavior:**
- Agent extracts: research_goal, target_roles
- Captured panel shows: ✓ Research goal, ✓ Target roles

**Enhanced behavior (Generative UI):**
- Agent detects intent: Sales qualification
- Agent says in chat: "Got it - I'll use BANT to structure this"
- Agent renders: `<BANTScorecard>` component **inside the captured panel**
- User sees BANT scorecard with Budget/Authority/Need/Timeline

### Integration Points

#### 1. ProjectSetupChat Component

Add tool that returns UI components:

```typescript
// In projectSetupAgent tools
export const recommendLensTool = createTool({
  id: "recommend-lens",
  inputSchema: z.object({
    intent: z.enum(["sales", "product", "research", "support"]),
  }),
  execute: async (input, context) => {
    const { projectId } = context

    // Agent decides which component based on intent
    if (input.intent === "sales") {
      return {
        text: "Got it - I'll use BANT to structure your sales qualification.",
        ui: <BANTScorecard projectId={projectId} /> // ← Component returned!
      }
    }

    if (input.intent === "product") {
      return {
        text: "Perfect - I'll use Jobs-to-be-Done framework.",
        ui: <JTBDCanvas projectId={projectId} />
      }
    }

    // ... other intents
  }
})
```

#### 2. Enhance CapturedPane

Add a "lensView" section that shows agent-recommended visualizations:

```typescript
<CapturedPane
  fields={capturedFields}
  lensView={agentChosenComponent} // ← New prop
/>
```

When agent calls `recommendLensTool`, the UI component gets rendered in the captured pane.

#### 3. Voice Mode Integration

During voice recording (`SetupVoiceChat`), stream updates to the lens component:

```typescript
// Every 3 seconds during voice transcription
const evidence = await extractEvidence(transcript, currentLens)

// Update the component with new evidence
updateLensComponent({
  lens: "bant",
  data: {
    budget: { score: 40, evidence: [...newEvidence] }
  }
})
```

### Components to Build

These render **inside** the existing captured panel:

1. **BANTScorecard** (already built in PoC)
   - Shows Budget/Authority/Need/Timeline
   - Updates in real-time during voice
   - Evidence chips clickable to play audio

2. **JTBDCanvas** (to build)
   - Shows Jobs/Outcomes/Constraints
   - Extracted from user interviews

3. **EmpathyMap** (to build)
   - Shows Says/Thinks/Does/Feels quadrants
   - Populated from conversations

4. **PainMatrix** (to build)
   - Shows Pain intensity × Segment
   - Helps prioritize problems

### What Doesn't Change

Keep these exactly as they are:
- ✅ Mode selector (voice/chat/form)
- ✅ ProjectSetupChat conversation UI
- ✅ SetupVoiceChat recording UI
- ✅ TypeformQuestion one-at-a-time flow
- ✅ CapturedPane field checkmarks
- ✅ SetupModeToggle switching

Only **add** the lens-specific visualizations.

## Implementation Steps

### Step 1: Update ProjectSetupAgent

Add `recommendLensTool` that returns React components based on detected intent.

### Step 2: Wire AI SDK Streaming

Update `/api/chat/project-setup` to handle UI components:

```typescript
import { createStreamableUI } from "ai/rsc"

export async function POST({ request, context }) {
  const stream = await projectSetupAgent.stream(...)

  for await (const chunk of stream) {
    if (chunk.tool === "recommendLens") {
      // Stream the UI component
      const ui = createStreamableUI(chunk.result.ui)
      return ui.value
    }
  }
}
```

### Step 3: Render in CapturedPane

Update `CapturedPane` to show agent-returned components:

```typescript
{agentComponent && (
  <div className="mt-4 border-t pt-4">
    <p className="text-xs text-muted-foreground mb-2">
      Agent Recommendation:
    </p>
    {agentComponent}
  </div>
)}
```

### Step 4: Test Flow

1. User opens `/a/:accountId/:projectId/setup`
2. Chooses chat mode
3. Types "I need to qualify deals"
4. Agent responds + renders BANT scorecard
5. User switches to voice
6. During recording, scorecard fills with evidence
7. User sees real-time updates

## Why This Approach Works

1. **Builds on what exists** - No need to rebuild mode switching
2. **Additive, not destructive** - Captured panel gets enhanced, not replaced
3. **Preserves user choice** - Users still pick voice/chat/form
4. **Agent adds value** - Intelligent component selection based on intent

## Next Actual Steps

1. Review existing `ProjectSetupChat.tsx` to understand current tool pattern
2. Add `recommendLensTool` to `projectSetupAgent`
3. Wire up AI SDK streaming for UI components
4. Build JTBD/Empathy/Pain components (BANT already done)
5. Test with real users

---

**The demo at `/demo/gen-ui` is just a visualization** - the real work is integrating these patterns into your existing setup flow.
