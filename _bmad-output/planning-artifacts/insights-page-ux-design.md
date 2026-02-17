# Insights Page Evolution: UX Design Specification

> **Status**: Approved v2 (2026-02-16)
> **Bead**: Insights-vmz8
> **Depends on**: Analysis doc `insights-page-evolution-analysis.md`
> **Next Step**: Implementation spec → build Phase A

---

## 1. Design Principles

1. **Story, not spreadsheet.** Page reads top-to-bottom like a brief.
2. **Progressive disclosure.** Show the answer first, evidence second, details on demand.
3. **Same skeleton, different flesh.** Both lenses share the 4-layer structure.
4. **Action proximity.** Every insight has its "so what?" within arm's reach.
5. **Complementary, not competing.** Stakeholder perspectives are puzzle pieces, not battle positions.

---

## 2. Page Structure: Shared Skeleton

Both lenses live inside this structure:

```
HEADER          — Title, stats badges, actions dropdown, settings
LENS TOGGLE     — [ By Theme ] [ By Stakeholder ]
─────────────────────────────────────────────────
LAYER 1         — HEADLINE: the top-line story
LAYER 2         — EVIDENCE: ranked/organized supporting material
LAYER 3         — GAPS: what's missing or surprising
LAYER 4         — ACTIONS: suggested next steps
```

---

## 3. Lens Toggle

**Component**: Repurposed `ToggleGroup type="single"` (shadcn)
**Position**: Below page title, left-aligned
**Icons**: `Tags` (By Theme), `Users` (By Stakeholder) from lucide-react
**Default**: "By Theme"
**URL**: `/insights/themes` and `/insights/stakeholders` (route-driven, React Router outlets)
**Persistence**: localStorage remembers last selection

Phase A: "By Stakeholder" toggle visible but disabled with "Coming soon" tooltip.
Phase B: Fully enabled.

**Cards/Table sub-toggle**: Preserved as secondary control within Layer 2 of "By Theme" lens only.

---

## 4. Lens 1: "By Theme"

### Layer 1 — Signal Summary (Headline)

Replaces current treemap. Shows top 3 themes by signal strength with trend direction.

**Layout**: Single card, 3 rows, compact.

```
📊 Signal Summary                              12 conversations

🔴  Onboarding confusion                              ↑ Growing
    9 people · 28 evidence · 5 sources       [■■■■■■■■■□□□] 9/12
    "Users consistently struggle with initial setup..."

🟡  Pricing clarity                                    ↑ Growing
    7 people · 18 evidence · 3 sources       [■■■■■■■□□□□□] 7/12
    "Enterprise prospects find pricing page confusing..."

🟢  Slack integration requests                         → Stable
    6 people · 14 evidence · 4 sources       [■■■■■■□□□□□□] 6/12
    "Consistent demand, not accelerating"
```

**Behavior**:
- Color-coded confidence: 🔴 High/urgent, 🟡 Investigate, 🟢 Monitor
- Trend arrows: ↑ Growing, → Stable, ↓ Fading (Phase A: based on evidence count delta over last 30 days; Phase C: proper temporal scoring)
- **Breadth grid**: GitHub-style activity dot grid showing person coverage per theme (e.g., 9/12 filled squares). Filled squares use the theme's signal color (red/yellow/green), empty squares are muted gray. Each square represents one person in the project.
- One-line AI-generated summary per theme (from existing theme `statement` field)
- Clicking any row scrolls to its card in Layer 2
- Stats in header: total conversation count

**Component**: `SignalSummary` — new component, uses shadcn `Card`.

**Phase A simplification**: Signal strength = evidence count × person diversity. Color thresholds: top 33% = red, middle = yellow, bottom = green. Trend = compare evidence added in last 14 days vs prior 14 days.

---

### Layer 2 — Theme Cards (Evidence)

Evolved version of current card view. Richer but scannable.

**Layout**: 2-column grid (`md:grid-cols-2 gap-6`), with Cards/Table sub-toggle.

**Each theme card contains**:

```
┌─────────────────────────────────┐
│  Onboarding Confusion           │
│  🔴 High Signal  ↑ Growing     │
│                                 │
│  👤 9  📎 28  💬 5 sources     │
│  [■■■■■■■■■□□□] 9/12           │
│                                 │
│  Top voices:                    │
│  • Sarah K. (CTO)              │
│  • Mike R. (Eng Lead)          │
│                                 │
│  "Users consistently report     │
│   confusion during initial..."  │
│                                 │
│  [View Evidence]                │
│  [Create Task]  [Send Survey]   │
└─────────────────────────────────┘
```

**Card fields**:
- Theme name (h3, linked to detail page)
- Signal badge: color + label (High Signal / Investigate / Monitor)
- Trend arrow
- Stats row: person count, evidence count, source count (interviews/surveys)
- **Mini breadth grid**: Compact version of the Signal Summary breadth grid. Filled squares colored by signal level, empty squares muted. Shows person coverage at a glance (e.g., 9/12).
- Top voices: 2 most-cited people with name + title (humanizes the data)
- Representative quote (strongest evidence `verbatim` or `gist`)
- Actions: View Evidence (navigates to theme detail), Create Task, Send Survey

**Sort options**: Signal Strength (default), Latest, Most People, Alphabetical
**Filter**: Search by theme name (existing pattern)

**Component**: `ThemeCard` — evolves from `InsightCardV2Clean`. Same grid wrapper `InsightCardGrid`.

**Table sub-view**: When toggled, falls back to improved version of current table with signal badge + trend columns added. Preserves existing facet breakdown columns.

---

### Layer 3 — Blind Spots & Weak Signals (Gaps)

New section. Draws attention to what's not being said.

**Layout**: Single card, two sub-sections.

**Sub-section 1: Weak Signals** (data-driven, ships Phase A)
- Themes with low evidence count BUT high seniority contributors or recent recency
- Each shows: theme name, why it's notable ("3 people, but all C-level"), actions
- Actions per item: `[Investigate]` (promotes in ranking) | `[Dismiss]` (hides)

**Sub-section 2: AI-Detected Gaps** (Phase C)
- AI-generated expected topics that haven't appeared
- Based on project type context fed to BAML prompt
- Actions per item: `[Add to Survey]` | `[Not Relevant]`

**Behavior**: Section collapses by default if no weak signals detected. Expandable.

**Component**: `GapsPanel` — uses shadcn `Card` with `Alert`-style interior rows.

---

### Layer 4 — Suggested Next Steps (Actions)

Aggregated cross-theme action recommendations.

**Layout**: Max 3 action cards + export CTA.

```
⚡ Suggested Next Steps

┌─────────────────────────────┐  High confidence · 9/12 mentioned
│  Fix onboarding flow        │  3 churned citing this
│  [Create Task →]            │
└─────────────────────────────┘

┌─────────────────────────────┐  Medium confidence · growing signal
│  Investigate pricing        │  7 enterprise prospects
│  [Run Follow-Up Survey →]   │
└─────────────────────────────┘

┌─────────────────────────────┐
│  📋 Share Discovery Brief   │
│  [Generate Shareable Link →]│
└─────────────────────────────┘
```

**Behavior**:
- Phase A: Actions derived from top themes (highest signal = "fix it", growing signal = "investigate")
- Phase C: AI-suggested actions with rationale
- Confidence badge per action
- Discovery Brief: generates shareable public link (read-only view of the page's headline + themes + gaps)

**Component**: `ActionsPanel` — simple card list with CTAs.

---

## 5. Lens 2: "By Stakeholder"

### Layer 1 — Stakeholder Landscape (Headline)

Bird's-eye view of who you've heard from.

**Layout**: Card with role clusters and shared concern callout.

```
👥 Stakeholder Landscape

   ENGINEERING (3)       FINANCE (2)
   ● ● ●                ● ●

   HR (2)                PRODUCT (1)
   ● ●                  ●

   ────────────────────────────────────────
   🔗 Shared concern: "Timeline pressure"
      Raised by 3 of 4 roles
```

**Behavior**:
- **Role labels prominent**: White/high-contrast text, `font-semibold`, uppercase or small-caps. Must be immediately scannable.
- No redundant "X people · Y roles" badge in header — the layout itself communicates this.
- Role labels with avatar dots (grouped by `job_function` or extracted title)
- At <15 people: dots are hoverable → show name + title tooltip
- At >15 people: dots become count badges ("12 people")
- Shared concern callout: theme with highest role breadth
- Clicking a dot scrolls to that person's card in Layer 2

**Component**: `StakeholderLandscape` — new component. Uses flex layout with role group containers.

---

### Layer 2 — Stakeholder Perspectives (Evidence)

Each person's top concerns, organized by role/function.

**Layout**: Full-width cards, grouped by role with section headers.

```
ENGINEERING
┌─────────────────────────────────────────────────────────┐
│  👤 Sarah Kim · CTO                        [Follow Up]  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐          │
│  │ Legacy    │ │ API      │ │ Team capacity  │          │
│  │ migration │ │ stability│ │                │          │
│  │ 📎 8     │ │ 📎 5     │ │ 📎 3           │          │
│  └──────────┘ └──────────┘ └────────────────┘          │
│  💬 "The migration risk is the single biggest..."       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  👤 David Park · Solutions Architect       [Follow Up]  │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘

FINANCE
┌─────────────────────────────────────────────────────────┐
│  👤 James Morton · CFO                     [Follow Up]  │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

**Stakeholder card fields**:
- Avatar + **Name as clickable link** to person detail page (`/people/:personId`) + Title (from person record)
- No separate theme count badge (redundant — pills are visible)
- Theme pills: up to 5 themes as `Badge` components, each showing theme name + evidence count. "+N more" overflow.
- Representative quote: strongest evidence from this person
- **Follow Up button**: Top-right of card, sole action button. Triggers survey dialog or schedule follow-up.

**Theme pills**:
- Clickable → same-page scroll to Layer 3 intersection chart highlighting that theme, then if user wants deeper info, links to theme detail page
- Shared indicator: if theme appears on 2+ people in the view, pill gets a small 🔗 icon or subtle border color to show it's an intersection theme

**Sort options**: By Role (default), Alphabetical, By Theme Count

**Scale behavior**:
- <15 people: Individual cards, listed by job_function/title. Full identity visible. Sub-groups within same function (CTO, architect, dev) all shown individually.
- 15-50 people: Role headers become collapsible accordions. Collapsed shows: "Engineering (12) — top concerns: API stability, Migration, Testing". Expand to see individuals.
- 50+ people: Role groups show aggregate view only by default. Expandable to individuals.

**Component**: `StakeholderCard` inside `StakeholderGroup` sections. Groups use collapsible `Collapsible` (shadcn) at >15 threshold.

---

### Layer 3 — Common Ground, Divergences & Blind Spots (Gaps)

The consulting gold — what connects perspectives, where they conflict, and what's missing.

**Layout**: Three sub-sections in a card.

**Sub-section 1: Common Ground** (themes raised across multiple roles)

```
🔗 Common Ground — themes shared across roles

Timeline pressure         ████████████  3/4 roles
                          Eng · Finance · Product

Risk tolerance            ████████      2/4 roles
                          Finance · HR

Resource constraints      ██████        2/4 roles
                          Eng · HR
```

**Behavior**:
- Horizontal bars showing role coverage, sorted by breadth (most roles first)
- Role labels below each bar
- Clickable → expands inline to show the specific quote from each role for that theme
- Bars are simple div widths (no charting library needed)

**Sub-section 2: Divergences** (where stakeholders actively conflict)

```
⚡ Divergences — where perspectives conflict

Migration approach
┌────────────────────────────────┬────────────────────────────────┐
│ Sarah Kim · CTO                │ James Morton · CFO             │
│ "We need to migrate everything │ "A phased approach over 18     │
│  to the new platform before    │  months would minimize risk    │
│  Q3 launch"                    │  to operations"                │
└────────────────────────────────┴────────────────────────────────┘
[Flag for Discussion]  [Dismiss]

Hiring timeline
┌────────────────────────────────┬────────────────────────────────┐
│ David Park · Solutions Arch    │ Lisa Chen · HR Director        │
│ "We need 3 senior engineers    │ "Current hiring freeze means   │
│  by end of Q2"                 │  no new headcount until Q4"    │
└────────────────────────────────┴────────────────────────────────┘
[Flag for Discussion]  [Dismiss]
```

**Behavior**:
- Side-by-side conflicting quotes from different stakeholders on the same topic
- Each divergence shows the specific people and their quoted positions
- Actions: `[Flag for Discussion]` (marks as needs resolution, feeds into Layer 4 actions) | `[Dismiss]` (hides — not a real conflict)
- Phase B: Data-driven detection based on sentiment/position on shared themes
- Phase C: AI-detected conflicts via BAML prompt

**Sub-section 3: Blind Spots** (expected concerns with no signal)

```
⚠️  End-user adoption readiness
    No stakeholder mentioned this. Common concern
    in digital transformation projects.
    [Add to Follow-Up Survey]  [Not Relevant]

⚠️  Change management ownership
    HR discussed training but not who owns the
    change process. Consider probing.
    [Add to Follow-Up Survey]  [Not Relevant]
```

**Behavior**:
- Phase B: Manual "add blind spot" button available
- Phase C: AI-generated via BAML prompt
- Actions: Add to Follow-Up Survey (creates survey question), Not Relevant (dismisses)

**Component**: `IntersectionChart` (bars) + `DivergenceCard` (side-by-side quotes) + `BlindSpotCard` (alerts), composed inside `GapsPanel` variant.

---

### Layer 4 — Next Steps (Actions)

```
⚡ Next Steps

┌──────────────────────────────┐
│  ⚡ Resolve: Migration        │  CTO and CFO diverge on approach
│     approach                 │  — schedule alignment session
│  [Create Task →]             │
└──────────────────────────────┘

┌──────────────────────────────┐
│  📩 Follow Up: End-user      │  Blind spot needs validation
│     adoption readiness       │
│  [Send Survey →]             │
└──────────────────────────────┘

┌──────────────────────────────┐
│  📋 Share Discovery Summary  │  Synthesizes all perspectives
│  [Generate Shareable Link →] │  into a shareable document
└──────────────────────────────┘

┌──────────────────────────────┐
│  🔗 Share Stakeholder Map    │  Send landscape view
│  [Copy Link →]               │  to client or team
└──────────────────────────────┘
```

**Behavior**:
- Actions are derived from Layers 1-3: flagged divergences → "Resolve" actions, blind spots → "Follow Up" surveys, common ground → shareable outputs
- **Discovery Summary** (shareable link): Public read-only page containing stakeholder landscape, top concerns (condensed), common ground, divergences, blind spots, and generated summary narrative.
- Phase B: Manual action creation
- Phase C: AI-suggested actions with rationale

**Component**: Reuses `ActionsPanel` with stakeholder-specific CTAs.

---

## 6. Cross-Lens Navigation

Both lenses are interconnected, not siloed.

| From | To | Trigger | Behavior |
|------|----|---------|----------|
| Stakeholder theme pill | Theme detail | Click pill | Same-page: switches to By Theme lens, scrolls to that theme card, highlights it briefly (2s amber glow) |
| Theme card "Top voices" person | Stakeholder card | Click person name | Same-page: switches to By Stakeholder lens, scrolls to that person's card, highlights it |
| Common Ground bar | Per-role quotes | Click bar | Expands inline to show the specific quote from each role for that theme |
| Stakeholder card person name | Person detail page | Click name | Standard navigation to `/people/:personId` |

**Highlight pattern**: When cross-navigating, target card gets a brief `ring-2 ring-amber-400` glow that fades after 2 seconds via CSS transition. Scroll uses `scrollIntoView({ behavior: 'smooth', block: 'center' })`.

---

## 7. Responsive Design

| Breakpoint | Lens Toggle | Theme Cards | Stakeholder Cards | Gaps |
|------------|-------------|-------------|-------------------|------|
| `lg+` (1024+) | Inline row | 2-col grid | Full-width stacked | Full-width |
| `md` (768-1023) | Inline row | 2-col grid | Full-width stacked | Full-width |
| `sm` (<768) | Full-width stack | Single column | Single column, pills wrap | Single column |

Stakeholder cards always full-width — need horizontal space for theme pills.

---

## 8. Empty & Loading States

### Empty State (No Themes Yet)
Keep existing `InsightsExplainerCard` pattern — guidance card explaining how to generate insights. Shown in place of Layers 1-4.

### Loading State
- Lens toggle: disabled during load
- Signal Summary: skeleton (3 rows with pulse animation)
- Cards: skeleton grid (standard shadcn skeleton pattern)
- Stakeholder cards: skeleton with avatar circle + pill shapes

### Partial Data States
- <3 themes: Signal Summary shows available themes (1 or 2), no gaps section
- No person data: "By Stakeholder" lens shows empty state: "Add people to your conversations to see stakeholder perspectives"
- No facets: Stakeholder cards show person names without theme pills, prompt to run analysis

---

## 9. Component Inventory

### New Components (Phase A)

| Component | Location | Complexity |
|-----------|----------|------------|
| `SignalSummary` | `features/insights/components/` | Low |
| `ThemeCard` | `features/insights/components/` | Medium (evolves InsightCardV2) |
| `BreadthGrid` | `features/insights/components/` | Low (shared by SignalSummary + ThemeCard) |
| `GapsPanel` | `features/insights/components/` | Low |
| `ActionsPanel` | `features/insights/components/` | Low |

### New Components (Phase B)

| Component | Location | Complexity |
|-----------|----------|------------|
| `StakeholderLandscape` | `features/insights/components/` | Medium |
| `StakeholderCard` | `features/insights/components/` | Medium |
| `StakeholderGroup` | `features/insights/components/` | Low |
| `IntersectionChart` | `features/insights/components/` | Low (renamed "Common Ground") |
| `DivergenceCard` | `features/insights/components/` | Medium (side-by-side quote layout) |
| `BlindSpotCard` | `features/insights/components/` | Low |

### Reused / Evolved

| Component | Change |
|-----------|--------|
| `ToggleGroup` | Repurposed for lens toggle |
| `Badge` | Extended with click + shared indicator |
| `Card` | Base for all new cards |
| `InsightCardGrid` | Reused for theme card layout |
| `Collapsible` | Used for stakeholder groups at >15 scale |

---

## 10. What Gets Killed

| Current Element | Replacement |
|-----------------|-------------|
| Treemap / Pie chart | Signal Summary (top 3 themes) |
| "UNCATEGORIZED (25)" flat list | Ranked theme cards with signal badges |
| Sparse facet columns in table | Preserved in table sub-view but not the primary experience |
| Cards/Table as top-level toggle | Lens toggle (By Theme / By Stakeholder) is primary; Cards/Table is secondary within By Theme |
| InsightsExplainerCard | Kept for empty state only |

---

## 11. Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Headline format | Top 3 themes (not single AI sentence) | Concrete, scannable, verifiable |
| Cross-lens navigation | Same-page scroll + highlight | Keeps context, feels fluid |
| Integration Brief format | Shareable link (public read-only view) | Collaboration tool, not just a report |
| Stakeholder grouping (<15) | Individual cards by job_function/title | Never collapse identity when it matters |
| Lens mechanism | Route-driven outlets | URL-shareable, bookmarkable |
| Breadth grid (v2) | GitHub-style activity dots on Signal Summary + Theme Cards | Visual person coverage differentiator, immediately conveys breadth |
| Stakeholder card actions (v2) | Name as link, Follow Up as sole action button | Reduced clutter — View Profile redundant with clickable name, theme count redundant with visible pills |
| Layer 3 structure (v2) | Three sections: Common Ground → Divergences → Blind Spots | Divergences are consulting gold — conflicts need explicit surfacing, not just intersections |
| Export naming (v2) | "Share Discovery Summary" (not "Generate Integration Brief") | More natural language, less jargon |

---

*UX Design by Sally (UX Designer) — 2026-02-16*
*v2 updates approved by Rick — 2026-02-16*
