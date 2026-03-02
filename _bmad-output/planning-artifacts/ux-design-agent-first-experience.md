---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
workflowComplete: true
inputDocuments:
  - docs/50-market/brand-brief.md
  - docs/20-features-prds/features/onboarding/adaptive-companion-spec-v2.md
  - docs/20-features-prds/features/onboarding/unified-onboarding-ui-spec.md
  - docs/20-features-prds/features/onboarding/adaptive-companion-spec.md
  - docs/20-features-prds/design/ui-style.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
focusArea: Agent-First Experience - Onboarding through Ongoing Use
---

# UX Design Specification: Agent-First Experience

**Author:** Rick
**Date:** March 2, 2026
**Focus:** Agent-centered layout paradigm — from first login through daily use

---

## 1. Product Context

### 1.1 Project Vision

UpSight is reimagining its core interaction model from a traditional nav-and-pages SaaS into an **agent-first experience** where the AI assistant (Uppy) is the primary interface. The agent occupies center stage on first login, guides users through onboarding via rich interactive components rendered inside the conversation, then transitions to a persistent side panel as users begin working — creating a two-column agent+canvas layout that becomes the default for daily use.

This isn't just an onboarding redesign. It's a paradigm shift: from "app with AI assistant" to "AI assistant with a canvas."

### 1.2 What's Being Replaced

| Current System | Status | Replacement |
|---|---|---|
| Steps to Wow (3-path picker + step guide) | **Deprecated** | Agent-driven first actions via rich chat cards |
| FeatureTour (swipeable slides) | **Deprecated** | Agent introduction in first conversation |
| OnboardingFlow (full-page multi-step) | **Deprecated** | Agent-guided setup conversation |
| JourneySidebarGroup (sidebar progress) | **Deprecated** | Agent-aware progress in chat + canvas |
| OnboardingWalkthrough (profile modal) | **Kept** | Stays as-is — collects profiling data (role, use case, company size) that informs the agent's first conversation |
| AIAssistantPanel (floating side panel) | **Evolved** | Becomes the persistent agent column in two-column layout |
| CanvasPanel (A2UI surface) | **Evolved** | Becomes the primary content canvas, enriched with new components |

### 1.3 Brand Alignment

- **Core Promise:** "Get your customers." — help users understand their customers deeply and take clear next steps
- **Voice:** Direct, Confident, Grounded, Useful
- **Core Value:** Understanding that leads to decisions. Not just evidence and receipts — clear next steps, synthesized understanding, and the feeling of being *helped* through complexity
- **Archetype:** The Trusted Operator — calm, experienced, not flashy. The person you want in the room when decisions get hard.
- **Agent personality:** Confident guide who helps you make sense of what you're hearing. Suggests clear next steps without being bossy. Warm but not performative.

### 1.4 Target Users

**Primary personas** (from brand brief):
- **Consultants / Fractional Execs**: Navigating complex stakeholder landscapes — multiple interviews, competing priorities, organizational politics. Need to synthesize fast and deliver clarity to clients. The agent should help them make sense of tangled stakeholder input and surface what matters.
- **Founders (5-30 people)**: Talk to customers constantly, insights trapped in their head. Need the product to capture and organize what they already know.
- **Post-Launch Founders**: Growth stalled, need to find signal in existing conversations fast. Highest urgency.
- **Product Leads (no research team)**: Own customer insight but lack time and tools. Need research infrastructure without the overhead.

**Common traits:**
- Tech-savvy but not power users
- Time-poor, need fast value
- Want to be evidence-driven but lack infrastructure
- 1-50 person teams
- Need to feel *helped*, not lectured

### 1.5 Key Design Challenges

1. **Blank chat → first impression**: The centered agent on first load must feel inviting, not empty. Suggestion badges give users immediate action options without requiring them to know what to type.
2. **Layout transition**: Agent center → agent+canvas must feel like progress, not breakage
3. **Agent authority vs. user agency**: Suggestions must feel like offers, not directives. "Here are some things we could do" energy.
4. **Chat vs. canvas boundary**: Clear mental model for what lives where
5. **Returning user experience**: Agent transitions from main character to persistent collaborator
6. **Mobile expression**: Agent-first paradigm needs a native mobile form
7. **Consultant complexity**: Stakeholder landscapes are messy — the agent needs to help organize, not just collect

### 1.6 Design Opportunities

1. **"The agent remembers"**: Context-aware greetings that build relationship over time. Returning users see progress, not a blank slate.
2. **Rich components as product signature**: Beautiful interactive cards that only appear through the agent — action suggestions, progress summaries, data visualizations
3. **Canvas as living workspace**: Agent updates canvas in real-time as you converse. The two columns become a collaborative workspace.
4. **Onboarding teaches the paradigm**: First session establishes the agent+canvas interaction model that carries through daily use
5. **Sense-making, not just data collection**: The agent doesn't just extract fields — it helps users see patterns, contradictions, and clear next steps across complex inputs

---

## 2. Core User Experience

### 2.1 Defining Experience

**"You tell the agent what you need. The agent helps you figure it out."**

The core interaction is conversational sense-making. Users speak or type naturally about what they're trying to understand, and Uppy responds with a combination of:
- **Understanding** — synthesizing what the user said, reflecting it back
- **Rich suggestions** — interactive cards offering clear next steps
- **Canvas work product** — evidence, patterns, comparisons, and visualizations that appear in the canvas as the conversation progresses

The core loop:

```
Tell Uppy what you need → Uppy shows you something useful in the canvas
→ You react / refine → Uppy updates → You take action
```

This loop applies equally to onboarding (first 5 minutes) and daily use (month 6).

### 2.2 Layout Logic

The layout is driven by a single question: **does the agent have something to show?**

| State | Layout | When |
|---|---|---|
| **No canvas content** | Agent centered (full width) | New project, fresh conversation, no data yet |
| **Canvas content exists** | Agent + Canvas (two columns) | Agent generated a visualization, loaded evidence, or opened a tool |
| **Returning to existing project** | Agent + Canvas | Project has data — agent greets in side panel, canvas shows last context |
| **New project on existing account** | Agent centered | Fresh project = fresh start, agent takes center stage again |

The transition from centered → two-column happens **the moment the agent has something to render in the canvas**. This could be:
- An evidence wall from uploaded conversations
- A stakeholder map from setup chat
- A survey builder the user asked to create
- A theme cluster from processed data

The transition is animated (agent compresses left, canvas expands from right) and accompanied by an agent message acknowledging the shift: "Here's what I found — take a look."

### 2.3 Persona-Aware First Encounter

After the OnboardingWalkthrough modal collects role, use case, and company size, the agent's first conversation is tailored:

**Consultant sees:**
> "Hey! I'm Uppy, your research partner. Since you're working with clients, let's get started."
>
> `[Upload a stakeholder interview]` `[Map a client's org]` `[Tell me about your project]`

**Founder sees:**
> "Hey! I'm Uppy, your research partner. Let's turn your customer conversations into something you can act on."
>
> `[Upload customer conversations]` `[Create a discovery survey]` `[Tell me what you're trying to learn]`

**Product Lead sees:**
> "Hey! I'm Uppy, your research partner. Let's build the evidence base your team needs."
>
> `[Upload user interviews]` `[Set up research goals]` `[Tell me what decisions you're facing]`

Every persona always has a freeform "Tell me..." option so users never feel boxed in.

### 2.4 Platform Strategy

| Aspect | Decision |
|---|---|
| Primary | Web app (React Router 7 + Vite) |
| Input | Text + voice, mouse/keyboard primary |
| Mobile | Full-screen agent chat, canvas via tab/swipe |
| Desktop | Two-column agent + canvas, resizable divider |
| Offline | Not required (cloud-first) |
| Key capability | Real-time canvas updates from agent tool calls |

### 2.5 Effortless Interactions

| Interaction | How It Should Feel |
|---|---|
| First action after login | One tap on a suggestion badge — zero typing required |
| Uploading content | Drag-and-drop or voice: "I just had a call with Sarah" |
| Seeing results | Canvas updates automatically as processing completes — no refresh, no navigation |
| Getting next steps | Agent proactively suggests after each milestone, as rich cards with one-tap actions |
| Switching contexts | Agent remembers where you left off per project. "Welcome back — you were looking at churn patterns." |
| Understanding complexity | Consultant uploads 8 stakeholder interviews → agent shows a comparison matrix, highlights contradictions, suggests follow-up questions |

### 2.6 Critical Success Moments

1. **First suggestion badge tap** → user takes their first action without having to figure out the UI. Sets the tone: "this app guides me."
2. **First canvas content appears** → the layout shifts, and the user sees the agent *produced something*. "Oh, it actually does things." This is the aha moment.
3. **First pattern surfaced** → "3 people mentioned the same pain point." The user feels the product's value: understanding from chaos.
4. **First clear next step** → Agent says "Based on what you've heard, here's what I'd explore next." The user feels *helped*, not just informed.
5. **Returning user greeting** → "Welcome back. Yesterday you uploaded 3 interviews — I found some patterns worth discussing." The agent *remembers*. Trust deepens.

### 2.7 Experience Principles

1. **Conversation is the interface.** Users talk, the agent works. Navigation and forms are escape hatches, not the primary path.
2. **Show, don't tell.** The agent doesn't describe what it found — it shows it in the canvas. Evidence walls, comparison matrices, theme clusters appear as the conversation progresses.
3. **Always suggest the next step.** The user should never wonder "what do I do now?" Every milestone ends with a suggestion badge or card for what comes next.
4. **The agent earns trust through usefulness.** Not through claims ("I'm powered by advanced AI") but through action ("Here are the 3 contradictions across your stakeholder interviews").
5. **Layout follows content.** The UI shape is determined by what exists to show, not by navigation state or onboarding progress.

---

## 3. Desired Emotional Response

### 3.1 Primary Emotional Goals

The differentiating emotion is not "impressed by AI" — it's **helped by a partner**. The agent should feel like a smart colleague who already read all the transcripts and organized their thoughts before you sat down together.

Users should feel:
- **Welcomed** on first load — not overwhelmed, not lost
- **Capable** after their first action — "that was easy"
- **Relief** when complexity gets organized — "someone helped me make sense of this"
- **Helped** by proactive suggestions — "I'm not alone in figuring this out"
- **Recognized** when returning — "it remembers where we left off"
- **Confident** when presenting findings — "I can defend this with evidence"

### 3.2 Emotional Journey Mapping

| Stage | Desired Feeling | What Triggers It |
|---|---|---|
| **First load (agent centered)** | Welcomed, not overwhelmed | Warm greeting + suggestion badges = "I know what to do" |
| **First suggestion tap** | Capable | "That was easy. I didn't have to figure anything out." |
| **Layout transition** | Progress, momentum | Canvas appears = the agent produced something. "We're getting somewhere." |
| **First pattern surfaced** | Relief + clarity | "Oh — THAT's what's going on across these conversations." |
| **First clear next step** | Helped | Agent suggests what to do next. "I'm not alone in figuring this out." |
| **When something goes wrong** | Supported, not abandoned | Agent explains what happened and offers alternatives. Never a dead end. |
| **Returning next day** | Recognized | "Welcome back — here's where we left off." The agent knows me. |
| **Presenting to team/client** | Confident | Evidence with receipts = "I can defend this." |

### 3.3 Emotions to Avoid

| Avoid | How We Prevent It |
|---|---|
| **Overwhelm** | Agent centered = one conversation, not 47 nav items |
| **Abandonment** | Always suggest next steps. Never leave user at a dead end. |
| **Skepticism** | Show sources. Every insight links to evidence. |
| **Performance anxiety** | No "you haven't completed step 2 of 5" guilt trips. The agent guides, doesn't grade. |
| **Confusion** | Layout follows content, not arbitrary state. What you see = what exists. |

### 3.4 Emotion → Design Mapping

| Feeling | Design Choice |
|---|---|
| **Welcomed** | Persona-aware greeting with suggestion badges. No blank prompt. |
| **Capable** | One-tap actions. Rich cards that do things, not links that navigate. |
| **Relief** | Agent synthesizes complexity into clear visualizations. Canvas shows the "so what." |
| **Helped** | Proactive suggestions after every milestone. Agent anticipates, doesn't wait. |
| **Recognized** | Per-project memory. Context-aware greetings. "Last time you were looking at..." |
| **Confident** | Every insight shows its source. Receipts are always one click away. |

### 3.5 Emotional Design Principles

1. **Relief over impression.** We're not trying to wow users with AI magic. We're trying to make complexity feel manageable.
2. **Helped, not judged.** No progress bars, completion percentages, or "you haven't done X yet" guilt. The agent suggests, never scolds.
3. **Recognition builds trust.** The agent remembering context isn't a feature — it's the foundation of the relationship.
4. **Confidence through evidence.** Users should never feel they're trusting a black box. The canvas shows *why* the agent thinks what it thinks.
5. **Momentum, not milestones.** The experience should feel like continuous forward motion, not a checklist being ticked off.

---

## 4. UX Pattern Analysis & Inspiration

### 4.1 Inspiring Products Analysis

| Product | What They Do Well | Relevance to UpSight |
|---|---|---|
| **ChatGPT Canvas** | Chat + canvas layout that appears on demand. Smooth transition from single-pane to two-column when agent has something to show. | Direct precedent for our layout logic. But their canvas is a passive document editor — ours is an active, interactive workspace. |
| **Linear** | Opinionated, fast, quiet confidence. Cmd+K command palette. Information-dense without clutter. Professional aesthetic. | The *feeling* we want — speed, professionalism, decisions made for you. But Linear assumes high technical fluency; we need mixed-skill accessibility. |
| **Notion AI** | AI responses include rich formatting — tables, summaries, action items. Components inside the conversation. | Rich inline components pattern. But AI is a sidebar feature in Notion, not the primary interface. |
| **Cursor / Claude Code** | Agent as primary interface to the workspace. You talk, it modifies the environment. Conversation drives the tool. | The mental model: agent = conversation partner, workspace = where work product lives. Too developer-focused for our users but the paradigm is right. |
| **Granola** | Apple Notes simplicity. Template/lens selection before meetings. Post-meeting synthesis that feels like "your notes, enhanced." | The progressive complexity philosophy — start simple, reveal structure as data accumulates. |

### 4.2 Transferable UX Patterns

| Pattern | Source | How We'd Use It |
|---|---|---|
| **Canvas appears on demand** | ChatGPT Canvas | Layout transition triggered by agent having something to show |
| **Rich inline components** | Notion AI | Suggestion cards, progress cards, data previews inside chat messages |
| **Agent as primary interface** | Cursor/Claude Code | Conversation drives the workspace, not menus |
| **Quiet confidence** | Linear | Professional, fast, no unnecessary decoration. Information density without clutter. |
| **Progressive complexity** | Granola | Start with just a conversation. Canvas, tools, and depth emerge as the user engages. |
| **Command palette as power-user escape** | Linear | Cmd+K for users who know what they want, bypassing the conversational flow |

### 4.3 Anti-Patterns to Avoid

| Anti-Pattern | Why | Seen In |
|---|---|---|
| **AI as sidebar feature** | Undermines "agent-first" paradigm. The agent IS the product. | Notion AI, most SaaS "+AI" features |
| **Blank canvas syndrome** | Empty workspace with "start typing" placeholder. Kills momentum. | Many chat UIs |
| **Modal overload** | Popups that interrupt the conversation flow | Enterprise SaaS onboarding |
| **Progress bar guilt** | "You're 30% complete" makes users feel behind, not helped | Steps to Wow, traditional onboarding |
| **Separate onboarding from product** | Users "graduate" from onboarding into a different UI. Disorienting. | Most SaaS products |
| **AI hallucination without attribution** | Making claims without showing evidence. Erodes trust fast. | Generic AI chat products |

### 4.4 Design Inspiration Strategy

**Adopt directly:**
- Canvas-appears-on-demand layout transition (ChatGPT Canvas)
- Rich inline components in chat messages (Notion AI style)
- Agent as the primary interface, not a feature (Cursor/Claude Code model)

**Adapt for our context:**
- Linear's quiet confidence aesthetic — but warmer, more approachable for non-technical users
- Granola's progressive complexity — but with richer data visualization as complexity reveals itself
- Command palette (Cmd+K) — but as secondary to conversation, not primary

**Avoid entirely:**
- AI-as-sidebar (Notion pattern) — agent must be the center, not an add-on
- Progress bar onboarding — momentum, not milestones
- Separate onboarding UI from product UI — one continuous experience

---

## 5. Design System Foundation

### 5.1 Design System Choice

**Primary:** shadcn/ui + Tailwind CSS (existing) + **A2UI component layer (80% implemented)**

UpSight already runs on shadcn/ui with Radix primitives, Inter typography, and a mature token system. The A2UI system is well along — 31 registered widgets, a component registry with Zod validation, JSON Pointer data binding, and a generic `displayComponent` tool that lets the agent render any registered widget.

### 5.2 Existing A2UI Infrastructure

The A2UI system follows the a2ui.org v0.8 flat adjacency list model:

**Message protocol (4 types):** `surfaceUpdate`, `dataModelUpdate`, `beginRendering`, `deleteSurface`

**Registered widgets (31):**

| Category | Widgets |
|---|---|
| **Sales/Decision** | BANTScorecard, DecisionBrief, DecisionSupport |
| **Survey** | SurveyCreated, SurveyOutreach, SurveyResponseCard, SurveyResponseList, SurveyResultsSummary |
| **Evidence** | EvidenceCard, EvidenceWall, ThemeList, PatternSynthesis |
| **Insights** | InsightCard, AiInsightCard, ConversationLensInsights |
| **People** | PersonaCard, PersonCard, PeopleList, StakeholderMap, OrganizationContextStatus |
| **Progress/Intake** | ProjectContextStatus, ProgressRail, IntakePathPicker, IntakeBatchStatus, IntakeHealth |
| **Actions** | ActionCards, TaskList, ResearchPulse |
| **Setup** | InterviewPrompts, UploadRecording |

**Key infrastructure:**
- `component-registry.ts` — Registry with Zod schemas, capability snapshots for agent prompts
- `tool-helpers.ts` — `buildSingleComponentSurface()`, `buildDataUpdate()`, `buildDismiss()`
- `A2UIRenderer.tsx` — Generic renderer walking adjacency list with data binding resolution
- `a2ui-surface-context.tsx` — React context with `applyMessages()`, `dismiss()`, `toggleCollapse()`
- `displayComponent` tool — Single generic tool the agent uses to render any registered widget

**Communication flow:** Agent tool returns `a2ui` payload → `ProjectStatusAgentChat` detects it → `A2UISurface.applyMessages()` → `CanvasPanel` renders via `A2UIRenderer`

### 5.3 What's Needed for Agent-First Experience

The existing A2UI system handles **canvas rendering**. What's new for the agent-first experience:

| Need | Status | Notes |
|---|---|---|
| Widget rendering in canvas | **Done** | 31 widgets, working pipeline |
| Agent triggers canvas via tools | **Done** | `displayComponent` tool + `buildSingleComponentSurface()` |
| Data binding & live updates | **Done** | JSON Pointer + `buildDataUpdate()` |
| Canvas → agent action relay | **Partial** | Infrastructure exists, agent integration needs work |
| **Rich components in chat** (inline) | **New** | Suggestion badges, action cards rendered inside chat messages, not just canvas |
| **Layout transition system** | **New** | Centered → two-column animation, driven by canvas content existence |
| **Persona-aware greeting + badges** | **New** | Agent's first message with role-specific suggestion badges |
| **Canvas persistence / history** | **Partial** | `emitUiEvent` RPC exists, playback TBD |

### 5.4 Three-Layer Architecture

| Layer | Purpose | Examples |
|---|---|---|
| **Base (shadcn/ui)** | Standard UI primitives | Button, Card, Dialog, Input, ScrollArea, Tabs |
| **App (existing)** | UpSight-specific components | StatChip, IcpBadge, InlineEditableField, EvidenceCard |
| **A2UI (80% done)** | Agent-rendered rich components — canvas + inline chat | 31 canvas widgets + new inline chat components (suggestion badges, action cards, progress cards) |

### 5.5 New Components Needed

The gap is primarily **inline chat components** — rich interactive elements that render *inside* chat messages as part of the conversation:

| Component | Renders In | Purpose |
|---|---|---|
| **SuggestionBadge** | Chat (inline) | Tappable pill suggesting a next action |
| **ActionSuggestionCard** | Chat (inline) | Richer card with icon, description, and CTA button |
| **ProgressSummaryCard** | Chat (inline) | "Here's where you are" — project status summary |
| **WelcomeBackCard** | Chat (inline) | Returning user context with recent activity |
| **CelebrationCard** | Chat (inline) | Milestone acknowledgment (first upload, first pattern, etc.) |
| **QuickComparisonCard** | Chat (inline) + Canvas | Side-by-side stakeholder/evidence comparison |

These follow the same registry pattern but are optimized for constrained chat width and one-tap interaction.

---

## 6. User Journeys & Wireframes

### 6.1 Journey 1: New User — Consultant

```
OnboardingWalkthrough modal → Role: Consultant → Use case: Client research
    ↓
PHASE 1: AGENT CENTERED
    Agent greeting (persona-aware) + suggestion badges:
      [Upload a stakeholder interview]
      [Map a client's org]
      [Tell me about your project]
    ↓
    User taps "Upload a stakeholder interview"
    → Agent: "Great — drag a file here or I can record you summarizing what happened."
    → User drags audio file
    → Agent shows inline ProgressCard: "Transcribing... Extracting evidence..."
    ↓ Processing completes → agent has canvas content
    ↓
PHASE 2: AGENT + CANVAS (animated transition)
    Canvas: EvidenceWall with 12 evidence items
    Agent: "I found 12 pieces of evidence. Here's what stands out."
    Agent highlights contradictions across stakeholders
    Suggestion badges:
      [Upload another interview]
      [See stakeholder map]
      [Draft follow-up questions]
```

### 6.2 Journey 2: New User — Founder

```
OnboardingWalkthrough → Role: Founder → Use case: Customer discovery
    ↓
PHASE 1: AGENT CENTERED
    Badges: [Upload customer conversations] [Create a discovery survey] [Tell me what you're trying to learn]
    ↓
    User taps "Tell me what you're trying to learn"
    → Conversational exchange about retention/churn
    → Agent saves project context via tools
    → Agent renders ProjectContextStatus in canvas
    ↓
PHASE 2: AGENT + CANVAS
    Canvas: ProjectContextStatus with captured fields
    Badges: [Upload existing customer calls] [Create a churn survey] [Set up research questions]
```

### 6.3 Journey 3: Returning User — Existing Project

```
User logs in → navigates to project with data
    ↓
PHASE 2: AGENT + CANVAS (immediately)
    Canvas: Last viewed content (e.g. ThemeList)
    Agent: "Welcome back! Since you were here: 2 new survey responses, 1 theme updated."
    Badges: [Review new responses] [Dig into onboarding theme]
```

### 6.4 Journey 4: New Project on Existing Account

```
User creates new project
    ↓
PHASE 1: AGENT CENTERED (fresh start)
    Agent: "New project! What are we researching this time?"
    Badges reflect what worked last time (personalized from account history)
```

### 6.5 Journey 5: Mobile

```
PHASE 1: Full-screen agent chat (centered, no canvas)
    Same greeting + badges, optimized for touch
    ↓
PHASE 2: Tab-based [Chat] [Canvas]
    Whichever tab is active fills screen
    Notification badge on Chat tab when new suggestions arrive
    Bottom tab bar for app navigation
```

### 6.6 Wireframes

**Phase 1: Agent Centered (Desktop)**
```
┌──────────────────────────────────────────────────────┐
│                   Top Nav (minimal)                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│            ┌──────────────────────────┐              │
│            │        ✦ Uppy            │              │
│            │                          │              │
│            │  Hey! I'm Uppy, your     │              │
│            │  research partner.       │              │
│            │                          │              │
│            │  ┌────────────────────┐  │              │
│            │  │ 🎙 Upload a        │  │              │
│            │  │ stakeholder        │  │              │
│            │  │ interview          │  │              │
│            │  ├────────────────────┤  │              │
│            │  │ 🏢 Map a client's  │  │              │
│            │  │ org                │  │              │
│            │  ├────────────────────┤  │              │
│            │  │ 💬 Tell me about   │  │              │
│            │  │ your project       │  │              │
│            │  └────────────────────┘  │              │
│            │                          │              │
│            │  ┌──────────────────┐    │              │
│            │  │ Type or speak...🎤│   │              │
│            │  └──────────────────┘    │              │
│            └──────────────────────────┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Phase 2: Agent + Canvas (Desktop)**
```
┌──────────────────────────────────────────────────────┐
│                    Top Nav (full)                     │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  ✦ Uppy   │          CANVAS                         │
│            │                                         │
│  I found  │  ┌─ Evidence Wall ────────────────────┐ │
│  12 pieces│  │                                    │ │
│  of evid- │  │  [PAIN] VP Ops · "frustrated..."   │ │
│  ence.    │  │  [GOAL] CFO · "need 30% cost..."   │ │
│            │  │  [CONTRADICTION] VP Ops vs CFO     │ │
│  Here's   │  │                                    │ │
│  what     │  └────────────────────────────────────┘ │
│  stands   │                                         │
│  out.     │                                         │
│            │                                         │
│  ┌──────┐ │                                         │
│  │Upload│ │                                         │
│  │more  │ │                                         │
│  ├──────┤ │                                         │
│  │Stake-│ │                                         │
│  │holder│ │                                         │
│  │map   │ │                                         │
│  ├──────┤ │                                         │
│  │Draft │ │                                         │
│  │Qs    │ │                                         │
│  └──────┘ │                                         │
│            │                                         │
│ [Type...🎤]│                                         │
├────────────┴─────────────────────────────────────────┤
```

**Layout Transition (500ms spring)**
```
Frame 0: Agent centered (max-w-2xl)
Frame 1: Agent compresses left, canvas fades in from right
Frame 2: Settled — Agent (380px) | Divider (draggable) | Canvas (remaining)

Agent width: 360-600px range, default 380px, persisted to localStorage
```

**Mobile Phase 1**
```
┌─────────────────────┐
│  UpSight    ≡       │
├─────────────────────┤
│                     │
│  ✦ Uppy            │
│  Hey! Let's get     │
│  started.           │
│                     │
│  ┌───────────────┐  │
│  │ 🎙 Upload     │  │
│  ├───────────────┤  │
│  │ 📋 Survey     │  │
│  ├───────────────┤  │
│  │ 💬 Tell me... │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ Type...  🎤   │  │
│  └───────────────┘  │
├─────────────────────┤
│  💬  📤  👤  ···   │
└─────────────────────┘
```

**Mobile Phase 2 (tabs)**
```
┌─────────────────────┐
│ [Chat]  [Canvas•]   │
├─────────────────────┤
│                     │
│  (active tab fills  │
│   entire screen)    │
│                     │
│  Badge on inactive  │
│  tab when new       │
│  content arrives    │
│                     │
└─────────────────────┘
```

---

## 7. Component Strategy

### 7.1 Inline Chat Components (New)

Six new components that render inside chat messages — the conversational layer.

**SuggestionBadge**
- Pill shape, rounded-lg, border with subtle hover glow
- Icon (lucide) + label, 2 lines max
- Grid: 2-up on desktop, stack on mobile
- On tap: sends the label as a user message or triggers a tool call
- Appears after agent messages, max 4 per message

**ActionSuggestionCard**
- Card with subtle border, bg-muted/50
- Icon + title (bold), description (muted), primary CTA button, optional "Skip" link
- On CTA tap: agent executes the action (tool call)
- One per message, below agent text — for high-value actions

**ProgressCard**
- Compact card, no CTA (passive status)
- Steps: ✓ done, ◉ active (pulse animation), ○ pending
- Progress bar with brand color fill
- Auto-updates via streaming/polling
- On completion: agent posts results + canvas renders

**WelcomeBackCard**
- Card with date stamp, bullet list of changes (max 4)
- 1-2 SuggestionBadges embedded at bottom
- Only shown on first message of returning session

**CelebrationCard**
- Subtle accent border (teal/green), sparkle icon
- Short celebration text + what it means + CTA to explore
- Used sparingly: first upload, first pattern, first theme, first survey response

**QuickComparisonCard**
- Side-by-side comparison (stakeholders, evidence, themes)
- Renders inline for quick glance, CTA opens full view in canvas

### 7.2 Chat vs Canvas Boundary

| In Chat (conversation + suggestions) | In Canvas (work product + data) |
|---|---|
| SuggestionBadge | EvidenceWall |
| ActionSuggestionCard | StakeholderMap |
| ProgressCard | ThemeList |
| WelcomeBackCard | SurveyCreated / SurveyOutreach |
| CelebrationCard | PatternSynthesis |
| QuickComparisonCard (preview) | All 31 existing widgets |

**Rule:** Chat components trigger or preview. Canvas components display and interact with data.

### 7.3 Agent Voice in Components

- First person, present tense: "I found..." "Here's what stands out..."
- Suggestions framed as offers: "Want me to..." "I can..." — never "You should..."
- Never passive: ~~"Evidence was found"~~ → "I found 12 pieces of evidence"

---

## 8. UX Consistency Patterns

### 8.1 Suggestion Timing
- Agent always ends with suggestions unless asking a direct question
- Max 4 SuggestionBadges per message
- Max 1 ActionSuggestionCard per message
- Suggestions update based on project state — never stale options

### 8.2 Loading & Processing
- Inline ProgressCard for operations >3 seconds
- Agent acknowledges immediately: "Got it — processing now."
- On completion: agent posts results + canvas renders simultaneously

### 8.3 Error Recovery
- Agent explains in plain language, always offers an alternative
- Never dead ends, never stack traces, never "something went wrong"
- Pattern: "That didn't work because [reason]. Want to try [alternative]?"

### 8.4 Transition Behaviors
- Phase 1 → 2: spring animation, 500ms, agent compresses left
- Canvas widget swap: crossfade, 200ms
- Mobile tab switch: instant (no animation)
- Agent panel resize: real-time drag, no animation

### 8.5 Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Cmd+K` | Command palette (power-user navigation bypass) |
| `Cmd+/` | Toggle agent panel (Phase 2) |
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Escape` | Dismiss canvas / minimize agent |

### 8.6 Accessibility
| Requirement | Implementation |
|---|---|
| WCAG AA contrast | All text 4.5:1 on light and dark |
| Keyboard nav | Tab through badges, Enter to activate |
| Screen reader | Badges: `role="button"`, descriptive `aria-label` |
| Reduced motion | `prefers-reduced-motion`: instant layout switch, no spring |
| Focus management | After transition, focus moves to canvas content |
| Live regions | ProgressCard: `aria-live="polite"` for updates |
| Agent messages | `role="log"`, `aria-live="polite"` |

---

## 9. Implementation Roadmap

### Phase 1: Layout Foundation (1 week)

**Goal:** Agent-centered layout works, transitions to two-column when canvas has content.

**What ships:**
- New `AgentFirstLayout` component replacing `SplitPaneLayout` as default
- Phase 1 state: agent chat centered (max-w-2xl), full viewport
- Phase 2 state: agent left column (380px, resizable) + canvas right
- Transition trigger: `A2UISurface` has active content → animate to Phase 2
- Transition animation: framer-motion spring, 500ms
- Agent width persisted to localStorage
- Mobile: full-screen chat (Phase 1), tab-based Chat/Canvas (Phase 2)

**What's deprecated:**
- `AIAssistantPanel` floating button/panel (replaced by integrated layout)
- Steps to Wow components (`WowRoutePicker`, `WowStepGuide`, `StepsToWow`)
- `FeatureTour` component
- `OnboardingFlow` component
- `JourneySidebarGroup` (already invisible in current layout)

**Files to modify:**

| File | Change |
|---|---|
| `app/components/layout/SplitPaneLayout.tsx` | Replace with AgentFirstLayout or refactor in place |
| `app/components/layout/AIAssistantPanel.tsx` | Deprecate — logic moves into AgentFirstLayout |
| `app/components/gen-ui/CanvasPanel.tsx` | Adapt to be the right column in Phase 2 |
| `app/contexts/a2ui-surface-context.tsx` | Add `hasContent` boolean for layout trigger |
| `app/components/layout/AppLayout.tsx` | Switch default to AgentFirstLayout |

**Does NOT touch:** Agent logic, A2UI widgets, OnboardingWalkthrough (all stay as-is)

### Phase 2: Inline Chat Components (1 week)

**Goal:** Agent can render rich suggestion badges and cards inside chat messages.

**What ships:**
- `SuggestionBadge` component (tappable pill, sends message or triggers tool)
- `ActionSuggestionCard` component (rich card with CTA)
- `ProgressCard` component (processing status with live updates)
- Integration into `ProjectStatusAgentChat` message rendering
- Agent tool: `suggestActions` — returns typed suggestion data that renders as badges/cards
- Tap handling: badge tap → `insertText()` or `sendUiEvent()` to agent

**Registry integration:**
- New components registered in `registered-components.tsx`
- Rendered inline in chat, not in canvas — `renderContext: "chat" | "canvas"` flag
- Agent system prompt updated with inline component capabilities

**Files to create:**

| File | Purpose |
|---|---|
| `app/components/chat/inline/SuggestionBadge.tsx` | Tappable suggestion pill |
| `app/components/chat/inline/ActionSuggestionCard.tsx` | Rich action card with CTA |
| `app/components/chat/inline/ProgressCard.tsx` | Processing status |
| `app/components/chat/inline/index.ts` | Barrel export |

**Files to modify:**

| File | Change |
|---|---|
| `app/components/chat/ProjectStatusAgentChat.tsx` | Render inline components from tool parts |
| `app/lib/gen-ui/registered-components.tsx` | Register new inline components |
| Agent system prompt | Add inline component instructions |

### Phase 3: Persona-Aware Onboarding (1 week)

**Goal:** Agent's first conversation is tailored to role from OnboardingWalkthrough.

**What ships:**
- `WelcomeBackCard` component
- `CelebrationCard` component
- Persona-aware first message with role-specific suggestion badges
- Agent reads `user_settings.signup_data` (role, use case, company size) and tailors greeting
- Returning user detection: project has data → Phase 2 + WelcomeBackCard
- New project detection: no data → Phase 1 + persona greeting
- Milestone celebrations: first upload, first pattern, first theme (sparingly)

**Agent logic changes:**
- `projectStatusAgent` system prompt includes persona context
- New tool: `getOnboardingContext` — returns role, use case, project state
- Agent decides greeting + suggestions based on this context
- `suggestNextSteps` tool updated to be persona-aware

**Files to modify:**

| File | Change |
|---|---|
| `app/mastra/agents/project-status-agent.ts` | Persona-aware system prompt |
| `app/mastra/tools/` | `getOnboardingContext` tool, updated `suggestNextSteps` |
| `app/components/chat/ProjectStatusAgentChat.tsx` | WelcomeBackCard + CelebrationCard rendering |

### Phase 4: Polish & Deprecation Cleanup (1 week)

**Goal:** Remove deprecated systems, polish transitions, mobile refinement.

**What ships:**
- Remove Steps to Wow code (WowRoutePicker, WowStepGuide, StepsToWow, journey-config wow paths)
- Remove FeatureTour, OnboardingFlow components
- Remove JourneySidebarGroup
- Remove `AIAssistantPanel` floating button (fully replaced)
- Clean up feature flags (`ffYourJourney` no longer needed)
- Mobile tab-based Phase 2 implementation
- Cmd+K command palette integration
- Cmd+/ agent panel toggle
- `prefers-reduced-motion` support for layout transition
- QuickComparisonCard for inline stakeholder/evidence previews
- End-to-end testing of all 5 user journeys

**Risk mitigation:**
- Keep old layout accessible via `?layout=legacy` during transition (debugging escape hatch)
- Monitor: time-to-first-action, suggestion badge tap rate, canvas render success rate
- No feature flag needed — agent-first is the unconditional default, inline components are additive (only render when agent calls tools), and user base is small enough for direct feedback

---

## 10. Success Metrics

| Metric | Current Baseline | Target | How We Measure |
|---|---|---|---|
| **Time to first action** | Unknown (Steps to Wow: 3 decisions before action) | < 30 seconds | PostHog: page load → first badge tap |
| **First canvas content** | N/A (canvas rarely triggered from onboarding) | < 3 minutes | PostHog: first action → first `surfaceUpdate` |
| **Suggestion badge tap rate** | N/A | > 60% of first sessions | PostHog: badge taps / sessions |
| **Onboarding completion** | ~40% | > 75% (first canvas content rendered) | PostHog: users reaching Phase 2 |
| **Returning user engagement** | Unknown | > 50% interact with WelcomeBack suggestions | PostHog: WelcomeBackCard taps / returning sessions |
| **Transition satisfaction** | N/A | No increase in drop-off at transition | PostHog: funnel Phase 1 → Phase 2 |

---

## 11. Open Questions

1. **Canvas history**: When user returns, what canvas content to show? Last viewed? Project dashboard? Agent decides?
2. **Multiple canvas surfaces**: Can user have multiple canvases open, or one at a time with swap?
3. **Agent threads**: One conversation thread per project, or can users start fresh threads?
4. **Suggestion data source**: Agent generates per-response, or pre-computed from project state?
5. **Feature flag rollout**: Internal users first, or straight to beta?

---

## 12. Summary

### What We're Building

An agent-first experience where the AI assistant (Uppy) is the primary interface to UpSight. The agent occupies center stage for new projects, guides users through persona-aware suggestions rendered as rich interactive components, and transitions to a persistent side panel when it has work product to show in the canvas.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout trigger | Canvas content existence | Simple, content-driven, no arbitrary state machine |
| Onboarding approach | Agent conversation + suggestion badges | Replaces 5 systems with one conversational flow |
| OnboardingWalkthrough | Kept | Valuable profiling data informs persona-aware greeting |
| Emotional center | Relief over impression | Users need help with complexity, not AI demos |
| Chat vs canvas boundary | Chat = conversation + suggestions, Canvas = work product | Clear mental model, leverages existing A2UI |
| Mobile strategy | Full-screen chat → tab-based chat/canvas | Native feel, not compressed desktop |
| Transition animation | Spring, 500ms, framer-motion | Feels like progress, not breakage |

### What Gets Deprecated

- Steps to Wow (WowRoutePicker, WowStepGuide, StepsToWow, journey wow config)
- FeatureTour (swipeable slides)
- OnboardingFlow (full-page multi-step)
- JourneySidebarGroup (sidebar progress tracking)
- AIAssistantPanel floating button/panel (replaced by integrated layout column)

### Implementation Timeline

| Phase | Duration | Deliverable |
|---|---|---|
| 1. Layout Foundation | 1 week | Agent-centered ↔ two-column layout with animated transition |
| 2. Inline Chat Components | 1 week | SuggestionBadge, ActionSuggestionCard, ProgressCard |
| 3. Persona-Aware Onboarding | 1 week | Tailored greetings, WelcomeBackCard, CelebrationCard |
| 4. Polish & Cleanup | 1 week | Deprecation, mobile, keyboard shortcuts, a11y |

---

*UX Design Specification Complete — Ready for Architecture & Implementation Planning*
