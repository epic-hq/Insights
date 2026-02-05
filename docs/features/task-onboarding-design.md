# Task System Onboarding: "Mission Control" Design

## Vision

Transform the task system from a plain table into an **inviting, visual mission control** that new users land on after onboarding. Instead of a wall of text rows, users see a curated set of **action cards** arranged in a bento-style grid that communicates: "Here's your journey — pick where to start."

The design philosophy: **Apple simplicity meets game-board warmth**. Every card feels like an invitation, not an obligation.

---

## 1. Hashtag-Based Task Categories

Tasks are split into two primary hashtag groups, plus a shared foundation:

| Hashtag | Color Palette | Icon Theme | Who It's For |
|---------|--------------|------------|--------------|
| `#research` | Indigo/Violet | Microscope, Search, Brain | Product teams, UX researchers, founders doing discovery |
| `#sales` | Emerald/Teal | Target, Handshake, TrendingUp | Sales reps, AEs, founders doing sales |
| `#foundations` | Amber/Warm | Settings, Shield, Palette | Everyone (shared setup tasks) |

The `tags` array on each task stores these hashtags. The UI filters and groups by them. A task can have multiple hashtags if it spans both worlds (e.g., "Create Interview Guide" is `#research` but also useful for `#sales` discovery calls).

---

## 2. Onboarding Task Sets by Use Case

When a user completes onboarding and selects their research mode / lens, we seed a curated set of tasks. Each task has a **size** (how prominent the card is), **order** (suggested sequence), and **parallel group** (tasks that can be done in any order within the group).

### Use Case A: Customer Research / Discovery (`#research`)

```
Phase 1: "Get Set Up" (parallel group)
├── [LARGE]  Upload Your First Conversation     — 5 min
├── [MEDIUM] Create an Interview Guide           — 10 min
└── [MEDIUM] Define Your Target Personas         — 10 min

Phase 2: "Gather Evidence" (parallel group)
├── [LARGE]  Run Your First Interview            — 15 min
├── [MEDIUM] Review AI-Generated Evidence        — 5 min
└── [SMALL]  Add People from Conversations       — 3 min

Phase 3: "Find Patterns" (sequential)
├── [MEDIUM] Explore Themes & Insights           — 5 min
└── [MEDIUM] Create Your First Insight           — 10 min

Phase 4: "Take Action" (parallel group)
├── [SMALL]  Share a Finding with Your Team      — 3 min
└── [SMALL]  Create a Task from an Insight       — 3 min
```

### Use Case B: Sales / BANT Qualification (`#sales`)

```
Phase 1: "Set Up Your Pipeline" (parallel group)
├── [LARGE]  Import Your Contacts & Accounts     — 5 min
├── [MEDIUM] Create a Sales Call Template         — 10 min
└── [MEDIUM] Configure BANT Qualification Lens    — 5 min

Phase 2: "Run Conversations" (parallel group)
├── [LARGE]  Record Your First Sales Call         — 15 min
├── [MEDIUM] Review Deal Qualification Scores     — 5 min
└── [SMALL]  Tag Key Objections                   — 3 min

Phase 3: "Build Intelligence" (parallel group)
├── [MEDIUM] Explore Objection Patterns           — 5 min
├── [MEDIUM] Create an Opportunity                — 5 min
└── [SMALL]  Link Evidence to a Deal              — 3 min

Phase 4: "Scale Your Process" (parallel group)
├── [SMALL]  Invite a Team Member                 — 2 min
└── [SMALL]  Set Up Email Follow-Up Templates     — 5 min
```

### Use Case C: Survey / Feedback (`#research`)

```
Phase 1: "Launch Your Survey" (parallel group)
├── [LARGE]  Create Your First Survey             — 10 min
├── [MEDIUM] Customize Survey Questions           — 10 min
└── [SMALL]  Set Up Survey Distribution           — 5 min

Phase 2: "Collect Responses" (sequential)
├── [LARGE]  Share Your Survey Link               — 2 min
└── [MEDIUM] Monitor Incoming Responses           — 3 min

Phase 3: "Analyze Results" (parallel group)
├── [MEDIUM] Review AI-Extracted Evidence         — 5 min
├── [MEDIUM] Explore Response Themes              — 5 min
└── [SMALL]  Create Insights from Patterns        — 10 min

Phase 4: "Act on Findings" (parallel group)
├── [SMALL]  Share Survey Results                  — 3 min
└── [SMALL]  Create Tasks from Key Findings        — 5 min
```

### Use Case D: User Testing (`#research`)

```
Phase 1: "Prepare Your Test" (parallel group)
├── [LARGE]  Create a Test Script                 — 10 min
├── [MEDIUM] Define Success Criteria              — 5 min
└── [SMALL]  Set Up Your Testing Lens             — 3 min

Phase 2: "Run Sessions" (parallel group)
├── [LARGE]  Record Your First Test Session       — 20 min
├── [MEDIUM] Review Usability Scores              — 5 min
└── [SMALL]  Tag Friction Points                  — 5 min

Phase 3: "Synthesize" (parallel group)
├── [MEDIUM] Explore Usability Patterns           — 5 min
└── [MEDIUM] Create a Findings Report             — 10 min

Phase 4: "Improve" (parallel group)
├── [SMALL]  Create Tasks for Fixes               — 5 min
└── [SMALL]  Share with Your Product Team          — 3 min
```

---

## 3. Visual Design: The Bento Mission Board

### Layout Concept

The layout uses a **CSS Grid bento box** where cards have different spans based on their importance. Phase headers are subtle but clear. The whole thing feels like a well-designed game board.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  "Your Research Journey"                              3/10 complete │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─── Phase 1: Get Set Up ──────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌───────────────────────────┐  ┌────────────┐ ┌──────────┐ │  │
│  │  │                           │  │            │ │          │ │  │
│  │  │   📎 Upload Your First    │  │ 📝 Create  │ │ 👤 Define│ │  │
│  │  │      Conversation         │  │ Interview  │ │ Target   │ │  │
│  │  │                           │  │ Guide      │ │ Personas │ │  │
│  │  │   "Drop a recording or    │  │            │ │          │ │  │
│  │  │    paste a transcript     │  │  ~10 min   │ │  ~10 min │ │  │
│  │  │    to see the magic"      │  │            │ │          │ │  │
│  │  │                           │  │  [Start →] │ │ [Start →]│ │  │
│  │  │   ~5 min    [Start →]     │  │            │ │          │ │  │
│  │  │                           │  └────────────┘ └──────────┘ │  │
│  │  └───────────────────────────┘                               │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Phase 2: Gather Evidence ─────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌───────────────────────────┐  ┌────────────┐ ┌──────────┐ │  │
│  │  │                           │  │            │ │  ○ Add   │ │  │
│  │  │   🎙️ Run Your First       │  │ ✨ Review   │ │  People  │ │  │
│  │  │      Interview            │  │ AI Evidence│ │  ~3 min  │ │  │
│  │  │                           │  │  ~5 min    │ │          │ │  │
│  │  │   ~15 min   [Start →]     │  │  [Start →] │ │ [Start →]│ │  │
│  │  └───────────────────────────┘  └────────────┘ └──────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ... Phase 3 & 4 (slightly muted until Phase 1-2 progress) ...     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Card Anatomy

Each task card has a consistent structure but varies in size:

```
┌─────────────────────────────────────┐
│  ┌──────┐                           │
│  │ ICON │  Task Title               │
│  └──────┘  Short encouraging desc   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   [Preview / Illustration]  │    │  ← LARGE cards only
│  │   showing what the result   │    │
│  │   looks like                │    │
│  └─────────────────────────────┘    │
│                                     │
│  ⏱ ~5 min          #research       │
│                          [Start →]  │
└─────────────────────────────────────┘
```

### Card Sizes (CSS Grid Spans)

| Size | Grid Span | When to Use |
|------|-----------|-------------|
| **LARGE** | `col-span-2 row-span-2` | Hero tasks — first-time experiences, "aha moment" actions |
| **MEDIUM** | `col-span-1 row-span-2` or `col-span-2 row-span-1` | Important but not the main event |
| **SMALL** | `col-span-1 row-span-1` | Quick wins, supporting actions |

### Card States

Cards transition through visual states:

| State | Visual Treatment |
|-------|-----------------|
| **Locked** | Slightly transparent (opacity-60), subtle lock icon, no CTA button. Shown when prerequisites aren't met. |
| **Ready** | Full opacity, subtle pulse/glow on border (a soft breathing animation). Inviting hover lift effect. |
| **In Progress** | Indigo/emerald left border accent (matches hashtag). Progress indicator if multi-step. |
| **Completed** | Checkmark overlay, card slightly dimmed with satisfaction green tint. Confetti burst on first completion. |

### Color System

```
Card backgrounds (light mode):
  Ready:       white with subtle gradient to brand tint
  Completed:   slate-50 with green-50 tint
  Locked:      slate-100 with opacity

Card backgrounds (dark mode):
  Ready:       slate-900 with subtle gradient
  Completed:   slate-900 with emerald-900/20 tint
  Locked:      slate-900/60

Accent colors per hashtag:
  #research:    indigo-500 → violet-500 gradient
  #sales:       emerald-500 → teal-500 gradient
  #foundations:  amber-500 → orange-500 gradient

Phase headers:
  Subtle uppercase text, light divider line, phase number badge
```

---

## 4. Interaction Design

### Hover & Click

- **Hover**: Card lifts 2px (translateY), shadow deepens, border brightens slightly. 200ms ease-out.
- **Click "Start"**: Navigates to the relevant feature page with a contextual onboarding tooltip/coach mark. The task auto-transitions to `in_progress`.
- **Click card body**: Expands an inline detail panel (or navigates to task detail) showing full description, tips, and a preview.

### Progress & Celebration

- **Per-phase progress bar**: Thin bar under each phase header showing completion ratio.
- **Overall progress ring**: Top-right corner, shows total completion. Uses the goal-gradient effect (accelerating fill).
- **Milestone celebrations**:
  - First task completed → Subtle confetti + "Great start!" toast
  - Phase completed → Phase header gets a check badge + brief celebration
  - All tasks completed → Full celebration screen, transition to "normal" task view

### Progressive Disclosure

- **Phase 1 cards**: Always fully visible and interactive
- **Phase 2 cards**: Visible but slightly muted until any Phase 1 task starts
- **Phase 3-4 cards**: Collapsed to a "peek" row showing titles only, expand on click or when Phase 2 progresses
- This prevents overwhelm while showing the full journey ahead

### Transition to Regular Task View

Once a user completes 50%+ of onboarding tasks (or dismisses the onboarding view), the UI smoothly transitions to the standard task table/list view. A toggle allows switching back: "Show Mission Board" / "Show Task List".

---

## 5. Imagery & Icon Strategy

### Icon Selection (lucide-react)

Each task gets a carefully chosen icon that instantly communicates what it is:

```
Upload Conversation     → Upload, FileAudio, Mic
Create Interview Guide  → FileText, ClipboardList, Pen
Define Personas         → Users, UserCircle, Fingerprint
Run Interview           → Mic, Video, Phone
Review Evidence         → Sparkles, Eye, Search
Add People              → UserPlus, Users
Explore Themes          → Layers, GitBranch, Network
Create Insight          → Lightbulb, Zap, Brain
Share Finding           → Share2, Send, Forward
Create Task             → CheckSquare, ListTodo, Target
Import Contacts         → Import, Database, Upload
Record Sales Call       → PhoneCall, Mic, Radio
Review Qualification    → BarChart3, Target, CheckCircle
Tag Objections          → Tag, MessageSquare, Shield
Create Opportunity      → Briefcase, TrendingUp, Star
Invite Team Member      → UserPlus, Mail, Link
Create Survey           → ClipboardList, ListChecks, FormInput
```

### Illustration / Preview Strategy

For LARGE cards, include a small preview image or illustration that shows what the result looks like:

**Option A: Screenshot Previews (Recommended for v1)**
- Use actual mini-screenshots of the feature they'll use
- Show the "after" state: what it looks like when evidence is generated, when themes appear
- Gives users a concrete mental model before they start
- Implementation: Static images stored in `/public/onboarding/`

**Option B: Abstract Illustrations (Future Enhancement)**
- Custom minimal illustrations in the app's brand style
- Geometric/abstract representations (like Linear's or Notion's style)
- Example: For "Upload Conversation" — a simple waveform transforming into text bubbles
- Implementation: SVG components or Lottie animations

### Image Generation Prompts

If using AI image generation for card illustrations, here are prompts:

**For "Upload Your First Conversation":**
> Minimal flat illustration, abstract audio waveform transforming into organized text cards, indigo and violet gradient, clean white background, geometric style, no text, suitable for 400x200px card preview

**For "Run Your First Interview":**
> Minimal flat illustration, two abstract figures in conversation with speech bubbles becoming highlighted evidence cards, warm indigo tones, clean geometric style, no text, suitable for 400x200px card preview

**For "Explore Themes & Insights":**
> Minimal flat illustration, abstract nodes and connections forming clusters, data points grouping into color-coded theme circles, violet and indigo palette, clean geometric style, no text

**For "Import Contacts & Accounts":**
> Minimal flat illustration, abstract spreadsheet rows flowing and organizing into clean contact cards, emerald and teal gradient, geometric style, no text

**For "Create Your First Survey":**
> Minimal flat illustration, abstract form fields and checkboxes arranged in an inviting layout, responses flowing in as data points, indigo palette, geometric style, no text

### Color-Coded Phase Badges

Each phase gets a numbered badge with the hashtag color:

```
Phase 1: "Get Set Up"        → Circular badge "1" with hashtag gradient
Phase 2: "Gather Evidence"   → Circular badge "2"
Phase 3: "Find Patterns"     → Circular badge "3"
Phase 4: "Take Action"       → Circular badge "4" with star/sparkle accent
```

---

## 6. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| **Desktop (1200px+)** | 4-column bento grid, full card previews |
| **Tablet (768-1199px)** | 2-column grid, LARGE cards span full width |
| **Mobile (< 768px)** | Single column, cards stack vertically, LARGE cards get extra height for preview |

---

## 7. Data Model Changes

### New Fields on `tasks` Table

No schema changes required. We leverage existing fields:

- `tags[]` — Store `#research`, `#sales`, `#foundations` hashtags
- `stage` — Maps to our phases (repurpose: `phase-1`, `phase-2`, etc., or keep descriptive)
- `estimated_effort` — Already exists (S/M/L/XL), we can also use description for "~5 min"
- `depends_on_task_ids[]` — Express prerequisite relationships
- `priority` — Use to determine card size (3=LARGE, 2=MEDIUM, 1=SMALL)

### New: Onboarding Task Template System

Add a template/seed system that maps use cases to task sets:

```typescript
// app/features/tasks/onboarding-templates.ts

type OnboardingTemplate = {
  id: string
  useCase: 'research' | 'sales' | 'survey' | 'user-testing' | 'consulting'
  tasks: OnboardingTaskTemplate[]
}

type OnboardingTaskTemplate = {
  title: string
  description: string
  hashtags: string[]          // e.g., ['#research', '#foundations']
  phase: number               // 1-4
  parallelGroup: string       // tasks in same group can be done in any order
  cardSize: 'large' | 'medium' | 'small'
  estimatedMinutes: number
  icon: string                // lucide icon name
  ctaLabel: string            // "Upload Recording", "Start Interview", etc.
  ctaRoute: string            // relative route to navigate to
  previewImage?: string       // path to preview image for large cards
  prerequisitePhase?: number  // optional: don't unlock until this phase has progress
}
```

### Seeding Logic

```typescript
// During onboarding completion or first visit to tasks page:
async function seedOnboardingTasks(useCase: string, accountId: string, projectId: string) {
  const template = ONBOARDING_TEMPLATES[useCase]

  const tasks = template.tasks.map(t => ({
    title: t.title,
    description: t.description,
    tags: t.hashtags,
    stage: `phase-${t.phase}`,
    priority: t.cardSize === 'large' ? 3 : t.cardSize === 'medium' ? 2 : 1,
    estimated_effort: minutesToEffort(t.estimatedMinutes),
    status: 'todo',
    cluster: 'Onboarding',
    // Store card metadata in description or a new metadata field
  }))

  // Insert with depends_on relationships between phases
  await insertTasksWithDependencies(tasks)
}
```

---

## 8. Component Architecture

### New Components

```
app/features/tasks/components/
├── MissionBoard.tsx              # Main bento grid container
├── MissionBoardCard.tsx          # Individual task card (handles all sizes/states)
├── MissionBoardPhase.tsx         # Phase header with progress bar
├── MissionBoardProgress.tsx      # Overall progress ring (top-right)
├── MissionBoardCelebration.tsx   # Confetti/celebration overlays
├── MissionBoardToggle.tsx        # Switch between Mission Board ↔ Table view
└── onboarding-templates.ts       # Task template definitions per use case
```

### MissionBoard.tsx (Simplified Structure)

```tsx
function MissionBoard({ tasks, projectPath }) {
  const phases = groupTasksByPhase(tasks)
  const completionRatio = getCompletionRatio(tasks)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Your Research Journey
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete these steps to unlock the full power of UpSight
          </p>
        </div>
        <MissionBoardProgress ratio={completionRatio} />
      </div>

      {/* Phases */}
      {phases.map((phase, i) => (
        <MissionBoardPhase
          key={phase.number}
          phase={phase}
          isActive={i === 0 || phases[i-1].hasProgress}
          projectPath={projectPath}
        />
      ))}
    </div>
  )
}
```

### MissionBoardCard.tsx (Key Design Element)

```tsx
function MissionBoardCard({ task, size, state, projectPath }) {
  return (
    <div className={cn(
      // Base card
      "group relative rounded-2xl border p-5 transition-all duration-200",
      // Size-based grid span
      size === 'large' && "col-span-2 row-span-2",
      size === 'medium' && "col-span-1 row-span-2",
      size === 'small' && "col-span-1 row-span-1",
      // State-based styling
      state === 'ready' && "bg-card hover:shadow-lg hover:-translate-y-0.5 cursor-pointer border-border",
      state === 'locked' && "bg-muted/50 opacity-60 cursor-not-allowed",
      state === 'in_progress' && "bg-card border-l-4 border-l-indigo-500 shadow-sm",
      state === 'completed' && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    )}>
      {/* Icon + Title */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "rounded-xl p-2.5",
          task.hashtags.includes('#research') && "bg-indigo-100 dark:bg-indigo-900/30",
          task.hashtags.includes('#sales') && "bg-emerald-100 dark:bg-emerald-900/30",
        )}>
          <DynamicIcon name={task.icon} className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-sm leading-tight">{task.title}</h3>
          <p className="text-muted-foreground text-xs mt-1">{task.description}</p>
        </div>
      </div>

      {/* Preview image for large cards */}
      {size === 'large' && task.previewImage && (
        <div className="rounded-lg overflow-hidden bg-muted/50 mb-3">
          <img src={task.previewImage} alt="" className="w-full h-32 object-cover" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            ~{task.estimatedMinutes} min
          </span>
          {task.hashtags.map(tag => (
            <span key={tag} className="text-xs text-muted-foreground/60">{tag}</span>
          ))}
        </div>

        {state === 'ready' && (
          <Link
            to={task.ctaRoute}
            className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            {task.ctaLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}

        {state === 'completed' && (
          <Check className="h-4 w-4 text-green-600" />
        )}
      </div>

      {/* Completion state overlay */}
      {state === 'completed' && (
        <div className="absolute inset-0 rounded-2xl bg-green-500/5 pointer-events-none" />
      )}
    </div>
  )
}
```

---

## 9. Implementation Plan

### Phase 1: Foundation (Task Templates + Hashtag Seeding)
1. Create `onboarding-templates.ts` with task definitions for each use case
2. Update `seedTasks` to accept a `useCase` parameter and seed from templates
3. Add hashtag tags to seeded tasks
4. Wire seeding to onboarding flow completion

### Phase 2: Mission Board UI
1. Build `MissionBoardCard` component with all size variants and states
2. Build `MissionBoardPhase` with progress bars
3. Build `MissionBoard` container with CSS Grid bento layout
4. Build `MissionBoardProgress` ring component
5. Add route/page for the mission board view

### Phase 3: Interactions & Polish
1. Add hover/click animations (translate, shadow transitions)
2. Add confetti celebration on first task completion
3. Implement progressive disclosure (phase muting/collapsing)
4. Add "Start" CTA routing to feature pages with context
5. Add toggle between Mission Board and Table view

### Phase 4: Imagery & Delight
1. Create or generate preview images for large cards
2. Add coach marks / tooltips on first visit to each feature
3. Add milestone celebrations (phase complete, all complete)
4. Implement "graduation" transition to normal task view

---

## 10. Key Design Principles

1. **Invitation, not obligation** — Cards should feel like gifts to open, not chores to check off
2. **Show the destination** — Preview images and descriptions paint a picture of what success looks like
3. **Respect non-linearity** — Parallel groups let users follow their curiosity, not a rigid sequence
4. **Celebrate progress** — Every completion, no matter how small, gets acknowledged
5. **Progressive revelation** — Don't overwhelm with 15 tasks at once; reveal as the user is ready
6. **Maintain escape velocity** — Users can always switch to the table view or dismiss onboarding
7. **Hashtag identity** — The `#research` / `#sales` split gives users a sense that this tool knows who they are

---

## 11. Inspirational References

| Reference | What to Take |
|-----------|-------------|
| **Linear's onboarding** | Clean card layout, minimal chrome, keyboard-friendly |
| **Notion's getting started** | Each step teaches one concept, builds competency |
| **Figma's animated onboarding** | Fast, visual, lets you try things immediately |
| **Apple's bento grid** (product pages) | Variable card sizes creating visual rhythm |
| **21st.dev bento components** | Aceternity-style grid with glassmorphism cards |
| **Duolingo's lesson map** | Non-linear progression, celebration at milestones, visual fun |
| **Stripe's dashboard setup** | Guided but not patronizing, clean progress indicators |

---

## 12. Open Questions

1. **Should we auto-complete tasks?** If a user uploads a conversation outside the mission board, should the "Upload Conversation" task auto-complete? (Recommended: yes, via background check)
2. **Persistence of mission board** — Should it always be accessible, or fade after onboarding? (Recommended: always accessible via toggle, but default to table after 70% completion)
3. **Custom task addition** — Can users add their own tasks to the mission board, or only to the table view? (Recommended: table view only, mission board stays curated)
4. **Team vs individual** — If one team member completes a task, does it complete for everyone? (Recommended: per-user, since each person needs to learn)
