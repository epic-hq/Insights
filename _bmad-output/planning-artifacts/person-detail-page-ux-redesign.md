---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowComplete: true
inputDocuments:
  - docs/00-foundation/_information_architecture.md
  - docs/00-foundation/_lens-based-architecture-v2.md
  - docs/50-market/brand-brief.md
focusArea: Person Detail Page — Single-Scroll Redesign
relatedBead: Insights-hl8
---

# UX Design Specification: Person Detail Page Redesign

**Author:** Sally (UX Designer) + Team — Party Mode Session
**Date:** February 9, 2026
**Focus:** Person Detail Page — Single-Scroll, Insight-First Layout
**Bead:** Insights-hl8

---

## 1. Product Context

### 1.1 What We're Redesigning

The Person Detail Page (`/people/:personId`) — the primary page users visit to understand a specific person in their research/sales pipeline. Currently a tabbed layout with Overview, Profile, and Conversations tabs.

### 1.2 User Need Statement

> "When I open a person's page, I want to know in 2 seconds: is this a good prospect, what do they care about, and what should I do next. I don't want to click through tabs to find out if I even have data."

### 1.3 Brand Alignment

From the UpSight Brand Brief:
- **Core Promise:** "Build the right thing, faster"
- **Voice:** Direct, Confident, Grounded, Useful
- **Differentiator:** Every insight shows its receipts (traceable to source)
- **Visual:** Modern, clean, professional — not AI-hype flashy

### 1.4 Design Principles (This Feature)

1. **BLUF (Bottom Line Up Front)** — The most actionable information appears first, always
2. **Zero-Click Discovery** — Users see what data exists without clicking into anything
3. **Progressive Disclosure** — Details available on demand, never forced
4. **Every Pixel Earns Its Keep** — No wasted space on admin UI in the read path
5. **AI-Assisted, Human-Driven** — AI surfaces insights and suggestions; user decides and acts

---

## 2. Current State Analysis

### 2.1 Current Layout (Tabbed)

```
┌─────────────────────────────────────────────────┐
│ ← Back                              [Actions ▾] │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ DetailPageHeader                              │ │
│ │ [Avatar] Name (editable)      [Persona Badge] │ │
│ │          Title (editable)                      │ │
│ │          Organization link                     │ │
│ │          Function / Seniority badges           │ │
│ │                                                │ │
│ │ Organizations section                          │ │
│ │   [Org cards with trash buttons]               │ │
│ │   [+ Link Organization]                        │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [Overview] [Profile] [Conversations]             │
│                                                  │
│ (Tab content here...)                            │
└─────────────────────────────────────────────────┘
```

### 2.2 Problems Identified

| # | Problem | Impact |
|---|---------|--------|
| 1 | **ICP Match hidden in Profile tab** | Users can't quickly assess prospect quality |
| 2 | **No last contact date visible** | No urgency signal for follow-up |
| 3 | **Tab-based layout hides data existence** | Users click 3 tabs to discover what data exists |
| 4 | **Header bloat** — org management, trash buttons in prime real estate | Admin UI dominates the read experience |
| 5 | **No "next steps" or recommended actions** | Insight-to-action gap |
| 6 | **No activity counts at a glance** | Can't tell if person has 10 interviews or zero |
| 7 | **No voice input for quick updates** | Manual data entry friction |
| 8 | **Survey/conversation history requires tab switch** | Key engagement data buried |
| 9 | **Facet lenses accordion starts collapsed** | Rich AI data hidden behind clicks |

### 2.3 What Works (Keep)

- Key Takeaways (AI summary) — concept is right, just needs better placement
- Themes badges with evidence counts
- Facet lens summaries per kind — excellent when visible
- Inline editable fields — good for power users
- Unified evidence list in Conversations tab — good data model

---

## 3. Proposed Design: Single-Scroll with Anchor Navigation

### 3.1 Page Structure Overview

```
┌─────────────────────────────────────────────────┐
│ ← Back                                          │
│                                                  │
│ ═══════════════════════════════════════════════  │
│  SECTION 1: SCORECARD HERO                       │
│ ═══════════════════════════════════════════════  │
│                                                  │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  STICKY ANCHOR NAV (appears on scroll)           │
│  [Scorecard] [Insights] [Activity] [Profile]     │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                  │
│ ═══════════════════════════════════════════════  │
│  SECTION 2: INSIGHTS & NEXT STEPS                │
│ ═══════════════════════════════════════════════  │
│                                                  │
│ ═══════════════════════════════════════════════  │
│  SECTION 3: ACTIVITY TIMELINE                    │
│ ═══════════════════════════════════════════════  │
│                                                  │
│ ═══════════════════════════════════════════════  │
│  SECTION 4: PROFILE & ATTRIBUTES                 │
│ ═══════════════════════════════════════════════  │
│                                                  │
│ ═══════════════════════════════════════════════  │
│  SECTION 5: CONTACT                              │
│ ═══════════════════════════════════════════════  │
└─────────────────────────────────────────────────┘
```

---

### 3.2 Sticky Anchor Navigation

**Behavior:**
- Hidden initially (within the scorecard area)
- Becomes `position: sticky; top: 0` when the user scrolls past the scorecard
- Highlights the current section via Intersection Observer
- Smooth-scrolls to target section on click

**Visual:**
- Height: 48px
- Background: `bg-background/80 backdrop-blur-sm`
- Border: `border-b border-border/40`
- Pills: `text-sm font-medium` — active pill gets `bg-primary/10 text-primary` + underline indicator
- Mobile: horizontally scrollable with `overflow-x-auto`

**Implementation:**
```tsx
// New component: PersonDetailNav.tsx
// Uses IntersectionObserver to track which section is visible
// Renders horizontal pill nav with smooth scroll on click
const sections = [
  { id: "scorecard", label: "Overview" },
  { id: "insights", label: "Insights" },
  { id: "activity", label: "Activity" },
  { id: "profile", label: "Profile" },
  { id: "contact", label: "Contact" },
];
```

---

### 3.3 Section 1: Scorecard Hero

**Purpose:** Identity + prospect quality + engagement breadth in one dense block.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ ← Back                                                    │
│                                                            │
│  ┌────┐                                  ┌──────────────┐ │
│  │    │  Jane Smith                      │  ICP: Strong  │ │
│  │ AV │  VP of Product @ Acme Inc        │  Score: 87%   │ │
│  │    │  Product · Senior · SaaS         └──────────────┘ │
│  └────┘  Persona: Power User                              │
│                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │  📹 4   │ │  📋 2   │ │  📝 1   │ │  💬 0   │ Last: 3d  │
│  │ Convos  │ │ Surveys │ │ Notes  │ │ Chats  │    ago     │
│  └────────┘ └────────┘ └────────┘ └────────┘             │
│                                                            │
│  [🎙 Quick Update]  [📋 Send Survey]  [📝 Log Note]  [⋯]  │
└──────────────────────────────────────────────────────────┘
```

**Components & Behavior:**

| Element | Source | Notes |
|---------|--------|-------|
| Avatar | `person.image_url` | Existing `Avatar` component, 64x64, persona-colored border |
| Name | `person.firstname + lastname` | Existing `EditableNameField`, `text-2xl font-bold` |
| Title @ Org | `person.title`, `primaryOrg.name` | Inline text, org is a link. `text-sm text-muted-foreground` |
| Identity line | `job_function · seniority_level · industry` | Inline text separated by `·`, not badges. Denser. |
| Persona badge | `persona.name` | Small colored pill, links to persona detail |
| ICP Badge | `personScale.icp_match` | Color-coded card: Green (Strong), Amber (Moderate), Red (Weak), Gray (Unscored). Shows band + percentage |
| Activity Stats | Derived from `allInterviewLinks` | 4 compact stat cards. Count by source type. Zero-count cards use ghost/muted style. |
| Last Contact | `Math.max(...interview dates)` | Relative time via `formatDistance()`. Highlighted if > 14 days ("Overdue" amber badge) |
| Quick Actions | New action buttons | Primary: Quick Update (mic), Send Survey, Log Note. Overflow: Edit, Refresh Description, Attach Recording, Delete |

**Activity Stat Chips:**
```tsx
// Each chip: icon + count + label
// Ghost variant when count === 0 (muted-foreground/30)
// Solid variant when count > 0
<div className="flex gap-2">
  <StatChip icon="📹" count={interviewCount} label="Convos" />
  <StatChip icon="📋" count={surveyCount} label="Surveys" />
  <StatChip icon="📝" count={noteCount} label="Notes" />
  <StatChip icon="💬" count={chatCount} label="Chats" />
</div>
```

**Quick Update Button (Phase 2):**
- Opens a slide-over or bottom sheet
- Activates microphone (existing dictation infrastructure)
- User speaks: "Just had a call with Jane, she's interested in the enterprise tier and wants a demo next week"
- AI parses into: description update, next step, log note
- User confirms → fields updated

---

### 3.4 Section 2: Insights & Next Steps

**Purpose:** Answer "Should I care?" and "What should I do?" in one scroll.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ✨ Insights                                   [Refresh] │
│                                                           │
│  "Jane is a high-value prospect with clear pain around   │
│   reporting workflows. She's expressed frustration with   │
│   data export limitations across 4 conversations. Her    │
│   engagement is strong and she aligns well with our ICP  │
│   criteria for the Enterprise segment."                  │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  🎯 Recommended Next Steps                                │
│  ┌─ Schedule follow-up call (last contact 3 days ago)    │
│  ├─ Share reporting automation case study                 │
│  └─ Review latest survey responses (2 new)               │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  🏷️ Themes                                                │
│  [Reporting Pain ·6] [Data Export ·4] [Manual Process ·3]│
│  [Workflow Friction ·2] [Enterprise Needs ·2]  +4 more   │
└──────────────────────────────────────────────────────────┘
```

**Components:**

| Element | Source | Notes |
|---------|--------|-------|
| AI Summary | `person.description` | Existing field. `text-foreground leading-relaxed`. White card with subtle border |
| Refresh button | Existing `refresh-description` action | Small ghost button, triggers fetcher |
| Next Steps | **Phase 1:** Heuristic-based. **Phase 2:** Mastra tool | See heuristic rules below |
| Themes | `personThemes` | Existing data. Badge pills with evidence counts. Top 6 shown, "+N more" toggle |

**Phase 1 Heuristic Next Steps:**
```
Rules (evaluated in priority order, show top 3):
1. If last_contact > 14 days → "Schedule follow-up (last contact X days ago)"
2. If survey_count === 0 → "Send a survey to gather structured feedback"
3. If survey_count > 0 && has_unreviewed → "Review latest survey responses"
4. If icp_match === null → "Run ICP scoring to assess prospect fit"
5. If conversation_count < 2 → "Schedule discovery call to deepen understanding"
6. If themes mention specific pain → "Share relevant case study"
7. Default → "Add notes from your last interaction"
```

**Related Insights (optional subsection):**
If `relatedInsights.length > 0`, show a compact row of 2-3 insight cards below themes. Not the full `InsightCardV3` — a slim version with title + one-line summary.

---

### 3.5 Section 3: Activity Timeline

**Purpose:** Unified chronological view of ALL interactions, replacing the Conversations tab.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  📋 Activity                                              │
│                                                           │
│  [All ·7] [Interviews ·4] [Surveys ·2] [Notes ·1]       │
│                                                           │
│  Feb 7                                                    │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 📹  Product Feedback Deep Dive              Interview ││
│  │     "Reporting is our biggest bottleneck..."          ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  Feb 3                                                    │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 📋  Q1 Customer Satisfaction Survey           Survey  ││
│  │     Satisfaction: 4/5 · Would recommend: Yes          ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  Jan 28                                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 📝  Call Notes — Enterprise Interest           Note   ││
│  │     "Interested in enterprise tier pricing..."        ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ─── Show 3 more ───                                     │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  📥 Imported Data                                         │
│  (Survey Q&A responses, research link responses)         │
│  [Expand to view →]                                      │
└──────────────────────────────────────────────────────────┘
```

**Components:**

| Element | Details |
|---------|---------|
| Filter pills | `ToggleGroup` with counts. Inline, not a separate toolbar. Active = filled, inactive = outline. Only show categories with count > 0 |
| Timeline items | Card-style rows. Icon + title + type badge + date. Optional one-line excerpt |
| Excerpt | Phase 1: interview title only. Phase 2: AI-generated one-line takeaway per conversation |
| Progressive disclosure | Show first 5 items. "Show N more" button. No pagination |
| Imported Data | Collapsible section at bottom. Contains survey Q&A and research link responses from existing `PersonEvidenceTab` data |
| Assets | If `relatedAssets.length > 0`, included in timeline with file icon |

**Sort:** Most recent first (default). No sort toggle needed — users expect recency.

---

### 3.6 Section 4: Profile & Attributes

**Purpose:** Detailed demographic, segment, and AI-extracted attribute data. Available but not prominent.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  👤 Profile                                               │
│                                                           │
│  Demographics                                    [Edit →] │
│  ┌────────────┬────────────┬────────────┬──────────────┐ │
│  │ Function   │ Seniority  │ Industry   │ Company Size │ │
│  │ Product    │ VP         │ SaaS       │ 200-500      │ │
│  └────────────┴────────────┴────────────┴──────────────┘ │
│                                                           │
│  Attribute Lenses                            [Expand all] │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 💔 Pain — "Reporting bottlenecks, manual exports,   │ │
│  │           data reconciliation challenges..."         │ │
│  │ 🎯 Goals — "Automate reporting, reduce manual work, │ │
│  │           improve data accuracy..."                  │ │
│  │ ⚙️ Workflow — "Spreadsheet-heavy, weekly cadence,   │ │
│  │             cross-team coordination..."              │ │
│  └──────────────────────────────────────────────────────┘ │
│  (Click any lens to expand signals + manage)             │
│                                                           │
│  Organizations                              [Manage →]   │
│  Acme Inc · VP of Product (Primary)                      │
│  Beta Corp · Advisor                                     │
└──────────────────────────────────────────────────────────┘
```

**Key Changes from Current:**
1. **Demographics are read-only by default.** "Edit" button toggles inline editable mode. No dropdowns showing on every page load.
2. **Attribute lenses show summaries inline.** Each lens shows the AI summary as a compact one-liner. Click to expand into the full accordion with individual signals.
3. **Organizations are compact.** One line per org with role. "Manage" opens the existing `LinkOrganizationDialog`. No trash buttons in the read view.

---

### 3.7 Section 5: Contact

**Purpose:** Contact information in the most compact possible form.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  📬 Contact                                     [Edit →]  │
│                                                           │
│  ✉️ jane@acme.com  ·  📞 (555) 123-4567  ·  🔗 in/jane  │
│                                                           │
│  (Expanded on Edit: editable fields for email, phone,    │
│   LinkedIn, plus JSONB contact methods)                  │
└──────────────────────────────────────────────────────────┘
```

**Key Changes:**
- Single row of contact methods with icons. Clickable (mailto:, tel:, external link).
- "Edit" expands to the full editable form (existing `InlineEditableField` components).
- Additional JSONB contact methods (Twitter, Instagram, etc.) shown when expanded.

---

## 4. Interaction Patterns

### 4.1 Quick Update (Voice Input) — Phase 2

**Flow:**
1. User clicks "Quick Update" button (mic icon)
2. Slide-over panel opens from the right (or bottom sheet on mobile)
3. Two input modes: Voice (default) or Text
4. User speaks or types their update
5. AI parses the input and shows a preview:
   ```
   Understood. I'll update:
   ☐ Add note: "Interested in enterprise tier, wants demo next week"
   ☐ Set next step: "Schedule demo — target: next week"
   ☐ Update description with new context
   [Apply] [Edit] [Cancel]
   ```
6. User confirms → API calls update the person record
7. Page revalidates and shows updated data

**Technical:** Uses existing dictation infrastructure. New Mastra tool for parsing voice input into structured updates. Falls back to simple note creation if parsing fails.

### 4.2 Send Survey Action

- Opens a dialog/sheet to select an existing research link or create a new one
- Pre-fills the person's email
- On send, creates the research link response record

### 4.3 Log Note Action

- Navigates to interview upload page with `?personId=<id>&type=note`
- Alternatively: inline quick-note input (text field that submits as a voice_memo/note type)

### 4.4 Scroll Spy Behavior

```
Scroll position → Active anchor
─────────────────────────────────
Top of page      → "Overview" (scorecard)
Past scorecard   → Sticky nav appears
Insights visible → "Insights" active
Activity visible → "Activity" active
Profile visible  → "Profile" active
Contact visible  → "Contact" active
```

Implementation: `IntersectionObserver` with `rootMargin: "-100px 0px -66% 0px"` to activate when a section is in the upper third of the viewport.

---

## 5. Visual Design

### 5.1 Color & Typography

Following the existing design system (Tailwind + shadcn/ui):

- **Page background:** `bg-background` (not `bg-muted/20` — cleaner)
- **Section cards:** `bg-card border border-border/60 rounded-xl shadow-sm`
- **Headings:** `text-lg font-semibold text-foreground` with icon
- **Body text:** `text-sm text-foreground leading-relaxed`
- **Muted labels:** `text-xs text-muted-foreground uppercase tracking-wide`
- **ICP Badge colors:**
  - Strong: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - Moderate: `bg-amber-50 text-amber-700 border-amber-200`
  - Weak: `bg-rose-50 text-rose-700 border-rose-200`
  - Unscored: `bg-muted text-muted-foreground`

### 5.2 Spacing

- **Between sections:** `space-y-8` (32px)
- **Within sections:** `space-y-4` (16px)
- **Page padding:** `px-4 md:px-8 lg:px-12`
- **Max content width:** `max-w-4xl mx-auto` for the main column
- **Scorecard:** full width of content area, no card wrapper

### 5.3 Dark Mode

All colors use semantic tokens (`text-foreground`, `bg-card`, etc.) which already support dark mode. ICP badge colors should use dark mode variants:
- Strong: `dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800`
- Moderate: `dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800`
- Weak: `dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800`

### 5.4 Responsive

| Breakpoint | Behavior |
|------------|----------|
| Mobile (<640px) | Scorecard stacks vertically. ICP badge below name. Stat chips in 2x2 grid. Anchor nav scrolls horizontally. Quick actions stack. |
| Tablet (640-1024px) | Scorecard side-by-side. Stat chips in a row. All sections full width. |
| Desktop (>1024px) | Full layout as designed. Max-width container. |

---

## 6. Component Architecture

### 6.1 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PersonDetailNav` | `app/features/people/components/PersonDetailNav.tsx` | Sticky anchor navigation with scroll spy |
| `PersonScorecard` | `app/features/people/components/PersonScorecard.tsx` | Hero section with identity, ICP, stats, actions |
| `PersonInsights` | `app/features/people/components/PersonInsights.tsx` | AI summary + next steps + themes (replaces PersonOverviewTab) |
| `PersonActivityTimeline` | `app/features/people/components/PersonActivityTimeline.tsx` | Unified activity stream (replaces PersonEvidenceTab) |
| `PersonProfileSection` | `app/features/people/components/PersonProfileSection.tsx` | Demographics + attribute lenses + orgs (replaces PersonProfileTab) |
| `PersonContactSection` | `app/features/people/components/PersonContactSection.tsx` | Compact contact display with edit toggle |
| `StatChip` | `app/components/ui/stat-chip.tsx` | Reusable count chip (icon + number + label) |
| `IcpBadge` | `app/components/ui/icp-badge.tsx` | Color-coded ICP match display |
| `QuickUpdateSheet` | `app/features/people/components/QuickUpdateSheet.tsx` | Voice/text input panel (Phase 2) |

### 6.2 Modified Components

| Component | Changes |
|-----------|---------|
| `detail.tsx` | Remove `Tabs` wrapper. Render sections sequentially. Add anchor IDs. Remove `DetailPageHeader` usage. |
| `DetailPageHeader` | No changes needed — remains available for other pages (orgs, personas). Person detail just stops using it. |

### 6.3 Removed Components (from this page)

| Component | Replacement |
|-----------|-------------|
| `PersonOverviewTab` | `PersonInsights` |
| `PersonProfileTab` | `PersonProfileSection` |
| `PersonEvidenceTab` | `PersonActivityTimeline` |
| Tab navigation | `PersonDetailNav` (anchor scroll) |

Note: The old tab components are NOT deleted — they may be useful elsewhere or as reference. They are simply no longer rendered in `detail.tsx`.

---

## 7. Data Requirements

### 7.1 Loader Changes

**No new database queries needed.** The current loader already fetches all required data:

| Data | Current Loader Field | Used In |
|------|---------------------|---------|
| Person with facets | `person` | Scorecard, Profile |
| ICP Match | `personScale` (via person) | Scorecard ICP badge |
| Themes | `personThemes` | Insights section |
| Insights | via `interviewLinks → insights` | Insights section |
| All conversations | `allInterviewLinks` (split by type) | Activity Timeline, Stat chips |
| Survey responses | `surveyResponses` | Activity Timeline imported data |
| Research responses | `researchLinkResponses` | Activity Timeline |
| Related assets | `relatedAssets` | Activity Timeline |
| Organizations | via `person.people_organizations` | Scorecard, Profile |
| Facet catalog | `catalog` | Profile section |
| Facet summaries | `person.person_facet_summaries` | Profile section |

**New derived values (client-side only):**

| Value | Derivation |
|-------|------------|
| `lastContactDate` | `Math.max(...allInterviewLinks.map(l => l.interviews?.created_at))` |
| `interviewCount` | `interviewLinks.length` |
| `surveyCount` | `surveyLinks.length` |
| `noteCount` | `noteLinks.length` |
| `chatCount` | `chatLinks.length` |
| `nextSteps` | Heuristic function based on counts, dates, ICP status |

---

## 8. Implementation Phases

### Phase 1: Layout Refactor (No New AI Calls)

**Scope:** Replace tabbed layout with single-scroll. All data already available.

**Tasks:**
1. Create `PersonDetailNav` component (sticky anchor nav with scroll spy)
2. Create `PersonScorecard` component (identity + ICP + stat chips + actions)
3. Create `PersonInsights` component (description + heuristic next steps + themes)
4. Create `PersonActivityTimeline` component (unified timeline replacing PersonEvidenceTab)
5. Create `PersonProfileSection` component (compact demographics + lenses + orgs)
6. Create `PersonContactSection` component (compact contact row)
7. Create shared `StatChip` and `IcpBadge` components
8. Refactor `detail.tsx` to render sections sequentially instead of tabs
9. Add anchor IDs to each section for scroll navigation
10. Implement scroll spy with IntersectionObserver
11. Responsive layout adjustments

**Estimated effort:** 2-3 focused sessions

### Phase 2: AI-Powered Intelligence

**Scope:** Add AI-generated recommendations and voice input.

**Tasks:**
1. Create `generatePersonNextSteps` Mastra tool (recommends actions based on person data)
2. Create `QuickUpdateSheet` component (voice/text input panel)
3. Wire voice input to dictation infrastructure
4. Create `parseQuickUpdate` Mastra tool (extracts structured data from natural language)
5. Add AI-generated excerpts to activity timeline items
6. Add "overdue for follow-up" contextual alerts on last contact date

**Estimated effort:** 2-3 focused sessions

---

## 9. Acceptance Criteria

### Phase 1 (Layout Refactor)

- [ ] Person detail page renders as a single scrollable page (no tabs)
- [ ] Sticky anchor navigation appears when scrolling past the scorecard
- [ ] Clicking an anchor pill smooth-scrolls to the target section
- [ ] Active section is highlighted in the anchor nav via scroll spy
- [ ] Scorecard shows: name, title, org, job function, seniority, persona, ICP badge
- [ ] Activity stat chips show counts for conversations, surveys, notes, chats
- [ ] "Last contact: X ago" displayed with relative time
- [ ] AI summary (Key Takeaways) shown prominently in Insights section
- [ ] Heuristic-based "Recommended Next Steps" shown (3 items max)
- [ ] Themes displayed as clickable badge pills with evidence counts
- [ ] Unified Activity Timeline shows all source types chronologically
- [ ] Activity Timeline has inline filter pills with counts
- [ ] Activity Timeline shows first 5 items with "Show more" expander
- [ ] Profile section shows demographics as read-only with "Edit" toggle
- [ ] Attribute lenses show summaries inline with expand-to-details
- [ ] Organizations shown compactly with "Manage" link
- [ ] Contact info shown in one compact row with "Edit" toggle
- [ ] Responsive layout works on mobile, tablet, and desktop
- [ ] Dark mode works correctly for all new components
- [ ] All existing functionality preserved (edit, delete, refresh, link org, etc.)
- [ ] No regressions in existing behavior

### Phase 2 (AI Intelligence)

- [ ] "Quick Update" button opens voice/text input panel
- [ ] Voice input activates microphone and captures speech
- [ ] AI parses voice input into structured update preview
- [ ] User can confirm, edit, or cancel parsed updates
- [ ] Recommended Next Steps generated by AI Mastra tool
- [ ] Activity timeline items show AI-generated one-line excerpts
- [ ] Last contact date shows "Overdue" alert if > 14 days

---

## 10. Out of Scope

- Redesign of other detail pages (organizations, personas) — separate effort
- New database schema changes — all data already exists
- Real-time updates / WebSocket integration
- Mobile native app considerations
- Analytics / event tracking for the new layout
- A/B testing infrastructure
