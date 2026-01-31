# Figma Mockup Specification

> **Purpose:** Detailed spec for creating Figma mockups of generative UI
> **Artboards Needed:** 8 key screens showing component adaptation
> **Style:** Clean, modern, follow existing UpSight design system

## Design System Reference

### Colors
```
Primary: #10b981 (green-500)
Secondary: #3b82f6 (blue-500)
Background: #ffffff (light) / #1f2937 (dark)
Text: #111827 (gray-900) / #f9fafb (gray-50)
Muted: #6b7280 (gray-500)
Border: #e5e7eb (gray-200) / #374151 (gray-700)
Success: #10b981 (green-500)
Warning: #f59e0b (amber-500)
Error: #ef4444 (red-500)
Hot Deal: #f97316 (orange-500) with 🔥
```

### Typography
```
Headings: Inter, 600 weight
Body: Inter, 400 weight
Code/Mono: JetBrains Mono

Sizes:
- H1: 24px
- H2: 20px
- H3: 16px
- Body: 14px
- Small: 12px
- Tiny: 10px
```

### Spacing
```
Base unit: 4px
Padding: 12px, 16px, 24px
Gaps: 8px, 12px, 16px
Border radius: 8px (cards), 6px (buttons), 4px (inputs)
```

### Components
Use shadcn/ui style:
- Buttons: Solid for primary, outline for secondary
- Inputs: Border with focus ring
- Cards: Subtle shadow, border
- Badges: Small, rounded pills

---

## Artboard 1: Entry Screen (Empty State)

### Dimensions
- Desktop: 1440 × 900px
- Mobile: 375 × 812px (show mobile version too)

### Layout
```
┌─────────────────────────────────────────────────────┐
│  [Logo] UpSight                        [Settings]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│              [Centered vertically]                  │
│                                                     │
│   "What do you want to learn about                  │
│    your customers?"                                 │
│   (Inter, 32px, 600 weight, gray-900)              │
│                                                     │
│   ┌──────────────────────────────────────────────┐ │
│   │                                              │ │
│   │  [🎤 Speak]           [⌨️ Type]              │ │
│   │  (Button, h-48)       (Button, h-48)         │ │
│   │  (w-200px)            (w-200px)              │ │
│   │                                              │ │
│   └──────────────────────────────────────────────┘ │
│                                                     │
│   💡 Examples:                                      │
│   (gray-500, 14px)                                 │
│                                                     │
│   • "I need to qualify enterprise deals"            │
│   • "Find product-market fit for our new feature"   │
│   • "Understand why customers churn"                │
│   (gray-600, 14px, leading-relaxed)                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Components
1. **Header** (h-16, border-b)
   - Logo (left, h-8)
   - Settings icon (right, size-6)

2. **Main Content** (centered, max-w-2xl)
   - Heading with gradient text effect (optional)
   - Two buttons side-by-side (gap-4)
   - Examples list with bullet points

3. **Button States**
   - Default: bg-white, border-gray-300
   - Hover: border-primary, scale-105
   - Active: bg-primary, text-white

### Interactions (annotate in Figma)
- Hover: Buttons scale slightly
- Click Voice: Opens voice permission dialog (show modal state)
- Click Type: Transitions to chat interface (next artboard)

---

## Artboard 2: Setup Wizard (BANT Lens)

### Dimensions
1440 × 900px

### Layout (Two-Pane)
```
┌──────────────────────────────────────────────────────┐
│  Let's set up BANT qualification            [×]      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ Chat (60%) ───────────┬─ Captured (40%) ─────┐ │
│  │                         │                       │ │
│  │ Agent Avatar            │  Research Goal ✓      │ │
│  │ "I'll help you qualify  │  ┌─────────────────┐  │ │
│  │ deals using BANT..."    │  │ Qualify         │  │ │
│  │                         │  │ enterprise      │  │ │
│  │ Step 1: Target Roles    │  │ deals           │  │ │
│  │                         │  └─────────────────┘  │ │
│  │ Who makes buying        │  (Card with shadow)   │ │
│  │ decisions?              │                       │ │
│  │                         │  Target Roles         │ │
│  │ Suggestions:            │  ┌─────────────────┐  │ │
│  │ [VP Engineering]        │  │ [VP Eng] [CTO]  │  │ │
│  │ [CTO] [CFO]             │  │ [+ Add...]      │  │ │
│  │ [VP Product] [CEO]      │  └─────────────────┘  │ │
│  │                         │  (Empty state)        │ │
│  │ [+ Add custom role]     │                       │ │
│  │                         │  Company Context      │ │
│  │                         │  (Not yet...)         │ │
│  │                         │                       │ │
│  │ [Continue →]            │  Progress: 1 of 3     │ │
│  │                         │  ████░░░░░░░░         │ │
│  └─────────────────────────┴───────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Components

1. **Chat Pane (Left)**
   - Agent message bubble (bg-gray-100, rounded-xl, p-4)
   - Avatar circle (size-10, bg-primary)
   - Suggestion chips (flex-wrap, gap-2)
     - Chip: bg-white, border, rounded-full, px-3, py-1.5
     - Hover: border-primary
   - Continue button (bg-primary, text-white, rounded-lg)

2. **Captured Pane (Right)**
   - Section headers (font-semibold, mb-2)
   - Field cards with checkmark (✓ green when filled)
   - Empty state text (text-gray-400, italic)
   - Progress bar at bottom

### States to Show
- **State A:** Research goal filled, roles empty
- **State B:** Both filled, context empty
- **State C:** All filled (ready to continue)

---

## Artboard 3: Voice Recording (Initial State)

### Dimensions
1440 × 900px

### Layout
```
┌──────────────────────────────────────────────────────┐
│  Recording: 00:00 / ∞                      [■ Stop]  │
├──────────────────────────────────────────────────────┤
│  Deal: Acme Corp                   [BANT Lens ▼]    │
│                                                      │
│  ┌─ Live Recording (60%) ──┬─ BANT Scorecard (40%)┐ │
│  │                          │                      │ │
│  │  [VoiceOrb Animation]    │  Budget              │ │
│  │  (Pulsing circle)        │  [─────────] 0%      │ │
│  │  (Size varies with       │                      │ │
│  │   audio input)           │  Authority           │ │
│  │                          │  [─────────] 0%      │ │
│  │  Status: Initializing... │                      │ │
│  │                          │  Need                │ │
│  │                          │  [─────────] 0%      │ │
│  │                          │                      │ │
│  │                          │  Timeline            │ │
│  │                          │  [─────────] 0%      │ │
│  │                          │                      │ │
│  │                          │  Overall: 0/100      │ │
│  │                          │  (Large, centered)   │ │
│  │                          │                      │ │
│  └──────────────────────────┴──────────────────────┘ │
│                                                      │
│  💡 Speak naturally. I'll extract BANT signals.      │
│  (Centered, gray-500)                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### VoiceOrb Design
- Center circle: 120px diameter
- Gradient: primary to secondary
- Pulse animation: scale 1.0 → 1.1 → 1.0 (1s loop)
- Audio reactive: Scale varies with volume

### BANT Scorecard (Empty State)
- Each metric: Label + progress bar
- Progress bar: h-2, bg-gray-200, rounded-full
- Fill: bg-primary (animated when updating)
- Percentage: Right-aligned, gray-600

---

## Artboard 4: Voice Recording (15s - First Evidence)

### Dimensions
1440 × 900px

### Layout
```
┌──────────────────────────────────────────────────────┐
│  Recording: 00:15 / ∞                      [■ Stop]  │
├──────────────────────────────────────────────────────┤
│  ┌─ Transcript ─────────────┬─ BANT Scorecard ────┐ │
│  │                          │                      │ │
│  │ [VoiceOrb - smaller]     │  Budget ← UPDATING   │ │
│  │                          │  ████░░░░░░ 40%      │ │
│  │ "The CTO said their      │  🎥 [0:08]           │ │
│  │ current tool costs       │  "costs $50K..."     │ │
│  │ $50K annually and        │  ← Click to play     │ │
│  │ they're frustrated       │                      │ │
│  │ with the reporting..."   │  Authority           │ │
│  │                          │  Analyzing...        │ │
│  │ ← Live text scrolls up   │  [spinner]           │ │
│  │                          │                      │ │
│  │                          │  Need                │ │
│  │                          │  [─────────]         │ │
│  │                          │                      │ │
│  │                          │  Timeline            │ │
│  │                          │  [─────────]         │ │
│  │                          │                      │ │
│  │                          │  Overall: 13/100     │ │
│  │                          │                      │ │
│  └──────────────────────────┴──────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Evidence Chip Design
- Small badge: bg-blue-50, border-blue-200, rounded
- Icon: 🎥 (video camera emoji)
- Timestamp: [0:08] in mono font
- Quote: Truncated with ellipsis
- Hover: Shows full quote tooltip

### Updating Animation
- Progress bar fills left-to-right (0.5s ease)
- Number increments with counting animation
- "UPDATING" label blinks (opacity 0.5 → 1.0)

---

## Artboard 5: Voice Recording (45s - Complete BANT)

### Dimensions
1440 × 900px

### Layout
```
┌──────────────────────────────────────────────────────┐
│  Recording: 00:45 / ∞                      [■ Stop]  │
├──────────────────────────────────────────────────────┤
│  ┌─ Transcript ─────────────┬─ BANT Scorecard ────┐ │
│  │ [Earlier messages        │                      │ │
│  │  scrolled up...]         │  Budget              │ │
│  │                          │  ████████░░ 80%      │ │
│  │ "...has final say on     │  🎥 [0:08] "$50K"    │ │
│  │ vendor selection. They   │  🎥 [0:42] "over"    │ │
│  │ need this in place by    │                      │ │
│  │ Q2, about 3 months."     │  Authority           │ │
│  │                          │  ██████████ 100% ✓   │ │
│  │ ← LATEST                 │  🎥 [0:23] "final"   │ │
│  │                          │                      │ │
│  │                          │  Need                │ │
│  │                          │  ██████░░░░ 60%      │ │
│  │                          │  🎥 [0:15] "frustr"  │ │
│  │                          │                      │ │
│  │                          │  Timeline            │ │
│  │                          │  ████████░░ 80%      │ │
│  │                          │  🎥 [0:41] "Q2"      │ │
│  │                          │                      │ │
│  │                          │  Overall: 80/100 🔥  │ │
│  │                          │  (Orange glow)       │ │
│  └──────────────────────────┴──────────────────────┘ │
│                                                      │
│  💡 Strong signals! This is a hot deal.              │
│  (Success message, green-600)                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Hot Deal Styling
- Overall score: text-orange-500, font-bold
- Glow effect: box-shadow with orange
- 🔥 emoji animates (slight rotation wiggle)
- Success message at bottom (bg-green-50, border-green-200)

---

## Artboard 6: Pipeline View (3 Deals - Cards)

### Dimensions
1440 × 900px

### Layout
```
┌──────────────────────────────────────────────────────┐
│  Your Pipeline (3 deals)                    [+ New]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🔥 Acme Corp                  BANT: 80/100     │ │
│  │ ──────────────────────────────────────────     │ │
│  │ Budget: High      Authority: CTO               │ │
│  │ Need: Validated   Timeline: Q2 (3 months)      │ │
│  │                                                │ │
│  │ Last activity: Just now                        │ │
│  │ Next: Schedule demo                            │ │
│  │                                                │ │
│  │ [View] [Schedule] [Share]                      │ │
│  │ (Buttons in row, gap-2)                        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ TechStart Inc                 BANT: 45/100     │ │
│  │ ──────────────────────────────────────────     │ │
│  │ Budget: Medium    Authority: Unknown           │ │
│  │ Need: Strong      Timeline: Not mentioned      │ │
│  │                                                │ │
│  │ Last activity: 1 day ago                       │ │
│  │ Next: Confirm authority & timeline             │ │
│  │                                                │ │
│  │ [View] [Follow up] [Share]                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [+ View 1 more deal]                                │
│  (Link, centered)                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Deal Card Design
- Border-l-4: Orange for hot (80+), gray for others
- Header: Deal name + score badge
- Grid layout for BANT metrics (2×2)
- Separator line (border-t, my-3)
- Actions row at bottom

### BANT Score Badge
- 80-100: bg-orange-100, text-orange-700, border-orange-300
- 50-79: bg-yellow-100, text-yellow-700
- 0-49: bg-gray-100, text-gray-700

---

## Artboard 7: Pipeline View (13 Deals - Matrix)

### Dimensions
1440 × 900px

### Layout
```
┌──────────────────────────────────────────────────────┐
│  Your Pipeline (13 deals)                   [+ New]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│         Low Authority       High Authority           │
│  High  ┌─────────────────┬─────────────────┐        │
│ Budget │  Warm (3)       │  Hot (4) 🔥     │        │
│        │  • TechStart    │  • Acme Corp    │        │
│        │  • DataCo       │  • BigEnt       │        │
│        │  • CloudInc     │  • FastScale    │        │
│        │                 │  • MegaCorp     │        │
│        │                 │  (Orange bg)    │        │
│        └─────────────────┴─────────────────┘        │
│  Low   ┌─────────────────┬─────────────────┐        │
│ Budget │  Cold (3)       │  Nurture (3)    │        │
│        │  • SmallCo      │  • MidMarket    │        │
│        │  • Startup1     │  • Growing      │        │
│        │  • Startup2     │  • Scaling      │        │
│        │  (Gray bg)      │  (Yellow bg)    │        │
│        └─────────────────┴─────────────────┘        │
│                                                      │
│  💬 Chief of Staff:                                  │
│  "4 hot deals need immediate attention. 3 cold      │
│   leads should be nurtured or disqualified."         │
│  (Card, bg-blue-50, border-blue-200)                │
│                                                      │
│  [Focus on hot] [Review cold] [Export]               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Matrix Cell Design
- Cells: Rounded cards with shadow
- Hot cell: bg-orange-50, border-orange-200
- Warm cell: bg-yellow-50, border-yellow-200
- Nurture cell: bg-blue-50, border-blue-200
- Cold cell: bg-gray-50, border-gray-200

- Deal names: Bullet list, truncated
- Count badge: Circle in top-right corner

### Chief of Staff Card
- Below matrix
- bg-blue-50, border-l-4 border-blue-500
- Avatar icon (robot/assistant)
- Message text with recommendations
- Action buttons row

---

## Artboard 8: Lens Switching (BANT → JTBD)

### Dimensions
1440 × 900px (split vertically for before/after)

### Left Half: BANT View
```
┌──────────────────────────────────┐
│  Acme Corp      [BANT Lens ▼]   │
├──────────────────────────────────┤
│  BANT Scorecard                  │
│  Budget:    ████████░░ 80%       │
│  Authority: ██████████ 100%      │
│  Need:      ██████░░░░ 60%       │
│  Timeline:  ████████░░ 80%       │
│  Overall: 80/100                 │
└──────────────────────────────────┘
```

### Right Half: JTBD View
```
┌──────────────────────────────────┐
│  Acme Corp      [JTBD Lens ▼]   │
├──────────────────────────────────┤
│  Jobs Canvas                     │
│                                  │
│  Job: Generate accurate reports  │
│  When: Sprint end / Monthly      │
│  Outcome: Decision support       │
│  Pain: High 🔴                   │
│  Current: [Competitor Tool]      │
│  Constraints:                    │
│  • Existing stack integration    │
│  • CTO buy-in required           │
│  • Q2 timeline                   │
│                                  │
└──────────────────────────────────┘
```

### Lens Dropdown
- Positioned top-right
- Shows available lenses:
  - BANT (Sales)
  - JTBD (Product)
  - Empathy Map (Research)
  - Problem-Solution (Discovery)

### Transition Annotation
- Arrow between halves: "Same data, different lens"
- Label: "Click to switch view"

---

## Interactions & Animations

### To Annotate in Figma

1. **Voice Orb**
   - Idle: Gentle pulse (1s)
   - Recording: Fast pulse (0.5s)
   - Processing: Spinner inside orb

2. **Progress Bars**
   - Fill animation: 0.5s ease-out
   - Increment: Counting number animation

3. **Evidence Chips**
   - Appear with slide-in from right
   - Hover: Scale 1.05, show tooltip

4. **Card Interactions**
   - Hover: Lift shadow (transform: translateY(-2px))
   - Click: Ripple effect

5. **Chief of Staff Message**
   - Type-in animation for text
   - Avatar bounces on appear

6. **Lens Switch**
   - Cross-fade between views (0.3s)
   - Scorecard → Canvas morphs

---

## Responsive (Mobile Artboards)

Create 3 mobile versions (375px width):

1. **Entry Screen** - Stacked buttons vertically
2. **Setup Wizard** - Tabbed interface (Chat | Captured tabs)
3. **Voice Recording** - Scorecard below transcript (scrollable)

---

## Export Settings

- Format: PNG @ 2x for high-res
- Also export as Figma prototype link (shareable)
- Include component library for reuse

---

## Design Notes

- Use consistent shadows: `shadow-sm`, `shadow-md`, `shadow-lg`
- All buttons: `transition-all duration-200`
- Cards: `border border-gray-200 rounded-lg p-4`
- Keep whitespace generous (breathing room)
- Evidence chips are clickable (cursor-pointer)
- BANT metrics use consistent color scale

---

## Prototype Flows

### Flow 1: Setup to Recording
1. Entry Screen → Type clicked
2. Setup Wizard → Roles selected → Continue
3. Voice Recording → Start recording

### Flow 2: Query Changes UI
1. Pipeline (3 cards) → User adds 10 more
2. Transition to Matrix view (same query)

### Flow 3: Lens Switch
1. BANT view → Click lens dropdown
2. Select JTBD → Cross-fade to Jobs Canvas

---

This spec provides everything needed to create polished Figma mockups.
Focus on: Clean layouts, smooth animations, evidence of AI intelligence.
