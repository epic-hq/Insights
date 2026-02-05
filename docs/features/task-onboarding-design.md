# Task System Onboarding: "The Journey" Design

## Vision

Transform the task system into a **visual adventure map** — a winding path through a landscape where each stop is a milestone. Users see themselves as an explorer on a journey: the path is laid out before them, they can see how far they've come, and each step reveals a "deck" of action cards to play. Completed cards earn gold stars and shrink out of the way, keeping focus on what's next.

Think **Duolingo's skill path meets a board game meets Dora the Explorer** — but with the polish and restraint of Apple's design language.

The design philosophy: **You are on an adventure. Each card is a move. The mountain summit is mastery.**

---

## 1. The Journey Metaphor

### Core Concept

The entire onboarding IS a journey map. A winding illustrated path moves left-to-right through a landscape, with 4 "stops" (phases) along the route. Each stop is a large, glowing node you can click to reveal a deck of playing cards — the tasks for that phase.

```
   [YOU]
    |
    v
 ○═══════○ · · · · ○ · · · · · · ○ · · · · · ⭐
 Get      Gather    Find          Take        SUMMIT!
 Set Up   Evidence  Patterns      Action
 (done!)  (active)  (upcoming)    (locked)
```

The user's avatar sits at their current position on the path. Behind them, completed stops are green with checkmarks. Ahead, the path fades into atmospheric mystery — mountains, trees, clouds — creating a pull to keep going.

### The Landscape

The background is an atmospheric **night-sky mountain landscape**:
- Deep navy/slate sky with subtle twinkling stars
- Layered mountain silhouettes in the distance
- Palm trees and grass tufts along the ground
- A summit marker (flag + "SUMMIT!") at the journey's end
- The aesthetic is calm and adventurous — not childish, not corporate

### Why This Works

1. **Spatial memory** — Users remember WHERE they are on the path, not just a number
2. **Pull of the summit** — Seeing the end creates motivation to complete
3. **Non-linear within linear** — The path is sequential, but each stop has parallel cards
4. **Natural focus** — Completed stops collapse, upcoming stops peek, current stop is fully open
5. **Celebration is built-in** — Stars, path progression, avatar movement all feel earned

---

## 2. Hashtag-Based Task Categories

Tasks are split into two primary hashtag groups, plus a shared foundation:

| Hashtag | Color Palette | Icon Theme | Who It's For |
|---------|--------------|------------|--------------|
| `#research` | Indigo/Violet | Microscope, Search, Brain | Product teams, UX researchers, founders doing discovery |
| `#sales` | Emerald/Teal | Target, Handshake, TrendingUp | Sales reps, AEs, founders doing sales |
| `#foundations` | Amber/Warm | Settings, Shield, Palette | Everyone (shared setup tasks) |

The `tags` array on each task stores these hashtags. The journey map theme shifts based on the primary hashtag:
- **#research journey**: Mountain expedition theme ("Climb to clarity")
- **#sales journey**: Ocean voyage theme ("Navigate to the deal")
- Both share the same mechanics, just different atmosphere

---

## 3. Onboarding Task Sets by Use Case

When a user completes onboarding and selects their research mode / lens, we seed a curated set of tasks. Each task has a **card type** (hero vs. standard), **phase**, and **parallel group**.

### Use Case A: Customer Research / Discovery (`#research`)

```
Stop 1: "Get Set Up" (parallel — do in any order)
├── [HERO]     Upload Your First Conversation     — 5 min
├── [STANDARD] Create an Interview Guide           — 10 min
└── [STANDARD] Define Your Target Personas         — 10 min

Stop 2: "Gather Evidence" (parallel)
├── [HERO]     Run Your First Interview            — 15 min
├── [STANDARD] Review AI-Generated Evidence        — 5 min
└── [STANDARD] Add People from Conversations       — 3 min

Stop 3: "Find Patterns" (sequential)
├── [STANDARD] Explore Themes & Insights           — 5 min
└── [STANDARD] Create Your First Insight           — 10 min

Stop 4: "Take Action" (parallel)
├── [STANDARD] Share a Finding with Your Team      — 3 min
└── [STANDARD] Create a Task from an Insight       — 3 min
```

### Use Case B: Sales / BANT Qualification (`#sales`)

```
Stop 1: "Set Up Your Pipeline" (parallel)
├── [HERO]     Import Your Contacts & Accounts     — 5 min
├── [STANDARD] Create a Sales Call Template         — 10 min
└── [STANDARD] Configure BANT Qualification Lens    — 5 min

Stop 2: "Run Conversations" (parallel)
├── [HERO]     Record Your First Sales Call         — 15 min
├── [STANDARD] Review Deal Qualification Scores     — 5 min
└── [STANDARD] Tag Key Objections                   — 3 min

Stop 3: "Build Intelligence" (parallel)
├── [STANDARD] Explore Objection Patterns           — 5 min
├── [STANDARD] Create an Opportunity                — 5 min
└── [STANDARD] Link Evidence to a Deal              — 3 min

Stop 4: "Scale Your Process" (parallel)
├── [STANDARD] Invite a Team Member                 — 2 min
└── [STANDARD] Set Up Email Follow-Up Templates     — 5 min
```

### Use Case C: Survey / Feedback (`#research`)

```
Stop 1: "Launch Your Survey" (parallel)
├── [HERO]     Create Your First Survey             — 10 min
├── [STANDARD] Customize Survey Questions           — 10 min
└── [STANDARD] Set Up Survey Distribution           — 5 min

Stop 2: "Collect Responses" (sequential)
├── [HERO]     Share Your Survey Link               — 2 min
└── [STANDARD] Monitor Incoming Responses           — 3 min

Stop 3: "Analyze Results" (parallel)
├── [STANDARD] Review AI-Extracted Evidence         — 5 min
├── [STANDARD] Explore Response Themes              — 5 min
└── [STANDARD] Create Insights from Patterns        — 10 min

Stop 4: "Act on Findings" (parallel)
├── [STANDARD] Share Survey Results                  — 3 min
└── [STANDARD] Create Tasks from Key Findings        — 5 min
```

### Use Case D: User Testing (`#research`)

```
Stop 1: "Prepare Your Test" (parallel)
├── [HERO]     Create a Test Script                 — 10 min
├── [STANDARD] Define Success Criteria              — 5 min
└── [STANDARD] Set Up Your Testing Lens             — 3 min

Stop 2: "Run Sessions" (parallel)
├── [HERO]     Record Your First Test Session       — 20 min
├── [STANDARD] Review Usability Scores              — 5 min
└── [STANDARD] Tag Friction Points                  — 5 min

Stop 3: "Synthesize" (parallel)
├── [STANDARD] Explore Usability Patterns           — 5 min
└── [STANDARD] Create a Findings Report             — 10 min

Stop 4: "Improve" (parallel)
├── [STANDARD] Create Tasks for Fixes               — 5 min
└── [STANDARD] Share with Your Product Team          — 3 min
```

---

## 4. Visual Design: The Journey Map

### Interactive Mockup

**Open the mockup**: `docs/features/task-onboarding-journey-mockup.html`

Open this file in a browser to see the interactive prototype with:
- Winding path through a mountain landscape
- 4 stops with different states (completed, active, upcoming, locked)
- Player avatar at current position
- Click any stop to reveal/hide its card deck
- Hero cards with animated waveform preview
- Completed cards with gold stars
- "Next Up" floating card for quick access
- Progress bar in the top bar
- Summit marker at the journey's end

### Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Your Research Journey]                              [3 of 12] ━━━━━░░░░░░ │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ★★★                              ☆☆☆                                        │
│                                                                              │
│        ┌─[YOU]─┐                                                             │
│        │ Avatar│                                                             │
│        └───┬───┘                                                             │
│            │                                                                 │
│   ●════════●· · · · · · ●· · · · · · · · ○· · · · · · · ⊙                  │
│   ✓ Get    ★ Gather      Find              Take          SUMMIT             │
│   Set Up   Evidence      Patterns          Action        ⭐                  │
│                                                                              │
│   [cards    [cards       [cards            [locked        [Research          │
│    done &    expanded     collapsed]        cards]         Pro!]             │
│    shrunk]   below]                                                          │
│                                                                              │
│            ┌─────────────────┐                                               │
│            │ 🎙 HERO CARD     │                                              │
│            │ Run Your First   │                                              │
│            │ Interview        │                                              │
│            │                  │                                              │
│            │ ┌──────────────┐│                                               │
│            │ │ ▊▌▋▊▍▌▊▋▍▌ ││ ← animated waveform                          │
│            │ └──────────────┘│                                               │
│            │ ~15 min   Start→│                                               │
│            └─────────────────┘                                               │
│            ┌─────────────────┐                                               │
│            │ ✨ Review AI     │                                              │
│            │   Evidence       │                                              │
│            │ ~5 min    Start→ │                                              │
│            └─────────────────┘                                               │
│            ┌─────────────────┐                                               │
│            │ 👤+ Add People   │                                              │
│            │ ~3 min    Start→ │                                              │
│            └─────────────────┘                                               │
│                                                                              │
│  🌴        🌿          🌴🌴           🌿       ⛰️ ⛰️ ⛰️        🏔️          │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Stop Node States

| State | Visual | Behavior |
|-------|--------|----------|
| **Completed** | Green circle + checkmark. Solid green glow. | Click to view completed cards (shrunk with gold stars). Cards are dimmed. |
| **Active** | Indigo/violet circle + pulsing glow animation. Player avatar is here. | Cards are expanded by default. Hero card has accent border + preview. |
| **Upcoming** | Semi-transparent indigo outline circle. | Click to peek at cards. Cards are interactive but path hasn't reached here. |
| **Locked** | Dashed gray circle + lock icon. | Click shows cards in disabled state. "Unlocks after Phase X" label. |

### The Path

The path between stops is rendered as:
- **Completed segments**: Solid gradient line (green → indigo)
- **Active segment**: Dotted/dashed line with subtle animation (marching ants)
- **Future segments**: Faint dotted line

The path **winds** — alternating up and down (odd stops higher, even stops lower) to create a sense of terrain traversal, not just a flat timeline.

### Player Avatar

- Circular avatar (user's photo or default icon) with amber/gold border
- Positioned at the current active stop
- Gentle bouncing animation (translateY oscillation)
- "YOU" label beneath
- When a phase completes → avatar animates along the path to the next stop (0.8s cubic-bezier for a satisfying spring)

---

## 5. The Playing Card Design

### Card Types

**Hero Card** (one per stop):
- Slightly larger, 2px indigo top border with gradient
- Contains an animated preview (waveform, node graph, etc.)
- More prominent CTA button
- This is the "main quest" of each stop

**Standard Card**:
- Clean, compact design
- Icon + title + description + time + CTA
- These are "side quests" that support the hero task

### Card Anatomy

```
┌─────────────────────────────────────┐
│  ┌──────┐                           │
│  │ ICON │  Task Title               │  ← Icon in colored rounded square
│  └──────┘  Short encouraging desc   │     matching #hashtag color
│                                     │
│  ┌─────────────────────────────┐    │
│  │   [Animated Preview]        │    │  ← Hero cards only:
│  │   waveform / node graph /   │    │     live SVG animation showing
│  │   flowing data viz          │    │     what the result looks like
│  └─────────────────────────────┘    │
│                                     │
│  ⏱ ~5 min  #research    [Start →]  │  ← Time, tag, action CTA
└─────────────────────────────────────┘
```

### Card States & Transitions

| State | Visual | Gold Star |
|-------|--------|-----------|
| **Ready** | Full opacity. Glassmorphic dark background. Hover lifts 2px with deeper shadow. | No |
| **In Progress** | 4px left border in hashtag color. Subtle inner glow. | No |
| **Done** | Shrinks to 95% scale. Green tint overlay. Opacity 70%. | YES — gold star in top-right corner |

### Gold Star

When a card is completed:
1. A gold star (SVG, `#fbbf24` fill) appears in the top-right corner with a pop-in animation
2. The card text changes to "Completed" in green
3. The card scales down to 95% and dims to 70% opacity
4. The CTA button is replaced with a green checkmark

This creates a satisfying "done!" feeling while shrinking the card out of focus so the remaining tasks feel more prominent.

### "Next Up" Floating Card

A sticky card in the top-right corner always shows the recommended next task:
- Fixed position, doesn't scroll
- Shows title + short description + "Start This Step" CTA
- Clicking it scrolls to and expands the relevant stop
- This gives focus even when the user is exploring other parts of the map

---

## 6. Interaction Design

### Scrolling & Navigation

- The journey scrolls **horizontally** (the path extends left-to-right)
- Mouse wheel scrolls horizontally (with smooth scroll-snap)
- Clicking a stop auto-scrolls to center it
- Keyboard: Left/Right arrows navigate between stops
- Mobile: Swipe left/right

### Stop Click Behavior

1. **Click a stop node** → Expands/collapses its card deck (accordion style — only one open at a time)
2. **Click a card CTA** → Navigates to the feature page + marks task as `in_progress`
3. **Complete a task** (detected by system) → Card gets gold star, counter updates, avatar considers moving

### Celebrations

| Trigger | Animation |
|---------|-----------|
| **First task completed** | Gold star pop-in + subtle confetti burst + "Great start!" toast |
| **Stop completed** | All cards get stars → celebration modal ("Phase Complete!") → avatar animates to next stop |
| **Journey completed** | Full celebration screen → "Research Pro Unlocked!" → transition to normal task view |

### Progressive Disclosure

- **Completed stops**: Node is green with checkmark. Cards hidden by default (click to review). The stop takes up less visual space.
- **Active stop**: Fully expanded. Player avatar bouncing here. Cards visible.
- **Next stop**: Node visible and clickable. Cards peeking (visible but slightly muted).
- **Locked stops**: Dashed circle, lock icon, "Unlocks after Phase X" label. Cards shown in disabled/gray state if clicked.

---

## 7. Imagery, Icons & Atmosphere

### Landscape Elements

The background creates atmosphere without distracting:

| Element | Treatment | Purpose |
|---------|-----------|---------|
| **Night sky** | Deep navy (#0f1729) with CSS gradient | Calm, focused environment |
| **Stars** | 80+ tiny white dots with twinkle animation (random opacity oscillation) | Ambient life |
| **Mountains** | 2 layers of SVG silhouettes in slate-800/slate-900, parallax-offset | Depth, "summit" destination |
| **Ground** | Wavy SVG terrain strip in slate-800 | Grounds the path |
| **Trees** | SVG palm tree silhouettes at 10-15% opacity | Tropical adventure feel |
| **Summit flag** | Golden flag at journey's end with "SUMMIT" label | Clear goal |

### Icon Selection (lucide-react)

```
Upload Conversation     → Upload
Create Interview Guide  → FileText
Define Personas         → Users
Run Interview           → Mic
Review Evidence         → Sparkles (star polygon)
Add People              → UserPlus
Explore Themes          → Layers
Create Insight          → Lightbulb
Share Finding           → Share2
Create Task             → CheckCircle
Import Contacts         → Upload
Record Sales Call       → Mic
Review Qualification    → BarChart3
Tag Objections          → Tag
Create Opportunity      → Briefcase
Invite Team Member      → UserPlus
Create Survey           → ClipboardList
```

### Hero Card Preview Animations

Instead of static images, hero cards use **simple SVG/CSS animations** that hint at the result:

| Task | Preview Animation |
|------|------------------|
| Upload Conversation | Audio waveform bars oscillating (10 bars, staggered animation-delay) |
| Run Your First Interview | Two speech bubble icons with a connecting line, pulsing |
| Explore Themes | Node graph with dots connecting and clustering |
| Import Contacts | Rows sliding in from left and stacking into a grid |
| Create Survey | Checkbox items appearing one by one with a check animation |

### AI Image Generation Prompts (for static fallback)

**For "Upload Your First Conversation":**
> Minimal flat illustration, abstract audio waveform transforming into organized insight cards, indigo and violet gradient on dark navy background, geometric low-poly style, no text, 400x200px

**For "Run Your First Interview":**
> Minimal flat illustration, two abstract figures having a conversation, speech bubbles becoming highlighted evidence cards, warm indigo tones on dark background, geometric style, no text, 400x200px

**For "Explore Themes & Insights":**
> Minimal flat illustration, abstract nodes and connections forming clusters, data points grouping into color-coded theme circles, violet and indigo on dark navy, geometric style, no text

---

## 8. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| **Desktop (1200px+)** | Horizontal scroll journey, stops spread out, full card decks |
| **Tablet (768-1199px)** | Horizontal scroll but stops closer together, cards slightly narrower |
| **Mobile (< 768px)** | **Vertical journey** — path goes top-to-bottom instead of left-to-right. Stops stack vertically. Cards use full width. Swipe up/down. |

---

## 9. Data Model

### No Schema Changes Required

We leverage existing fields on the `tasks` table:

| Field | Usage |
|-------|-------|
| `tags[]` | Store `#research`, `#sales`, `#foundations` hashtags |
| `stage` | Phase identifier: `phase-1`, `phase-2`, `phase-3`, `phase-4` |
| `estimated_effort` | Card time estimate (S=3min, M=10min, L=15min, XL=20min) |
| `depends_on_task_ids[]` | Phase prerequisite relationships |
| `priority` | Card type (3=Hero, 2=Standard, 1=Quick) |
| `cluster` | Set to `Onboarding` for journey tasks |

### Onboarding Task Template System

```typescript
// app/features/tasks/onboarding-templates.ts

type JourneyStop = {
  phase: number
  title: string           // "Get Set Up", "Gather Evidence", etc.
  subtitle: string        // "Foundation for your research"
  icon: string            // lucide icon for the stop node
  tasks: JourneyTask[]
}

type JourneyTask = {
  title: string
  description: string     // Short encouraging description
  hashtags: string[]      // ['#research'] or ['#sales']
  isHero: boolean         // Hero card (has preview, larger)
  estimatedMinutes: number
  icon: string            // lucide icon name
  ctaLabel: string        // "Upload Recording", "Start Interview"
  ctaRoute: string        // relative route within project
  previewType?: 'waveform' | 'nodes' | 'list' | 'chat' | 'checklist'
}

type JourneyTemplate = {
  id: string
  useCase: 'research' | 'sales' | 'survey' | 'user-testing'
  title: string           // "Your Research Journey"
  summitLabel: string     // "Research Pro" or "Sales Pro"
  stops: JourneyStop[]
}
```

---

## 10. Component Architecture

### New Components

```
app/features/tasks/components/journey/
├── JourneyMap.tsx              # Main horizontal scroll container + landscape
├── JourneyPath.tsx             # SVG path connecting stops
├── JourneyStop.tsx             # Clickable stop node (circle + label)
├── JourneyPlayer.tsx           # User avatar that moves along the path
├── JourneyCardDeck.tsx         # Expanding deck of cards under a stop
├── JourneyCard.tsx             # Individual playing card
├── JourneyCardPreview.tsx      # Animated preview for hero cards
├── JourneyProgress.tsx         # Top bar progress pill
├── JourneyNextUp.tsx           # Floating "next up" card
├── JourneyCelebration.tsx      # Phase/journey completion celebration
├── JourneySummit.tsx           # Summit marker at end
├── JourneyLandscape.tsx        # Background SVGs (mountains, trees, stars)
└── journey-templates.ts        # Task template definitions per use case
```

### Key Implementation Notes

**JourneyMap.tsx** — Container:
- Horizontal scroll with `overflow-x: auto`
- `scroll-snap-type: x mandatory` for stop-to-stop snapping
- Renders landscape, path, stops, and player
- Manages which stop is expanded (accordion state)

**JourneyStop.tsx** — Stop nodes:
- Position alternates vertically (odd=higher, even=lower) for winding path feel
- Click handler toggles card deck expansion
- State derived from task completion: completed/active/upcoming/locked

**JourneyCard.tsx** — Playing cards:
- Uses glassmorphic dark background (`rgba(30, 41, 59, 0.9)` + `backdrop-filter: blur`)
- Hover: `translateY(-2px)` + shadow deepening + top border fade-in
- Done state: `scale(0.95)` + `opacity: 0.7` + green tint + gold star SVG

**JourneyPlayer.tsx** — Avatar:
- Absolute positioned, moves via CSS transition (`transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Bounce animation: `translateY` oscillation on 2s loop
- Position calculated from current active stop's DOM position

---

## 11. Implementation Plan

### Phase 1: Foundation
1. Create `journey-templates.ts` with task definitions for all 4 use cases
2. Update `seedTasks` to accept a `useCase` parameter and seed from templates
3. Add hashtag tags and phase stages to seeded tasks
4. Wire seeding to onboarding flow completion

### Phase 2: Journey Map UI
1. Build `JourneyLandscape.tsx` (stars, mountains, terrain SVGs)
2. Build `JourneyStop.tsx` with all 4 states
3. Build `JourneyPath.tsx` (SVG connecting line between stops)
4. Build `JourneyMap.tsx` container with horizontal scroll
5. Build `JourneyPlayer.tsx` avatar with bounce animation

### Phase 3: Playing Cards
1. Build `JourneyCard.tsx` with ready/done states
2. Build `JourneyCardPreview.tsx` with animated previews
3. Build `JourneyCardDeck.tsx` with expand/collapse
4. Build `JourneyNextUp.tsx` floating card
5. Build `JourneyProgress.tsx` top bar

### Phase 4: Interactions & Delight
1. Gold star animation on card completion
2. Player avatar path animation on phase completion
3. `JourneyCelebration.tsx` for phase/journey milestones
4. Scroll-to-stop on click with smooth scrolling
5. `JourneySummit.tsx` completion reward

### Phase 5: Integration
1. Add journey route to `app/routes.ts`
2. Connect task completion detection (auto-complete when user performs action)
3. Add toggle between Journey Map and Table view
4. Mobile vertical layout adaptation
5. Persist journey state per user

---

## 12. Design Principles

1. **Adventure, not administration** — This is a journey, not a to-do list
2. **Show the summit** — The endpoint is always visible, pulling users forward
3. **Cards are moves** — Each card is a concrete action, not a vague objective
4. **Celebrate every win** — Gold stars, checkmarks, confetti — progress feels good
5. **Focus on next** — Done cards shrink. The "Next Up" card is always visible.
6. **Non-linear within linear** — Stops are sequential. Cards within a stop are parallel.
7. **Escape hatch** — Users can always switch to the standard table view

---

## 13. Inspirational References

| Reference | What to Take |
|-----------|-------------|
| **Duolingo's path** | Winding skill path, celebration animations, progress visualization |
| **Candy Crush map** | Left-to-right progression through themed landscapes |
| **Board game aesthetics** | Stops/nodes, dice-roll energy, "your turn" excitement |
| **Apple's bento grid** (for cards) | Clean card layout with variable prominence |
| **GitHub's contribution graph** | Satisfaction of filling in progress visually |
| **RPG skill trees** | Branch points, locked/unlocked states, character progression |
| **Notion's getting started** | Each step teaches one concept, builds competency |

---

## 14. Open Questions

1. **Should we auto-complete tasks?** If a user uploads a conversation outside the journey, should the "Upload Conversation" card auto-complete? (Recommended: yes, via background check)
2. **Theme selection** — Should users pick their landscape theme (mountain/ocean/forest) or should it be tied to hashtag (#research=mountain, #sales=ocean)?
3. **Persistence** — Should the journey always be accessible, or fade after completion? (Recommended: always accessible via toggle, but default to table after 70% completion)
4. **Team vs individual** — If one team member completes a card, does it complete for everyone? (Recommended: per-user journey, since each person needs to learn)
5. **Lottie vs CSS** — Should we use Lottie files for richer landscape animations, or keep it pure CSS/SVG for performance? (Recommended: CSS/SVG for v1, add Lottie for v2 polish)
