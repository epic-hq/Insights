---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
workflowComplete: true
inputDocuments:
  - docs/50-market/brand-brief.md
focusArea: Desktop Electron App - Real-time Evidence UI
---

# UX Design Specification: UpSight Desktop

**Author:** Rick
**Date:** February 6, 2026
**Focus:** Desktop Electron App - Real-time Meeting Evidence UI

---

## 1. Product Context

### 1.1 What We're Designing

A real-time meeting companion for the UpSight Desktop Electron app that displays extracted evidence and insights during live meetings - not raw transcripts.

### 1.2 User Need Statement

> "I want to record a meeting and be confident the system is capturing all the words from everyone who's there. But I care less about seeing exact text and more about knowing the takeaways at each turn."

### 1.3 Brand Alignment

From the UpSight Brand Brief:
- **Core Promise:** "Build the right thing, faster"
- **Voice:** Direct, Confident, Grounded, Useful
- **Differentiator:** Every insight shows its receipts (traceable to source)
- **Visual:** Modern, clean, professional - not AI-hype flashy

---

## 2. Feature Requirements (Stakeholder Input)

### 2.1 Primary View: Evidence Stream

**Display evidence, not transcript.** Each turn shows:
- **Speaker attribution:** "Speaker A: [takeaway]"
- **Concise gist:** The main point of what was said
- **Categorization:** Pain, Goal, Suggestion, etc.
- **Pattern detection:** "Speaker B shares that pain"

**Example flow:**
```
🔴 Rick Moy: Wants to improve onboarding experience [goal]
⬇️
🔴 Guest: Shares frustration with current 5-step process [pain]
⬇️
🔴 Rick Moy: Suggests single-page wizard approach [solution]
```

### 2.2 Hidden Transcript Tab

- Transcript available but **hidden by default**
- Accessible via tab/toggle if needed
- Not the primary experience

### 2.3 Personal Notes (Timestamped)

**Allow user to annotate in real-time:**
- Add notes at specific timestamps
- Capture what AI wouldn't get (tone, facial expressions, body language)
- Notes merge into evidence stream, marked as "Note"
- Persisted alongside transcript data

### 2.4 Action Items & Tasks

**Automatic extraction of commitments:**
- Detect task-like statements ("I'll send you that doc", "Let's follow up via email")
- Show in dedicated "Action Items" segment
- **Provisional during meeting** - not committed to system yet
- **Post-meeting confirmation:** User can edit, assign, then commit to Tasks API
- Integration with main app's Priorities/Tasks system

### 2.5 Speaker Identification & People

**Link speakers to UpSight People:**
- Identify speakers by meeting platform email
- If person doesn't exist → create new Person record
- If person exists → associate with this interview
- Interview linked to Person profile for future reference

### 2.6 Entity Extraction

- Capture mentioned entity names (companies, products, tools)
- Surface as potential facet mentions
- V1 scope: capture and display, not necessarily deep linking

### 2.7 AI Recommendations

**Based on meeting goal/context:**
- Suggest next steps given the conversation direction
- Requires: knowing the host's goal for this meeting
- Could be configured pre-meeting or inferred from project context

---

## 3. Design Constraints

### 3.1 Screen Real Estate

**Minimal footprint by default:**
- User is viewing meeting participants (video call)
- App should NOT take whole screen
- Think: floating panel, sidebar, compact overlay

**Expanded mode available:**
- After meeting ends, larger workspace option
- See more evidence, edit tasks, review insights

### 3.2 Interaction Model

| State | Mode | Behavior |
|-------|------|----------|
| During meeting | Compact | Minimal, auto-scrolling evidence |
| Meeting ended | Expanded | Full workspace, editing, task management |
| Background | Minimized | Recording indicator only |

### 3.3 Visual Requirements

- **UpSight branding:** Logo visible, brand colors
- **Match journey map style:** Modern, clean gradients
- **Professional, not flashy:** Grounded, trustworthy
- **Dark mode compatible:** Likely dark UI for overlay use

---

## 4. User Stories

### 4.1 Core Recording Flow

```
As a meeting host,
I want to see real-time takeaways as people speak,
So I can stay engaged in the conversation while knowing nothing is lost.
```

### 4.2 Note-Taking

```
As a meeting host,
I want to add personal notes at specific moments,
So I can capture context the AI wouldn't understand (like tone or expressions).
```

### 4.3 Task Capture

```
As a meeting host,
I want action items automatically detected and shown,
So I don't have to manually track who committed to what.
```

### 4.4 Post-Meeting Review

```
As a meeting host,
I want to review and edit detected tasks before committing them,
So I can ensure accuracy before they appear in my project.
```

### 4.5 People Linking

```
As a meeting host,
I want meeting participants automatically linked to their Person profiles,
So this conversation is findable from their profile later.
```

---

## 5. Technical Integration Points

| Feature | Integration Needed |
|---------|-------------------|
| Evidence extraction | `/api/desktop/realtime-evidence` (exists) |
| Task creation | Priorities/Tasks API in main app |
| Person lookup/create | People API |
| Speaker ID | Recall SDK participant events |
| Note persistence | Local storage + sync to interview |

---

## 6. Design Decisions (Resolved)

### 6.1 Meeting Goal Configuration
- **Primary:** AI suggests goal based on calendar event title and description (if available)
- **Fallback:** User selects from dropdown of conversation lenses (e.g., Discovery, BANT, Empathy Map)
- Calendar integration provides context without requiring manual input

### 6.2 Task Assignment
- **AI auto-assigns** based on speaker attribution and context
- **User approves or edits** during post-meeting review
- Reduces friction while maintaining human oversight

### 6.3 Compact Mode Dimensions
- **Desktop:** ~1/4 of screen width (sidebar or floating panel)
- **Mobile:** ~2 lines of evidence/insights visible
- Minimal footprint prioritizes meeting focus over app visibility

### 6.4 Post-Meeting Transition
- **Auto-expand** when meeting ends
- No prompt required - seamless transition to review workspace
- User can manually minimize if needed

---

## 7. Executive Summary

### 7.1 Project Vision

UpSight Desktop is a real-time meeting companion that transforms live conversations into actionable evidence. Unlike transcript-focused tools, it surfaces **what matters** - pain points, goals, commitments - as they happen. The user stays present in the conversation while the system captures everything with full attribution.

The core value: **"I can focus on the human in front of me because I know the system has my back."**

### 7.2 Target Users

**Primary**: Meeting hosts who conduct customer interviews, sales calls, discovery sessions, or user research. They are:
- Busy professionals who can't afford to re-watch recordings
- Skilled at conversations but overwhelmed by note-taking
- Need evidence to share with their team (not just summaries)
- Tech-savvy enough to use desktop apps, but not power users

**Context of Use**:
- During video calls (Zoom, Meet, Teams) - app runs alongside
- Glanceable during meeting, deep-dive after
- Desktop-first (macOS initially, Windows later)

### 7.3 Key Design Challenges

1. **Screen real estate conflict** - The app must coexist with video participants without dominating. Compact mode needs to be useful at ~300px width.

2. **Attention management** - Real-time evidence streams in, but users need to focus on conversation. Must be glanceable, not attention-stealing.

3. **Mode transition** - Meeting ends → expanded mode. This moment needs to feel natural, not jarring.

4. **Frictionless note capture** - Adding notes mid-conversation must be instant (keyboard shortcut, minimal UI).

### 7.4 Design Opportunities

1. **Glanceable confidence** - A well-designed compact mode lets users peek and see "yes, it's working" without reading. Reduces anxiety, increases trust.

2. **Post-meeting delight** - Expanding to a well-organized summary with linked action items could be an "aha" moment that validates the product.

3. **Speaker visualization** - Visual timeline showing who spoke when, with evidence markers, enables quick navigation to key moments.

4. **Evidence-first paradigm** - Unlike competitors showing walls of transcript, we show the signal. This is a differentiator if we nail the presentation.

---

## 8. Core User Experience

### 8.1 Defining Experience

The core experience of UpSight Desktop is **passive confidence with active payoff**:
- During meeting: Peripheral awareness that evidence is being captured
- After meeting: Rich workspace to review, edit, and commit insights

The primary user action is glancing - not reading, not interacting. The app must communicate "I've got this" at a glance.

### 8.2 Platform Strategy

| Aspect | Decision |
|--------|----------|
| Platform | Desktop Electron (macOS first, Windows later) |
| Input | Mouse + keyboard primary |
| Context | Companion to video call apps |
| Window | Always-on-top floating panel, resizable |
| Shortcuts | Global keyboard shortcuts for core actions |

### 8.3 Effortless Interactions

- **Recording start**: One-click or keyboard shortcut
- **Note capture**: Cmd+Shift+N → inline field → Enter to save
- **Evidence scroll**: Auto-scroll with pause-on-interaction
- **Mode transition**: Gentle prompt or auto-expand post-meeting
- **Task commit**: Checkbox-based, not form-based

### 8.4 Critical Success Moments

1. First evidence card appears → confidence established
2. AI correctly categorizes a pain point → "it gets me"
3. Meeting ends → organized summary appears → time saved
4. Tasks committed to project → workflow connected

### 8.5 Experience Principles

1. **Peripheral Confidence** - Glanceable, not readable
2. **Conversation-First** - Never pull focus from the human
3. **Smart Defaults** - Works without configuration
4. **Evidence > Transcript** - Signal over noise
5. **Post-Meeting Payoff** - Real value lands after the call

---

## 9. Desired Emotional Response

### 9.1 Primary Emotional Goals

| During Meeting | After Meeting |
|----------------|---------------|
| Calm confidence | Satisfaction |
| Present and focused | Organized clarity |
| Unburdened from notes | Empowered to share |

The differentiating emotion: **Trusted partnership** - the AI feels like a skilled assistant, not a surveillance tool.

### 9.2 Emotional Journey Mapping

| Stage | Desired | Risk to Avoid |
|-------|---------|---------------|
| First launch | Curious, hopeful | Overwhelmed |
| Recording starts | Reassured | Anxious |
| First evidence | Delighted, validated | Confused |
| Mid-meeting glance | Confident | Distracted |
| Meeting ends | Accomplished | Rushed |
| Post-meeting review | Impressed | Frustrated |
| Task commit | Efficient | Abandoned |

### 9.3 Critical Micro-Emotions

- Confidence over Confusion
- Trust over Skepticism
- Accomplishment over Frustration
- Calm over Anxiety

### 9.4 Emotion-to-Design Mapping

| Goal | Design Choice |
|------|---------------|
| Calm confidence | Minimal UI, no alerts |
| Trust in AI | Show sources, allow correction |
| Accomplishment | Summary as deliverable |
| Partnership | AI suggests, user confirms |

### 9.5 Emotional Design Principles

1. **Quiet Competence** - Forget it's there until you need it
2. **Show, Don't Claim** - Prove value through evidence
3. **Human Agency** - User controls, AI proposes
4. **Progressive Reveal** - Simple during, rich after
5. **Earned Trust** - Start minimal, expand with proof

---

## 10. UX Pattern Analysis & Inspiration

### 10.1 Competitive Landscape

| Product | Focus | Real-time? | Human-led? |
|---------|-------|------------|------------|
| Dovetail | Post-hoc analysis | No | N/A |
| Listen Labs | AI interviews | Yes | No |
| Granola | Meeting notes | Post-meeting | Yes |
| Fathom | Sales calls | Yes | Yes |
| **UpSight** | Research evidence | **Yes** | **Yes** |

### 10.2 Inspiring Products Analysis

| Product | Key Strength | Lesson for UpSight |
|---------|--------------|-------------------|
| **Dovetail** | "Assemble. Analyze. Act." clarity, enterprise polish | Clear workflow, dark pro UI, quotes with attribution |
| **Listen Labs** | Automated analysis, no manual coding | Card-based insights, minimalist research UX |
| **Granola** | Apple Notes simplicity | Familiar patterns, template/lens selection |
| **Fathom** | "Stay present" messaging | Presence-first emotional positioning |

### 10.3 Transferable UX Patterns

**From Dovetail**: Dark professional UI, evidence→themes pipeline, AI-generated reports
**From Listen Labs**: Card-based insights, automated analysis without manual tagging
**From Granola/Fathom**: Presence messaging, lens selection, action item flow

### 10.4 Anti-Patterns to Avoid

- Post-hoc only (Dovetail) - we show evidence in real-time
- AI replacement (Listen Labs) - we augment human researchers
- Sales focus (Fathom) - we're product/research
- Enterprise complexity (Dovetail) - start simple

### 10.5 Differentiation Strategy

UpSight Desktop's unique position:
1. **Real-time evidence** during human-led conversations
2. **Augmentation, not replacement** of the researcher
3. **Product/research lens** (not sales coaching)
4. **Receipts by default** - every insight traces to source

---

## 11. Design System Foundation

### 11.1 Design System Choice

**Primary**: shadcn/ui + Tailwind CSS (extended for Desktop)

Rationale:
- Consistent with main UpSight web app
- Dark mode built-in and tested
- Tailwind provides full customization control
- Radix primitives ensure accessibility
- Team already familiar with the system

### 11.2 Implementation Approach

Base layer: shadcn/ui components (Button, Card, Tabs, Dialog, etc.)
Theme layer: Tailwind dark theme with UpSight brand tokens
Extension layer: Desktop-specific components

### 11.3 Desktop-Specific Components

| Component | Purpose | Variants |
|-----------|---------|----------|
| EvidenceCard | Display extracted evidence | compact, expanded |
| RecordingIndicator | Show recording status | active, paused, stopped |
| NoteInput | Inline timestamped notes | floating, inline |
| ActionItemCard | Display detected tasks | provisional, confirmed |
| FloatingPanel | Desktop window wrapper | compact, expanded, minimized |

### 11.4 Design Tokens

```css
/* UpSight Desktop Dark Theme */
--background: hsl(222 47% 11%);      /* Dark navy */
--foreground: hsl(210 40% 98%);       /* Near white */
--primary: hsl(217 91% 60%);          /* UpSight blue */
--accent: hsl(142 71% 45%);           /* Success green */
--destructive: hsl(0 84% 60%);        /* Error red */
--muted: hsl(215 20% 65%);            /* Muted text */
```

---

## 12. Defining Core Experience

### 12.1 The Defining Interaction

**"Glance at the panel. See evidence appearing. Return to conversation."**

Users describe UpSight Desktop as: "I just glance over and see it pulling out the key insights in real time. I don't have to do anything."

### 12.2 User Mental Model

**Current solutions**: Frantic note-taking, re-watching recordings, post-meeting transcript highlighting
**Expectation gap**: Users expect "AI note-taker" = transcript + summary after. Real-time evidence is novel.
**Confusion points**: Recording status, evidence meaning, connection to main app

### 12.3 Success Criteria

| Criterion | Target |
|-----------|--------|
| Glanceability | Understand state in <1 second |
| Confidence | Never wonder "is it working?" |
| Non-distraction | Confirm, don't read during meeting |
| Post-meeting payoff | "It caught everything" |

### 12.4 Pattern Analysis

**Established**: Floating panel, evidence cards, auto-scroll
**Novel**: Real-time evidence extraction during meeting

### 12.5 Experience Mechanics

**Initiation**: Click record → Red dot + timer → First evidence in 30s
**During**: Glance → See cards → Optional note (Cmd+Shift+N) → Return focus
**Feedback**: Subtle animations, non-intrusive confirmations
**Completion**: Auto-expand → Summary view → Review tasks → Save to project

---

## 13. Visual Design Foundation

### 13.1 Color System

**Dark theme tokens:**
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `hsl(222 47% 11%)` | Dark navy base |
| `--background-subtle` | `hsl(222 47% 14%)` | Card backgrounds |
| `--foreground` | `hsl(210 40% 98%)` | Primary text |
| `--muted` | `hsl(215 20% 65%)` | Secondary text |
| `--primary` | `hsl(217 91% 60%)` | UpSight blue |
| `--accent-green` | `hsl(142 71% 45%)` | Success |
| `--destructive` | `hsl(0 84% 60%)` | Error, recording |

**Evidence tag palette:**
- Pain: `#f87171` (red/coral)
- Goal: `#4ade80` (green)
- Workflow: `#60a5fa` (blue)
- Tool: `#a78bfa` (purple)
- Probe: `#fbbf24` (amber)

### 13.2 Typography System

**Fonts**: Inter (UI), JetBrains Mono (timestamps)

| Mode | Element | Size | Weight |
|------|---------|------|--------|
| Compact | Panel title | 14px | 600 |
| Compact | Evidence gist | 13px | 400 |
| Compact | Speaker/tag | 11-12px | 500 |
| Expanded | Section heading | 18px | 600 |
| Expanded | Body text | 14px | 400 |

### 13.3 Spacing & Layout

**Base unit**: 4px
**Scale**: 4, 8, 12, 16, 24px

| Mode | Width | Height |
|------|-------|--------|
| Compact | 320px | 400px |
| Expanded | 480px | 600px+ |
| Minimized | 48px | 48px |

### 13.4 Accessibility

- WCAG AA contrast compliance (4.5:1 body, 3:1 large)
- Visible focus rings on all interactive elements
- Full keyboard navigation (Cmd+Shift+N for notes)
- ARIA labels for recording state and evidence
- `prefers-reduced-motion` support

---

## 14. Design Direction Decision

### 14.1 Directions Explored

Six visual approaches for the evidence panel were evaluated:
1. Classic Cards (left border color)
2. Minimal Lines (separator-based)
3. Bubble Style (tinted backgrounds)
4. Timeline (vertical line + dots)
5. Ultra Compact (dense text)
6. Tag-First (prominent category badges)

### 14.2 Chosen Direction: Tag-First (#6)

**Layout structure:**
```
┌─────────────────────────────────────┐
│ [PAIN]  Sarah Chen · 12:31          │
│         Frustrated with 5-step      │
│         onboarding process          │
├─────────────────────────────────────┤
│ [GOAL]  You · 12:33                 │
│         Wants single-page wizard    │
└─────────────────────────────────────┘
```

### 14.3 Design Rationale

1. **Category-first scanning** - The evidence type (Pain, Goal, Workflow) is the most important signal; it should be the first thing visible
2. **Receipts philosophy** - Bold tags reinforce that every insight is categorized and traceable
3. **Glanceable** - Large colored badges are visible even in peripheral vision
4. **Differentiated** - Competitors use subtle tags; bold badges are distinctive
5. **Research-focused** - Researchers care about *what kind* of insight, not just *what was said*

### 14.4 Implementation Approach

- Large tag badges (60px min-width, 6px padding)
- High-contrast colors on dark background
- Horizontal layout: Tag | Content block (speaker + gist)
- Tags use solid fills (not outlines) for maximum visibility
- Compact mode: same layout, smaller text
- Expanded mode: more vertical breathing room

---

## 15. User Journey Flows

### 15.1 Live Recording Flow

```
App Open → Meeting Detected? → Join/Start → Recording Begins
→ Red dot + timer → First evidence (~30s) → Evidence stream
→ Glance cycle → Meeting ends → Auto-expand to review
```

**Key moments:**
- First evidence appears (~30s) - confidence established
- Glance-and-return cycle - minimal distraction
- Auto-expand on meeting end - seamless transition

### 15.2 Post-Meeting Review Flow

```
Meeting Ends → Panel expands → Summary View (tabs)
→ Review Evidence → Edit if needed → Switch to Tasks
→ Confirm/Dismiss/Edit each → Save to Project → Success
```

**Key moments:**
- Tabs: Evidence | Tasks | Transcript
- Inline editing of evidence cards
- Checkbox confirm for action items
- Batch commit to main app

### 15.3 Note Capture Flow

```
Cmd+Shift+N → Note input slides in → Type → Enter
→ Note saved with timestamp → Appears in stream → Focus returns
```

**Key moments:**
- < 2 second total interaction
- Auto-timestamped
- Tagged as "Note" with user icon

### 15.4 Journey Patterns

| Pattern | Implementation |
|---------|----------------|
| Entry | Auto-detect meeting OR manual trigger |
| Feedback | Subtle animations, confirmation flashes |
| Transitions | Auto-expand on end, manual minimize |
| Commits | Provisional → Confirmed → Batch save |

### 15.5 Optimization Principles

1. **< 3 clicks to value** - Recording starts in 1-2 clicks
2. **Keyboard-first** - All core actions have shortcuts
3. **Auto-recovery** - Network retries silently
4. **Progressive disclosure** - Compact essentials, expanded details
5. **Undo-friendly** - Dismissed items recoverable

---

## 16. Component Strategy

### 16.1 shadcn/ui Components (Use Directly)

Button, Tabs, Card, Dialog, Input, Checkbox, Badge, Tooltip, ScrollArea

### 16.2 Custom Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| **EvidenceCard** | Display extracted evidence (Tag-First layout) | P1 |
| **RecordingIndicator** | Show recording status (red dot + timer) | P1 |
| **TagBadge** | Prominent category badge (solid fill, bold) | P1 |
| **FloatingPanel** | Main window container (3 modes) | P1 |
| **NoteInput** | Quick timestamped note capture | P2 |
| **ActionItemCard** | Task confirmation (provisional → confirmed) | P3 |

### 16.3 Component States

| Component | States |
|-----------|--------|
| EvidenceCard | default, hover, selected, new (animated) |
| RecordingIndicator | recording (pulse), paused, stopped |
| NoteInput | hidden, visible, saving, saved |
| ActionItemCard | provisional, confirmed, dismissed |
| FloatingPanel | compact, expanded, minimized |

### 16.4 EvidenceCard Specification (Tag-First)

```
┌──────────────────────────────────────────┐
│ [PAIN]  Sarah Chen · 12:31               │
│         Frustrated with current 5-step   │
│         onboarding process               │
└──────────────────────────────────────────┘
```

- Tag badge: 60px min-width, solid fill, uppercase
- Speaker + timestamp: muted color, 12px
- Gist: 13px, primary color, 1.4 line-height

### 16.5 Implementation Phases

**Phase 1 (MVP)**: FloatingPanel, RecordingIndicator, EvidenceCard, TagBadge
**Phase 2 (Core)**: NoteInput, mode transitions, expanded variants
**Phase 3 (Post-Meeting)**: ActionItemCard, Tabs, Save to Project flow

---

## 17. UX Consistency Patterns

### 17.1 Button Hierarchy

| Level | Style | Usage |
|-------|-------|-------|
| Primary | Solid blue | Main action (1 per view max) |
| Secondary | Outline | Supporting actions |
| Ghost | Text only | Tertiary actions |
| Destructive | Red | Dangerous (requires confirmation) |

### 17.2 Feedback Patterns

| Type | Style | Duration |
|------|-------|----------|
| Success | Green toast, bottom-right | 3s auto-dismiss |
| Error | Red toast, bottom-right | Manual dismiss |
| Progress | Inline spinner | Until complete |
| Confirmation | Element flash | 300ms |

### 17.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+N` | Add note |
| `Cmd+Shift+R` | Toggle recording |
| `Cmd+1/2/3` | Switch tabs |
| `Escape` | Cancel/close/minimize |
| `Enter` | Confirm/submit |

### 17.4 State Transitions

- All transitions: 150-300ms
- Easing: `ease-out` for expand, `ease-in` for collapse
- Respect `prefers-reduced-motion`
- No bounce animations (professional aesthetic)

### 17.5 Error Recovery

| Principle | Implementation |
|-----------|----------------|
| Never lose data | Offline queue for pending saves |
| Silent recovery | Auto-retry with exponential backoff |
| Clear fallback | Manual retry button when auto fails |
| Informative | State indicator shows connection status |

---

## 18. Responsive Design & Accessibility

### 18.1 Panel Responsive Strategy

| Mode | Size | Content |
|------|------|---------|
| Minimized | 48×48px | Icon + recording indicator |
| Compact | 320×400px | Evidence stream, basic controls |
| Expanded | 480×600px+ | Full workspace with tabs |
| Resizable | 320-800px | Content reflows within bounds |

**Adaptation rules:**
- Evidence cards always single-column
- Tag badges maintain 60px minimum
- At 320px: hide timestamps (show on hover)
- At 800px: add secondary metadata column

### 18.2 Accessibility Target

**WCAG 2.1 AA Compliance**

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | 4.5:1 body, 3:1 large (all tokens pass) |
| Keyboard nav | Full support, visible focus rings |
| Screen reader | VoiceOver (macOS primary) |
| Reduced motion | Respect system `prefers-reduced-motion` |
| Focus management | Trap in modals, restore on close |

### 18.3 Component Accessibility

| Component | Implementation |
|-----------|----------------|
| EvidenceCard | `role="article"`, `aria-label` with full content |
| RecordingIndicator | `aria-live="polite"` for state changes |
| NoteInput | Focus trap while open, announce on save |
| ActionItemCard | Checkbox role, Space to toggle |
| FloatingPanel | `role="dialog"` when expanded |

### 18.4 Testing Plan

- VoiceOver audit on macOS
- Keyboard-only navigation testing
- axe-core automated testing in CI
- Color blindness simulation (Sim Daltonism)
- Panel behavior at all sizes/modes

---

## 19. Implementation Roadmap

### Phase 1: MVP (Week 1-2)
- FloatingPanel (compact mode only)
- RecordingIndicator
- EvidenceCard (Tag-First layout)
- TagBadge components
- Basic recording → evidence flow

### Phase 2: Core Experience (Week 3-4)
- NoteInput with Cmd+Shift+N
- Mode transitions (compact ↔ expanded)
- Tabs (Evidence | Tasks | Transcript)
- Auto-scroll with pause-on-interaction

### Phase 3: Post-Meeting (Week 5-6)
- ActionItemCard with confirmation flow
- Save to Project integration
- People linking
- Full accessibility audit

---

*UX Design Specification Complete - Ready for Implementation*
