# Adaptive Companion Spec

*Implementation Specification for Proposal C*
*Status: Ready for Implementation*
*Created: 2025-01-02*

## Executive Summary

The Adaptive Companion is our onboarding and project setup experience that starts conversational and reveals structure as needed. It combines the best of voice-first AI with the reliability of structured forms.

**Core Philosophy**: Start magical, reveal structure as captured.

## Why This Design

### Competitive Context

| Competitor | Their Approach | Our Advantage |
|------------|----------------|---------------|
| VoicePanel | AI-only interviews | Human+AI hybrid, user controls pace |
| Dovetail | Complex enterprise forms | Conversational simplicity |
| Looppanel | Form-based analysis | Voice-first collection |
| Condens | Two interfaces (researcher/stakeholder) | Two-pane (chat/captured) in one view |

### User Research Insights

1. **60% need guidance** - Users don't know what to ask; conversation helps
2. **Voice adoption varies** - Some can't/won't talk; need text fallback
3. **Structure reassures** - Seeing captured data builds confidence
4. **Repeat use differs** - First-time needs magic; returning users want speed

## Architecture

### Layout States

#### Initial State (Empty)
```
┌─────────────────────────────────────────────────────────────────┐
│  Set up your research                                   [···]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │       ┌─────┐                                               ││
│  │       │ ◉◉◉ │  Hi! I'll help you set up your research.     ││
│  │       └─────┘                                               ││
│  │                                                             ││
│  │       What are you trying to learn from customers?          ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐    ││
│  │  │ We're losing enterprise customers and I want to...  │    ││
│  │  └─────────────────────────────────────────────────────┘    ││
│  │                                                             ││
│  │  [🎤 Speak] [⌨️ Type] [📝 Show Form]                        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ Captured ───────────────────────────────────────────────┐   │
│  │  ○ Research Goal    ○ Target Roles    ○ Company Context  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### After Interaction (Two-Pane)
```
┌─────────────────────────────────────────────────────────────────┐
│  Set up your research                                   [···]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Chat ────────────────────────────┬─ Captured ─────────────┐ │
│  │                                   │                        │ │
│  │  ┌─────┐ I'll help you set up     │  Research Goal ✓       │ │
│  │  │ ◉◉◉ │ your research.           │  ┌──────────────────┐  │ │
│  │  └─────┘                          │  │ Understand why   │  │ │
│  │                                   │  │ enterprise...    │  │ │
│  │  You: We're losing enterprise     │  └──────────────────┘  │ │
│  │  customers and I want to          │                        │ │
│  │  understand why they churn.       │  Target Roles          │ │
│  │                                   │  ┌──────────────────┐  │ │
│  │  ┌─────┐ Got it! Who should we    │  │ [VP Engineering] │  │ │
│  │  │ ◉◉◉ │ talk to? I'd suggest:    │  │ [+ Add...]       │  │ │
│  │  └─────┘                          │  └──────────────────┘  │ │
│  │                                   │                        │ │
│  │  Suggestions:                     │  Company Context       │ │
│  │  [VP Engineering] [CTO]           │  ┌──────────────────┐  │ │
│  │  [Product Manager]                │  │ (Not yet...)     │  │ │
│  │                                   │  └──────────────────┘  │ │
│  │  ┌─────────────────────────────┐  │                        │ │
│  │  │ Also product managers...    │  │  [✓ Looks Good]       │ │
│  │  └─────────────────────────────┘  │                        │ │
│  │                                   │                        │ │
│  │  [🎤] [⌨️]                        │                        │ │
│  └───────────────────────────────────┴────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
ProjectSetupPage
├── SetupModeToggle (header)
│   └── Mode: chat | voice | form
├── AdaptiveCompanion (main content)
│   ├── ChatPane (left/main)
│   │   ├── MessageList
│   │   │   ├── AIMessage (with avatar)
│   │   │   └── UserMessage
│   │   ├── SuggestionChips (clickable)
│   │   └── InputArea
│   │       ├── Textarea (with STT button)
│   │       └── ActionButtons [🎤 Speak] [📝 Form]
│   └── CapturedPane (right/bottom on mobile)
│       ├── FieldCard (per captured item)
│       │   ├── Label + Status
│       │   ├── Preview/Value
│       │   ├── TraceabilityLink → source utterance
│       │   └── EditButton (inline)
│       └── ProgressIndicator
└── ProjectSetupProvider (context)
```

## Key Components

### 1. AdaptiveCompanion (New)

Main orchestrator component that manages the two-pane layout.

```tsx
interface AdaptiveCompanionProps {
  accountId: string;
  projectId: string;
  projectName: string;
  onSetupComplete: () => void;
  initialMode?: 'chat' | 'voice';
}

// Key behaviors:
// - Starts single-pane (chat only)
// - Expands to two-pane when first field captured
// - Syncs chat context with captured fields
// - Handles mode switching (chat ↔ voice ↔ form)
```

### 2. CapturedPane (Enhanced from CapturedPanel)

Right-side panel showing captured fields with traceability.

```tsx
interface CapturedPaneProps {
  items: CapturedField[];
  onFieldClick: (fieldKey: string) => void;
  onFieldEdit: (fieldKey: string, value: string | string[]) => void;
  showTraceability?: boolean; // Link to source message
}

interface CapturedField {
  key: string;
  label: string;
  status: 'pending' | 'in_progress' | 'complete';
  value?: string | string[];
  preview?: string;
  required?: boolean;
  sourceMessageId?: string; // For traceability
  sourceUtterance?: string; // Snippet of what user said
}
```

### 3. ChatPane (Enhanced from ProjectSetupChat)

Left-side chat interface with AI suggestions.

```tsx
interface ChatPaneProps {
  messages: Message[];
  onSend: (text: string) => void;
  onSuggestionClick: (suggestion: string) => void;
  suggestions: string[];
  isProcessing: boolean;
  voiceEnabled?: boolean;
  onVoiceStart?: () => void;
}
```

### 4. FieldCard (New)

Individual captured field display with inline editing.

```tsx
interface FieldCardProps {
  field: CapturedField;
  onClick: () => void;
  onEdit: (value: string | string[]) => void;
  showTraceability?: boolean;
}

// Displays:
// - Field label with status icon (✓ complete, ● in progress, ○ pending)
// - Value preview (truncated)
// - "View source" link → highlights original message
// - Edit button → inline edit mode
```

## Data Flow

### Extraction Pipeline

```
User Input (voice/text)
    ↓
AI Agent (project-setup-agent)
    ↓
Tool Calls:
    ├── extractFieldValue(fieldKey, value, sourceText)
    ├── suggestNextSteps(suggestions[])
    └── navigateToPage(path) [when complete]
    ↓
Update ProjectSetupProvider (Zustand store)
    ↓
CapturedPane re-renders with new field
    ↓
ChatPane shows confirmation message
```

### State Management

```typescript
// ProjectSetupProvider store shape
interface ProjectSetupState {
  // Field values
  fields: Record<string, FieldValue>;

  // Extraction metadata (for traceability)
  extractions: {
    fieldKey: string;
    value: string | string[];
    sourceMessageId: string;
    sourceText: string;
    extractedAt: string;
    confidence?: number;
  }[];

  // UI state
  mode: 'chat' | 'voice' | 'form';
  isPaneExpanded: boolean;

  // Actions
  setFieldValue: (key: string, value: FieldValue, source?: ExtractionSource) => void;
  setMode: (mode: 'chat' | 'voice' | 'form') => void;
}

type FieldValue = string | string[] | null;
```

## Traceability Feature

Every AI-extracted field links back to source utterance.

### Implementation

1. **Agent extracts with context**:
```typescript
// Tool call from agent
extractFieldValue({
  fieldKey: "research_goal",
  value: "Understand why enterprise customers churn",
  sourceMessageId: "msg_abc123",
  sourceText: "We're losing enterprise customers and I want to understand why they churn",
  confidence: 0.95
})
```

2. **FieldCard shows source**:
```tsx
<FieldCard field={field}>
  <SourceLink
    onClick={() => scrollToMessage(field.sourceMessageId)}
  >
    From: "We're losing enterprise customers..."
  </SourceLink>
</FieldCard>
```

3. **Click highlights original**:
- Scroll chat to source message
- Highlight with pulse animation
- User can correct if wrong

### Why Traceability Matters

From Looppanel competitive research:
> "Traceability: Every AI output has source link (trust-building)"

This is **non-negotiable** for research tools. Users must verify AI extractions.

## Mode Transitions

### Chat → Form

When user clicks "📝 Show Form":
1. Fade out chat pane
2. Show Typeform-style single-question view
3. Pre-fill with any captured values
4. Keep captured pane visible (optional)

### Chat → Voice

When user clicks "🎤 Speak" or "Voice Chat":
1. Expand VoiceOrb to prominent position
2. Keep chat visible (for transcription)
3. Captured pane updates in real-time
4. Return to chat when voice ends

### Form → Chat

When user clicks "💬 Back to Chat":
1. Resume chat from last position
2. Acknowledge form progress: "I see you've filled in X, Y, Z..."
3. Ask about remaining fields

## Mobile Responsiveness

### Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 640px (sm) | Single column, tabs for chat/captured |
| 640-1024px (md) | Side-by-side, narrower captured pane |
| > 1024px (lg) | Full two-pane with comfortable widths |

### Mobile Layout

```
┌─────────────────────────┐
│  Set up your research   │
├─────────────────────────┤
│  [Chat] [Captured (2)]  │  ← Tab bar
├─────────────────────────┤
│                         │
│  ┌─────┐                │
│  │ ◉◉◉ │ What are you   │
│  └─────┘ trying to      │
│          learn?         │
│                         │
│  You: We're losing...   │
│                         │
│  [VP Eng] [CTO] [PM]    │
│                         │
│  ┌───────────────────┐  │
│  │ Type here...  [🎤]│  │
│  └───────────────────┘  │
│                         │
└─────────────────────────┘
```

## AI Agent Integration

### Project Setup Agent Tools

The agent (`app/mastra/agents/project-setup-agent.ts`) needs these tools:

```typescript
const tools = {
  // Extract and save a field value
  extractFieldValue: {
    parameters: z.object({
      fieldKey: z.enum([
        'research_goal', 'customer_problem', 'company_description',
        'target_orgs', 'target_roles', 'offerings', 'competitors',
        'assumptions', 'unknowns'
      ]),
      value: z.union([z.string(), z.array(z.string())]),
      sourceText: z.string(),
      confidence: z.number().optional()
    }),
    execute: async (params) => {
      // Save to project sections + update UI
    }
  },

  // Generate suggestions for a field
  generateFieldSuggestions: {
    parameters: z.object({
      fieldType: z.enum(['target_orgs', 'target_roles', 'decision_questions', ...]),
      researchGoal: z.string(),
      existingValues: z.array(z.string()).optional(),
      count: z.number().default(3)
    }),
    execute: async (params) => {
      // Call BAML GenerateContextualSuggestions
    }
  },

  // Suggest next conversation steps
  suggestNextSteps: {
    parameters: z.object({
      suggestions: z.array(z.string()).max(4)
    }),
    execute: async (params) => {
      // Return suggestions for UI chips
    }
  },

  // Navigate when setup complete
  navigateToPage: {
    parameters: z.object({
      path: z.string()
    }),
    execute: async (params) => {
      // Trigger navigation
    }
  },

  // Switch to different agent (project-status)
  switchAgent: {
    parameters: z.object({
      targetAgent: z.enum(['project-status', 'interview-agent']),
      reason: z.string()
    }),
    execute: async (params) => {
      // Handoff to next agent
    }
  }
}
```

### Agent Prompt

```markdown
You are a research setup assistant helping users define their project.

## Your Goal
Extract structured information through natural conversation:
- research_goal (REQUIRED)
- customer_problem
- target_orgs
- target_roles
- company_description

## Conversation Style
- Ask ONE question at a time
- Acknowledge what you captured
- Offer suggestions when user hesitates
- Keep responses under 3 sentences

## Tools
- extractFieldValue: Save captured information
- generateFieldSuggestions: Get AI suggestions when user is stuck
- suggestNextSteps: Provide clickable response options
- navigateToPage: Move to next step when done
- switchAgent: Handoff to project-status agent when setup complete

## Flow
1. Ask about research goal
2. Based on answer, ask about customers
3. Clarify any missing context
4. Confirm and complete

When research_goal is captured with reasonable detail, use switchAgent to complete setup.
```

## Implementation Phases

### Phase 1: Two-Pane Layout (Week 1)

**Files to create/modify:**
- `app/features/projects/components/AdaptiveCompanion.tsx` (NEW)
- `app/features/projects/components/CapturedPane.tsx` (NEW, from CapturedPanel)
- `app/features/projects/components/ChatPane.tsx` (NEW, extracted from ProjectSetupChat)
- `app/features/projects/pages/setup.tsx` (MODIFY)

**Deliverables:**
- [ ] Two-pane layout with responsive breakpoints
- [ ] Chat pane with existing ProjectSetupChat logic
- [ ] Captured pane showing field progress
- [ ] Smooth expansion from single to two-pane

### Phase 2: Real-Time Extraction (Week 2)

**Files to create/modify:**
- `app/mastra/agents/project-setup-agent.ts` (MODIFY - add tools)
- `app/mastra/tools/extract-field-value.ts` (NEW)
- `app/mastra/tools/generate-field-suggestions.ts` (EXISTS - enhance)
- `app/features/projects/contexts/project-setup-context.tsx` (MODIFY)

**Deliverables:**
- [ ] Agent extracts fields via tool calls
- [ ] Captured pane updates in real-time
- [ ] Traceability links to source messages
- [ ] Inline editing of captured fields

### Phase 3: Suggestions & Polish (Week 3)

**Files to create/modify:**
- `app/features/projects/components/SuggestionChips.tsx` (NEW)
- `app/features/projects/components/FieldCard.tsx` (NEW)
- Various CSS/animation improvements

**Deliverables:**
- [ ] Clickable suggestion chips after AI messages
- [ ] Field cards with edit and source links
- [ ] Animations for field capture
- [ ] Mobile tab-based layout

### Phase 4: Voice Integration (Week 4)

**Files to modify:**
- `app/features/projects/components/SetupVoiceChat.tsx` (MODIFY)
- `app/features/projects/components/AdaptiveCompanion.tsx` (MODIFY)

**Deliverables:**
- [ ] Voice mode with visible chat transcription
- [ ] Real-time extraction during voice
- [ ] Seamless voice ↔ chat transitions

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Setup completion rate | 80%+ | ~60% |
| Time to complete | < 3 min | Unknown |
| Voice adoption | 30%+ | 0% (not built) |
| Field extraction accuracy | 90%+ | N/A |
| User correction rate | < 20% | N/A |

## Testing Plan

### Unit Tests
- Field extraction from various phrasings
- Traceability link generation
- State management (field updates, mode switches)

### Integration Tests
- Full conversation flow → all fields captured
- Voice → chat transition preserves state
- Form mode ↔ chat mode data sync

### E2E Tests
- New user completes setup via chat
- Returning user edits fields
- Mobile viewport layout

## Files Changed Summary

| File | Action | Notes |
|------|--------|-------|
| `components/AdaptiveCompanion.tsx` | CREATE | Main orchestrator |
| `components/CapturedPane.tsx` | CREATE | From CapturedPanel |
| `components/ChatPane.tsx` | CREATE | From ProjectSetupChat |
| `components/FieldCard.tsx` | CREATE | Individual field display |
| `components/SuggestionChips.tsx` | CREATE | Clickable suggestions |
| `pages/setup.tsx` | MODIFY | Use AdaptiveCompanion |
| `contexts/project-setup-context.tsx` | MODIFY | Add extractions tracking |
| `agents/project-setup-agent.ts` | MODIFY | Add new tools |
| `tools/extract-field-value.ts` | CREATE | Extraction tool |

---

## Appendix: Competitive Patterns Applied

| Pattern | Source | How We Apply It |
|---------|--------|-----------------|
| Two interfaces | Condens | Chat pane (researcher) + Captured pane (structure) |
| Traceability | Looppanel | Every field links to source utterance |
| Text-based clips | Grain | Click transcript text to capture |
| Recipes/templates | Granola | Suggestion chips are pre-built prompts |
| Human+AI hybrid | vs VoicePanel | User controls pace, can switch modes |
| Activation before orientation | General | Capture fields immediately, no tour |

---

*Last updated: 2025-01-02*
