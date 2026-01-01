# Unified Setup V2: Voice-First Design

## Vision

A setup experience that feels like talking to a knowledgeable colleague, not filling out a form. Voice is the primary modality; form is for review and editing.

**Core insight**: Instead of asking users to fill 8 separate fields, we ask ONE open question and let AI extract structure from natural language.

> "Tell me about your research - what are you trying to learn and who are your customers?"

## Design Principles

1. **Voice-first, form-fallback**: Design for voice, form is for review/edit
2. **One question to start**: AI extracts structure from natural language
3. **Minimum barriers**: Only research_goal is truly required
4. **Seamless switching**: Pause voice → edit form → resume anytime
5. **Show progress**: Floating panel shows what's been captured
6. **STT on textareas**: Longer text fields get mic button, short inputs don't

## Three Modes

### 1. Voice Conversation (LiveKit)
Full conversational AI with voice. User speaks naturally, AI asks follow-ups, fields populate in background.

### 2. Text Chat
Same conversational flow, but typed. For noisy environments or preference.

### 3. Form (Typeform-style)
One question at a time with forward/back navigation. Each textarea has STT option.

## Entry Point UI

Like ChatGPT's input, showing available modalities:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Let's set up your research project                            │
│                                                                 │
│   Tell me what you're trying to learn and who your              │
│   customers are. I'll help structure it from there.             │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Type or speak your answer...               [🎤] [🔊]    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   [🎤 Transcribe]  [🔊 Voice Chat]  [📝 Form Instead]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Mode buttons:**
- **🎤 Transcribe**: STT into the input field, send as text to chat
- **🔊 Voice Chat**: Launch full LiveKit voice conversation
- **📝 Form Instead**: Typeform-style one-question-at-a-time

## Voice Chat Mode (Full Screen)

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Exit]                                      [Captured ▼]     │
│                                                                 │
│                                                                 │
│                      ╭──────────────╮                           │
│                      │              │                           │
│                      │   ((◉))      │  ← Glowing voice orb      │
│                      │              │     (pulses with audio)   │
│                      ╰──────────────╯                           │
│                                                                 │
│                    "What problem does your                      │
│                     product solve?"                             │
│                                                                 │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Listening...  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│              [⏸️ Pause]        [✓ Done, review]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Voice Orb Component

A glowing, pulsing sphere that reacts to audio input:
- **Idle**: Soft glow, gentle breathing animation
- **Listening**: Brighter glow, pulses with voice amplitude
- **Processing**: Spinning/morphing animation
- **Speaking**: Different color/pattern when AI talks

Inspired by: [UIverse Voice Orb Challenge](https://uiverse.io/challenges/voice-assistant-orb)

### Floating Captured Panel

Collapsible panel showing progress:
```
┌─────────────────────────┐
│  Captured           [−] │
├─────────────────────────┤
│  ✓ Research goal        │
│  ✓ Company description  │
│  → Customer problem...  │
│    Target audience      │
└─────────────────────────┘
```

Clicking any item allows editing in a mini-form overlay.

## Form Mode (Typeform-style)

One question at a time, animated transitions:

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                                      [1 of 3] [Skip]  │
│                                                                 │
│                                                                 │
│        What are you trying to learn from                        │
│        this research?                                           │
│                                                                 │
│        ┌─────────────────────────────────────────────────┐     │
│        │                                           [🎤]  │     │
│        │                                                 │     │
│        │                                                 │     │
│        └─────────────────────────────────────────────────┘     │
│                                                                 │
│                         [Continue →]                            │
│                                                                 │
│        ● ○ ○                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Forward/back navigation with keyboard (Enter, Shift+Enter)
- Progress dots at bottom
- Skip button for optional questions
- STT button on each textarea
- Smooth slide animations between questions

## Required vs Optional Fields

**Required (must have to proceed):**
- `research_goal` - What are you trying to learn?

**Helpful (AI will ask if not provided):**
- `customer_problem` - What problem do you solve?
- `company_description` - Brief about your company

**Optional (can skip entirely):**
- `target_orgs` - Target industries/organizations
- `target_roles` - Target job roles
- `offerings` - Products/services
- `competitors` - Alternatives in market
- `assumptions` - What you believe to be true
- `unknowns` - What you need to find out

## AI Extraction Flow

When user gives an open response:

1. **Parse**: AI extracts structured fields from natural language
2. **Show**: Display extracted values in the Captured panel
3. **Continue**: AI asks follow-up for missing helpful fields
4. **Done**: User clicks "Done" or AI determines enough context

No confirmation dialogs - trust the AI, let user correct by clicking captured items.

## Contextual Suggestions Integration

Users love our AI-powered suggestions. We need to leverage them in both modes.

### Current System
- BAML `GenerateContextualSuggestions` generates 3 context-aware suggestions
- Supports: decision_questions, assumptions, unknowns, organizations, roles
- Uses research_goal + current_input as context
- Tracks shown/rejected to avoid repeats

### Form Mode (Typeform-style)
1. **Pre-generate suggestions** before showing each question (not after focus)
2. **Show prominently** as animated chips below the input
3. **For tag fields** (orgs, roles): One-click pills - "Tap to add: [Fintech startups] [SaaS companies]"
4. **For text fields**: Show as sentence starters or examples
5. **Keyboard shortcut**: Tab to cycle through suggestions, Enter to accept

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Who are your target customers?                                │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Series A B2B SaaS companies...                    [🎤]  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   Suggestions:                                                  │
│   [+ Fintech startups] [+ Healthcare enterprises] [+ E-commerce]│
│                                                                 │
│                         [Continue →]                            │
└─────────────────────────────────────────────────────────────────┘
```

### Voice/Chat Mode (Agent Tool)
Create `generateFieldSuggestions` tool for agents to proactively offer options:

```typescript
// New tool for agents
generateFieldSuggestions({
  fieldType: "target_orgs",
  researchGoal: "Understand why SMBs churn...",
  existingValues: ["Fintech startups"],
  count: 3
})
// Returns: ["Series A B2B SaaS", "Healthcare startups", "E-commerce brands"]
```

**Conversation flow:**
```
Agent: "Who are your target customers?"
User: "Um... I'm not sure how to describe them"
Agent: *calls generateFieldSuggestions*
Agent: "No problem. Based on your research goal, I'm thinking:
        - Series A B2B SaaS companies, or
        - Enterprise healthcare organizations?
        Does either sound right?"
User: "The first one"
Agent: *saves target_orgs: ["Series A B2B SaaS companies"]*
Agent: "Got it. What problem does your product solve for them?"
```

**Voice mode benefits:**
- Reduces cognitive load - user doesn't have to articulate from scratch
- Faster completion - "yes" or "the second one" vs composing an answer
- Handles "I don't know" gracefully with concrete options
- Agent can offer to combine: "Both of those, or maybe something else?"

### Implementation
1. Create `generateFieldSuggestionsTool` in `app/mastra/tools/`
2. Wire to existing BAML `GenerateContextualSuggestions` function
3. Add to project-setup-agent and LiveKit agent tools
4. Update agent prompts to use suggestions when user hesitates

## Components to Build

### 1. VoiceOrb
Glowing sphere with audio-reactive animations:
```tsx
<VoiceOrb
  state="listening" // idle | listening | processing | speaking
  audioLevel={0.7}  // 0-1, from audio analyzer
  size="lg"         // sm | md | lg | xl
/>
```

### 2. TypeformQuestion
Single-question display with navigation:
```tsx
<TypeformQuestion
  question="What are you trying to learn?"
  description="Be specific about your research goals"
  fieldType="textarea"
  value={value}
  onChange={onChange}
  onNext={handleNext}
  onBack={handleBack}
  onSkip={handleSkip}
  showSTT={true}
  stepNumber={1}
  totalSteps={3}
/>
```

### 3. CapturedPanel
Floating progress panel:
```tsx
<CapturedPanel
  items={[
    { key: 'research_goal', label: 'Research goal', status: 'complete' },
    { key: 'customer_problem', label: 'Customer problem', status: 'in_progress' },
    { key: 'target_orgs', label: 'Target audience', status: 'pending' },
  ]}
  onItemClick={handleEdit}
  collapsed={isCollapsed}
  onToggle={toggleCollapsed}
/>
```

### 4. SetupModeSelector
Entry point with mode options:
```tsx
<SetupModeSelector
  onModeSelect={(mode) => setMode(mode)} // 'voice' | 'chat' | 'form'
  defaultPrompt="Tell me about your research..."
/>
```

## Existing Components to Leverage

- `LiveWaveform` - Audio visualization (already built)
- `VoiceButton` - STT button with waveform (already built)
- `useSpeechToText` hook - STT functionality (already built)
- `ProjectSetupChat` - Text chat mode (needs integration)
- LiveKit agents - Voice conversation (needs setup integration)

## State Management

Use existing `ProjectSetupProvider` and Zustand store:
- All modes write to same store
- Real-time sync between modes
- Persist to `project_sections` table
- Debounced saves with optimistic UI

## Voice Agent Prompts

Keep prompts short and conversational:

```
"Hi! Let's set up your research project. In a sentence or two,
what are you trying to learn?"

[User responds]

"Got it. And who are your typical customers -
what kind of companies and roles?"

[User responds]

"Perfect. One more thing - what problem does your
product solve for them?"

[User responds]

"Great, I've captured everything. You can review
and edit anytime by clicking 'Done'."
```

## Mobile Considerations

- Voice mode: Full screen, large orb, big touch targets
- Form mode: Same Typeform approach works well on mobile
- Captured panel: Bottom sheet instead of floating panel

## Success Metrics

- **Completion rate**: Target 80%+ (up from ~60% with forms)
- **Time to complete**: Target <3 min average
- **Voice adoption**: Track % choosing voice vs form
- **Edit rate**: How often do users correct AI extractions?

## Implementation Phases

### Phase 1: Voice Orb + Typeform
- Build VoiceOrb component
- Build TypeformQuestion component
- Create form mode with single-question flow

### Phase 2: Voice Integration
- Connect LiveKit agent to setup flow
- Build CapturedPanel
- Real-time field extraction during voice

### Phase 3: Polish
- Animations and transitions
- Mobile optimization
- Analytics and metrics

---

## Sources & Inspiration

- [UIverse Voice Assistant Orb Challenge](https://uiverse.io/challenges/voice-assistant-orb)
- [CodePen AI Glow Orb](https://codepen.io/HomesteadMovies/pen/emOdgYa)
- [Voice-Reactive Orb in React (Medium)](https://medium.com/@therealmilesjackson/building-a-voice-reactive-orb-in-react-audio-visualization-for-voice-assistants-2bee12797b93)
- Existing `LiveWaveform` and `VoiceButton` components in codebase
