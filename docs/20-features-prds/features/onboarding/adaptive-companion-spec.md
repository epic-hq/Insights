# Adaptive Companion Spec

> **Status:** Ready for Implementation
> **Created:** 2025-01-02
> **Last Updated:** 2025-01-05

The Adaptive Companion is our voice-first onboarding experience that starts conversational and reveals structure as needed. It combines the magic of AI conversation with the reliability of structured forms.

**Core Philosophy:** Start magical, reveal structure as captured.

---

## Table of Contents

### Part 1: Concept & Design
1. [Executive Summary](#executive-summary)
2. [Design Principles](#design-principles)
3. [Competitive Context](#competitive-context)
4. [User Research Insights](#user-research-insights)
5. [User Flows & Wireframes](#user-flows--wireframes)
6. [Success Metrics](#success-metrics)
7. [Open Questions](#open-questions)

### Part 2: Implementation Details
8. [Component Architecture](#component-architecture)
9. [Data Flow & Extraction](#data-flow--extraction)
10. [AI Agent Integration](#ai-agent-integration)
11. [Implementation Phases](#implementation-phases)
12. [Files Changed](#files-changed)
13. [Testing Plan](#testing-plan)

---

# Part 1: Concept & Design

## Executive Summary

The Adaptive Companion replaces traditional form-based onboarding with a conversational experience. Users talk or type naturally about their research goals, and the AI extracts structured data in real-time, displaying it in a "captured" panel.

**Key differentiator:** Two-pane layout (Chat + Captured) that provides both conversational magic and structural reassurance.

---

## Design Principles

### 1. Conversation First, Structure Second
Users think in goals ("help me figure out what to ask customers"), not input modes. The interface starts with conversation and reveals structure as fields are captured.

### 2. Always Escapable
Every interaction has an exit path. Users can:
- Switch to form mode at any time
- Skip questions
- Edit captured fields directly
- Bypass onboarding entirely

### 3. Real-Time Feedback
As the AI extracts information, the Captured panel updates immediately. Users see their words transformed into structured data, building trust.

### 4. Traceability
Every AI-extracted field links back to the source utterance. Users can verify and correct extractions by seeing exactly what they said.

### 5. Multi-Modal Input
Support voice, text, and form equally. Some users can't or won't talk; others find typing tedious. Let them choose.

---

## Competitive Context

| Competitor | Their Approach | Our Advantage |
|------------|----------------|---------------|
| **VoicePanel** | AI-only interviews | Human+AI hybrid, user controls pace |
| **Dovetail** | Complex enterprise forms | Conversational simplicity |
| **Looppanel** | Form-based analysis | Voice-first collection |
| **Condens** | Two interfaces (researcher/stakeholder) | Two-pane (chat/captured) in one view |

### Key Competitive Patterns We're Adopting

| Pattern | Source | How We Apply It |
|---------|--------|-----------------|
| Two interfaces | Condens | Chat pane (conversation) + Captured pane (structure) |
| Traceability | Looppanel | Every field links to source utterance |
| Text-based clips | Grain | Click transcript text to capture |
| Recipes/templates | Granola | Suggestion chips are pre-built prompts |
| Human+AI hybrid | vs VoicePanel | User controls pace, can switch modes |

---

## User Research Insights

1. **60% need guidance** - Users don't know what to ask; conversation helps
2. **Voice adoption varies** - Some can't/won't talk; need text fallback
3. **Structure reassures** - Seeing captured data builds confidence
4. **Repeat use differs** - First-time needs magic; returning users want speed

### Implication
The Adaptive Companion must work for both:
- **New users:** Conversational, guided, magical
- **Returning users:** Quick form access, skip ahead, edit directly

---

## User Flows & Wireframes

### Initial State (Empty)

Single-pane conversational UI. The Captured panel appears as a minimal footer showing what fields exist but are empty.

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

### After Interaction (Two-Pane)

Once the first field is captured, the layout expands to show both the ongoing conversation and the accumulated structure.

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
│  │  customers and I want to          │  [View source ↗]       │ │
│  │  understand why they churn.       │                        │ │
│  │                                   │  Target Roles          │ │
│  │  ┌─────┐ Got it! Who should we    │  ┌──────────────────┐  │ │
│  │  │ ◉◉◉ │ talk to? I'd suggest:    │  │ [VP Engineering] │  │ │
│  │  └─────┘                          │  │ [+ Add...]       │  │ │
│  │                                   │  └──────────────────┘  │ │
│  │  Suggestions:                     │                        │ │
│  │  [VP Engineering] [CTO]           │  Company Context       │ │
│  │  [Product Manager]                │  ┌──────────────────┐  │ │
│  │                                   │  │ (Not yet...)     │  │ │
│  │  ┌─────────────────────────────┐  │  └──────────────────┘  │ │
│  │  │ Also product managers...    │  │                        │ │
│  │  └─────────────────────────────┘  │  [✓ Looks Good]       │ │
│  │                                   │                        │ │
│  │  [🎤] [⌨️]                        │                        │ │
│  └───────────────────────────────────┴────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mode Transitions

#### Chat → Form
When user clicks "📝 Show Form":
1. Fade out chat pane
2. Show Typeform-style single-question view
3. Pre-fill with any captured values
4. Keep captured pane visible (optional)

#### Chat → Voice
When user clicks "🎤 Speak" or activates voice:
1. Expand VoiceOrb to prominent position
2. Keep chat visible (for transcription)
3. Captured pane updates in real-time
4. Return to chat when voice ends

#### Form → Chat
When user clicks "💬 Back to Chat":
1. Resume chat from last position
2. Acknowledge form progress: "I see you've filled in X, Y, Z..."
3. Ask about remaining fields

### Mobile Responsiveness

| Breakpoint | Layout |
|------------|--------|
| < 640px (sm) | Single column, tabs for Chat/Captured |
| 640-1024px (md) | Side-by-side, narrower captured pane |
| > 1024px (lg) | Full two-pane with comfortable widths |

#### Mobile Layout (Tab-Based)

```
┌─────────────────────────┐
│  Set up your research   │
├─────────────────────────┤
│  [Chat] [Captured (2)]  │  ← Tab bar with count badge
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

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Setup completion rate | 80%+ | ~60% |
| Time to complete | < 3 min | Unknown |
| Voice adoption | 30%+ | 0% (not built) |
| Field extraction accuracy | 90%+ | N/A |
| User correction rate | < 20% | N/A |

---

## Open Questions

1. **Returning Users:** Should they skip to form mode by default?
2. **AI Tone:** Formal? Friendly? How much personality?
3. **Voice Quality:** What's our transcription accuracy target?
4. **Error Handling:** How do we handle extraction mistakes gracefully?

---

# Part 2: Implementation Details

## Component Architecture

### Hierarchy

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

### Key Component Interfaces

```typescript
// AdaptiveCompanion - Main orchestrator
interface AdaptiveCompanionProps {
  accountId: string;
  projectId: string;
  projectName: string;
  onSetupComplete: () => void;
  initialMode?: 'chat' | 'voice';
}

// CapturedPane - Right-side panel
interface CapturedPaneProps {
  items: CapturedField[];
  onFieldClick: (fieldKey: string) => void;
  onFieldEdit: (fieldKey: string, value: string | string[]) => void;
  showTraceability?: boolean;
}

interface CapturedField {
  key: string;
  label: string;
  status: 'pending' | 'in_progress' | 'complete';
  value?: string | string[];
  preview?: string;
  required?: boolean;
  sourceMessageId?: string;
  sourceUtterance?: string;
}

// ChatPane - Left-side chat
interface ChatPaneProps {
  messages: Message[];
  onSend: (text: string) => void;
  onSuggestionClick: (suggestion: string) => void;
  suggestions: string[];
  isProcessing: boolean;
  voiceEnabled?: boolean;
  onVoiceStart?: () => void;
}

// FieldCard - Individual captured field
interface FieldCardProps {
  field: CapturedField;
  onClick: () => void;
  onEdit: (value: string | string[]) => void;
  showTraceability?: boolean;
}
```

### State Management

```typescript
// ProjectSetupProvider store shape (Zustand)
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

---

## Data Flow & Extraction

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

### Traceability Implementation

Every AI-extracted field links back to its source utterance:

1. **Agent extracts with context:**
```typescript
extractFieldValue({
  fieldKey: "research_goal",
  value: "Understand why enterprise customers churn",
  sourceMessageId: "msg_abc123",
  sourceText: "We're losing enterprise customers and I want to understand why they churn",
  confidence: 0.95
})
```

2. **FieldCard shows source:**
```tsx
<FieldCard field={field}>
  <SourceLink onClick={() => scrollToMessage(field.sourceMessageId)}>
    From: "We're losing enterprise customers..."
  </SourceLink>
</FieldCard>
```

3. **Click highlights original:**
- Scroll chat to source message
- Highlight with pulse animation
- User can correct if wrong

---

## AI Agent Integration

### Project Setup Agent Tools

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
  },

  // Generate suggestions for a field
  generateFieldSuggestions: {
    parameters: z.object({
      fieldType: z.enum(['target_orgs', 'target_roles', 'decision_questions']),
      researchGoal: z.string(),
      existingValues: z.array(z.string()).optional(),
      count: z.number().default(3)
    }),
  },

  // Suggest next conversation steps
  suggestNextSteps: {
    parameters: z.object({
      suggestions: z.array(z.string()).max(4)
    }),
  },

  // Navigate when setup complete
  navigateToPage: {
    parameters: z.object({
      path: z.string()
    }),
  },

  // Switch to different agent
  switchAgent: {
    parameters: z.object({
      targetAgent: z.enum(['project-status', 'interview-agent']),
      reason: z.string()
    }),
  }
}
```

### Agent System Prompt

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

## Flow
1. Ask about research goal
2. Based on answer, ask about customers
3. Clarify any missing context
4. Confirm and complete

When research_goal is captured with reasonable detail, use switchAgent to complete setup.
```

---

## Implementation Phases

### Phase 1: Two-Pane Layout (Week 1)

**Files to create/modify:**
- `app/features/projects/components/AdaptiveCompanion.tsx` (NEW)
- `app/features/projects/components/CapturedPane.tsx` (NEW)
- `app/features/projects/components/ChatPane.tsx` (NEW)
- `app/features/projects/pages/setup.tsx` (MODIFY)

**Deliverables:**
- [ ] Two-pane layout with responsive breakpoints
- [ ] Chat pane with existing ProjectSetupChat logic
- [ ] Captured pane showing field progress
- [ ] Smooth expansion from single to two-pane

### Phase 2: Real-Time Extraction (Week 2)

**Files to create/modify:**
- `app/mastra/agents/project-setup-agent.ts` (MODIFY)
- `app/mastra/tools/extract-field-value.ts` (NEW)
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

---

## Files Changed

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
