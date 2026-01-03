# UI Proposals: Onboarding & Setup Experience

*Created: 2025-01-02*
*Status: Draft for Review*

## Context

These proposals address the onboarding and setup experience for UpSight. The goal is to balance:
- **Magic**: Voice-first, conversational feel
- **Efficiency**: Works for repetitive use, not just first-time setup
- **Flexibility**: Users who can't/don't want to talk need alternatives

## Key Constraints

1. LiveKit agent is **working now** with 30 tools
2. MCP tools is minimal additional work
3. UI must survive beyond onboarding (repetitive use)
4. Both structure AND conversation are needed

---

## Proposal A: Conversational Canvas

**Philosophy**: Voice is primary, interface is secondary. The VoiceOrb is the hero.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                              Project: Customer Research │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                         ┌─────────┐                             │
│                         │  ◉ ◉ ◉  │  ← VoiceOrb (large, center) │
│                         │   ◉◉◉   │                             │
│                         │  ◉ ◉ ◉  │                             │
│                         └─────────┘                             │
│                                                                 │
│                    "Tell me about your project"                 │
│                                                                 │
│         ┌──────────────────────────────────────────┐            │
│         │ Type here or press Space to talk...      │            │
│         └──────────────────────────────────────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Captured:  [Research Goal ✓]  [Target Roles]  [Company]        │
│             ↑ Real-time extraction shown as chips               │
└─────────────────────────────────────────────────────────────────┘
```

### User Flow

```
1. User lands on canvas
   └─ VoiceOrb pulses, inviting interaction
   └─ OR: Text input visible for non-voice users

2. Voice/Text conversation
   └─ User describes their research
   └─ AI asks clarifying questions
   └─ Real-time field extraction (chips appear)

3. Captured fields shown
   └─ User can click chips to edit
   └─ AI confirms understanding

4. Transition to next step
   └─ "Great, now let's set up your questions..."
```

### Pros
- Maximally conversational
- Voice is clearly the star
- Real-time feedback builds trust

### Cons
- May feel empty/intimidating to some users
- Less structure for those who want it
- Harder to scan progress

---

## Proposal B: Command Center

**Philosophy**: Efficiency-first. Structure visible, voice available.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Project Setup                                      [◉] Voice   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Research Context ─────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Research Goal                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ Understand why enterprise customers churn...         │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  Target Roles              Target Organizations            │ │
│  │  ┌──────────────────┐      ┌──────────────────┐            │ │
│  │  │ + Add role...    │      │ + Add org type...│            │ │
│  │  │ [VP Engineering] │      │ [Series B SaaS]  │            │ │
│  │  │ [Product Manager]│      │ [100-500 emp]    │            │ │
│  │  └──────────────────┘      └──────────────────┘            │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Company Context ──────────────────────────────────────────┐ │
│  │  What does your company do?                                │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ B2B SaaS platform for...                             │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Generate Interview Questions →]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### User Flow

```
1. User sees structured form
   └─ All fields visible
   └─ Voice button available (top right)

2. Fill manually OR voice
   └─ Click field: type directly
   └─ Click voice: speak to fill current field
   └─ Voice can fill multiple fields at once

3. AI suggestions appear
   └─ Based on what's filled
   └─ Click to accept suggestions

4. Generate questions
   └─ One-click to proceed
```

### Pros
- Clear structure, scannable
- Works well for repeat users
- Voice is available but not required

### Cons
- Less magical, more "enterprise software"
- Voice feels secondary
- First-time experience may be less engaging

---

## Proposal C: Adaptive Companion (RECOMMENDED)

**Philosophy**: Start with conversation, reveal structure as needed.

### Layout - Initial State

```
┌─────────────────────────────────────────────────────────────────┐
│  Set up your research                                   [···]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │       ┌─────┐                                               ││
│  │       │ ◉◉◉ │  Hi! I'm here to help set up your research.  ││
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

### Layout - After Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│  Set up your research                                   [···]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Chat ────────────────────────────┬─ Captured ─────────────┐ │
│  │                                   │                        │ │
│  │  ┌─────┐ I'm here to help set up  │  Research Goal ✓       │ │
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

### User Flow

```
1. Initial State: Conversational
   └─ Small VoiceOrb with greeting
   └─ Text input prominent
   └─ "Show Form" escape hatch

2. Conversation builds structure
   └─ User speaks or types
   └─ Right panel populates in real-time
   └─ AI suggests options (clickable)

3. User can intervene anytime
   └─ Click to edit captured fields
   └─ "Show Form" expands structure
   └─ Typing in fields works directly

4. Confirmation
   └─ "Looks Good" to proceed
   └─ Or continue refining
```

### Pros
- Starts magical, reveals efficiency
- Real-time feedback builds trust
- Multiple input modes available
- Works for first-time AND repeat use
- Structure visible when needed

### Cons
- More complex to implement
- Two-pane layout may feel busy on mobile
- Need to handle state transitions well

---

## Proposal D: Immersive Flow

**Philosophy**: Full-screen conversation, structure hidden until complete.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                         ┌──────────────┐                        │
│                         │              │                        │
│                         │   ◉ ◉ ◉ ◉ ◉  │                        │
│                         │  ◉ ◉ ◉ ◉ ◉ ◉ │  ← Large animated orb  │
│                         │   ◉ ◉ ◉ ◉ ◉  │                        │
│                         │              │                        │
│                         └──────────────┘                        │
│                                                                 │
│            "What problem are you trying to solve?"              │
│                                                                 │
│     ┌───────────────────────────────────────────────────┐       │
│     │                                                   │       │
│     │  Our enterprise customers are churning and...     │       │
│     │                                                   │       │
│     └───────────────────────────────────────────────────┘       │
│                                                                 │
│                    ● ● ○ ○ ○  Progress dots                     │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### User Flow

```
1. Immersive conversation
   └─ One question at a time
   └─ Full screen focus
   └─ Progress dots show journey

2. AI guides through topics
   └─ Research goal
   └─ Target customers
   └─ Company context
   └─ Interview preferences

3. Summary screen at end
   └─ All captured fields shown
   └─ Edit anything before proceeding

4. Proceed to questions
   └─ "Generate Questions" CTA
```

### Pros
- Maximum focus and immersion
- Typeform-style familiarity
- Clear progress indication
- Works beautifully on mobile

### Cons
- No structure visible during
- Can't skip ahead easily
- May feel slow for power users
- Repeat use may be frustrating

---

## Competitive Context (Updated: 2025-01-02)

Based on comprehensive competitive research (see `/docs/competitors/`), here's how these proposals compare:

### Pattern Mapping

| Pattern | Source | Which Proposal | Priority |
|---------|--------|----------------|----------|
| Text-based highlight creation | Grain | All (voice = text = valid) | High |
| Two interfaces (researcher + stakeholder) | Condens | C (chat + captured panel) | **High** |
| Question-grouped analysis | Looppanel | Post-setup (lens group view) | **High** |
| Recipes/templates | Granola | C (AI suggestions) | Medium |
| Role-based dashboards | Gong | Post-setup feature | Medium |
| Ask feature | Clarify, Fathom | Voice input in all | Medium |
| Credit-based AI pricing | Clarify | N/A (business model) | Consider |
| Traceability for AI outputs | Looppanel | All proposals | **High** |
| Free stakeholder access | Looppanel | N/A (pricing model) | Consider |

### Key Insights from Research

1. **"Activation BEFORE orientation"** - Users should create something real immediately, then get orientation.

2. **VoicePanel is our closest competitor** - They're AI-only; we differentiate with Human+AI hybrid.

3. **Two-interface pattern is critical** - Researchers need depth; stakeholders need simplicity. Proposal C handles this.

4. **Traceability builds trust** - Every AI output must link to source evidence. This is non-negotiable.

5. **Integration story matters** - User Interviews, recall.ai, calendar sync, CRM write-back all needed.

### Threat Assessment Impact

| Competitor | Threat | Implication for Onboarding |
|------------|--------|---------------------------|
| VoicePanel (HIGH) | AI-only interviews | Emphasize human+AI hybrid in setup flow |
| Dovetail (HIGH) | Market leader | Simpler onboarding is our edge |
| Looppanel (Med-High) | Great UX patterns | Adopt question-grouped analysis |

**Implication**: All proposals should get to captured data FAST, not after a tour. Proposal C best handles the need for both simplicity (voice) and power (structure).

---

## Recommendation

**Proposal C: Adaptive Companion** is recommended because:

1. **Handles all user types**: Voice users, typers, form-lovers
2. **Shows progress**: Real-time capture builds confidence
3. **Survives repeat use**: Structure available when needed
4. **Competitive advantage**: Combines Grain's text-first with VoicePanel's AI
5. **Human+AI Hybrid**: Positions us against VoicePanel's AI-only approach
6. **Two-Interface Ready**: Chat vs. captured panel maps to Condens pattern

### Implementation Priority

1. Build the two-pane layout (chat + captured)
2. Implement real-time extraction to captured panel
3. Add voice input to chat (LiveKit already working with 30 tools)
4. Add "Show Form" escape hatch
5. Polish transitions and animations
6. **Add traceability**: Link all AI-captured fields to source utterances

---

## Open Questions

1. **Mobile Experience**: How does two-pane work on mobile? (Stack vertically? Tabs?)
2. **Returning Users**: Should they skip to form mode by default?
3. **Voice Quality**: What's our transcription accuracy target?
4. **AI Tone**: Formal? Friendly? How much personality?
5. **Pricing Model**: Credit-based (Clarify) or per-seat? Need to not lose money (bootstrapped).
6. **Integration Priority**: recall.ai alpha (ETA Jan 15) → calendar sync → CRM write-back → email workflow

---

## Related Feature: Question-Grouped Analysis

A high-priority pattern from Looppanel that affects post-setup experience. See `/docs/features/conversation-lenses/question-grouped-analysis.md` for implementation details.

**What It Is**: Instead of viewing analyses by interview (current), group responses by interview question across all interviews.

**Current State**: `aggregated-generic.tsx` shows analyses per interview.

**Needed Change**: Add view mode that groups Q&A pairs by question topic.

```
CURRENT VIEW (Interview-Grouped)
├── Interview 1
│   ├── Q1: What's your biggest challenge?
│   │   └── A1: "Scaling our team..."
│   └── Q2: How do you measure success?
│       └── A2: "We track NPS..."
└── Interview 2
    ├── Q1: What's your biggest challenge?
    │   └── A1: "Integration complexity..."
    └── Q2: How do you measure success?
        └── A2: "Revenue per user..."

NEEDED VIEW (Question-Grouped)
├── Q: What's your biggest challenge?
│   ├── Interview 1: "Scaling our team..."
│   ├── Interview 2: "Integration complexity..."
│   └── [Pattern: Scaling concerns are common]
└── Q: How do you measure success?
    ├── Interview 1: "We track NPS..."
    ├── Interview 2: "Revenue per user..."
    └── [Pattern: Mix of leading and lagging indicators]
```

**Why It Matters**: Enables instant cross-interview pattern detection. Looppanel's users love this.

---

*Last updated: 2025-01-02*
*To be reviewed with team and updated based on feedback*
