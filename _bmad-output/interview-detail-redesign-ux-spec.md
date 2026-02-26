# Interview Detail Page — UX Redesign Spec

**Author:** Sally (UX Designer)
**Date:** 2026-02-24
**Status:** Draft — Pending Rick's approval

---

## 1. Problem Statement

The current Interview Detail page is overwhelming. It displays Key Insights, Recommendations, Open Questions, Conversation Lenses, Chapters, Evidence (148+), a media player, transcript, and tasks — all competing for attention in a single view. Users don't know what to do first, so they often defer review entirely.

### User Story

> *Mona just finished a 65-minute customer interview. She opens UpSight to review it. She needs to: (1) confirm what mattered, (2) agree on next steps, and (3) eventually connect these insights to patterns across other interviews. But the page throws everything at her at once. She closes the tab.*

---

## 2. Design Philosophy

**This page is the summary layer, not the detail layer.**

The user reviews AI-generated takeaways, verifies them against source material, captures next steps, then navigates to dedicated pages (Evidence, Insights) for deeper analysis.

### Core User Jobs (in order)

1. **Review** — Scan the top takeaways from this conversation
2. **Verify** — Challenge any claim by jumping to source evidence or transcript
3. **Act** — Confirm tasks/next steps, create new ones
4. **Connect** — Link findings to cross-interview themes and insights

### Guiding Principle

> Lenses are the killer feature. "Key Insights" is just one lens (`conversation-overview`). All lenses render in the same viewport with the same interaction pattern. One mental model.

---

## 3. Page Layout

Two-column layout. Left column is the **analysis workspace**. Right column is **source material**.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back                                           Share Edit │
│  Mona Fendereski · Dec 26, 2025                              │
│  Rick Moy, Mona Fendereski · 65m · 148 evidence → · 5 themes → │
├────────────────────────────────┬─────────────────────────────┤
│  LEFT: Analysis Workspace      │  RIGHT: Source Material      │
│                                │                              │
│  Tab bar:                      │  Tab bar:                    │
│  [Overview] [Lenses▾] [Notes]  │  [Media] [Transcript]        │
│                                │                              │
│  (content swaps per tab)       │  Chapters (always visible,   │
│                                │   collapsed)                 │
│                                │                              │
│  Tasks section (persistent,    │                              │
│  always visible below tabs)    │                              │
└────────────────────────────────┴─────────────────────────────┘
```

### 3.1 Header (Simplified)

Remove the heavy `InterviewScorecard` card. Replace with lightweight inline metadata:

| Element | Treatment |
|---------|-----------|
| Title | `h1` — Interview name or primary participant + date |
| Participants | Inline linked names (click → person profile) |
| Metadata | Duration · Evidence count (link → Evidence page) · Theme count (link → Insights page) · Processing status |
| Actions | Share, Edit, Actions dropdown (top-right) |

Header metadata links navigate to dedicated pages, pre-filtered by this interview:

| Metric | Links to |
|--------|----------|
| "148 evidence →" | `/a/:accountId/:projectId/evidence?interview_id={interviewId}` |
| "5 themes →" | `/a/:accountId/:projectId/insights/themes?interview_id={interviewId}` |

### 3.2 Left Column — Analysis Workspace

#### Tab Bar

| Tab | Content | Default? |
|-----|---------|----------|
| **Overview** | Key Takeaways + Recommendations (collapsed) + Open Questions (collapsed) | Yes |
| **Lenses ▾** | Dropdown to select any completed lens; renders via `GenericLensView` | No |
| **Notes** | Free-form notes (existing `InlineEdit` component) | No |

**Overview tab = the `conversation-overview` lens, rendered with a custom layout** (not GenericLensView). This is the existing behavior, just reframed.

**Lenses dropdown** lists all completed lenses by name. Selecting one swaps the left column content to that lens's structured view. Incomplete/pending lenses show in the dropdown as disabled with a "Processing..." label. An "+ Run new lens" option opens the existing `LensSelector`.

#### Key Takeaways (Overview tab)

Each takeaway card:

```
┌──────────────────────────────────────┐
│  HIGH   Mona seeks to analyze        │
│         interview data to refine     │
│         her pitch deck               │
│                                      │
│  📎 See source    🏷 Link to theme   │
└──────────────────────────────────────┘
```

- **Priority badge** — HIGH (red/warm), MEDIUM (amber), LOW (muted)
- **Summary text** — The AI-generated takeaway
- **"See source"** — Scrolls right column to the matching evidence or opens Evidence detail. **Every takeaway MUST have this link** (see Section 5.1 for the fix)
- **"Link to theme"** — Quick action to associate this takeaway's evidence with a theme (supports the "Connect" job)

#### Recommendations (Overview tab, collapsed by default)

Collapsible section below takeaways. Each recommendation shows:
- Category badge (e.g., `PARTICIPANT RECRUITMENT`)
- Recommendation text
- **"Create task →"** action button — one-click converts to a task

#### Open Questions (Overview tab, collapsed by default)

Collapsible section. Lower priority, informational.

#### Tasks Section (Persistent — always visible below tabs)

Tasks are **not a tab** — they're a persistent section below the tab content area. This ensures "Act" is always one glance away regardless of which tab is active.

```
── Tasks (3) ──────────────────────────
☐ Finalize interview question sets          @Rick
☐ Reach out to providers for referral
☐ Begin pilot interviews using the tool
                                    + Add task
```

- Shows tasks linked to this interview
- **"+ Add task"** — inline task creation (title + optional assignee)
- Tasks from AI recommendations appear here after user clicks "Create task →"
- Click task → navigates to task detail or opens inline edit
- Max 6 shown, "View all →" link if more

### 3.3 Right Column — Source Material (Sticky)

The right column is sticky and scrolls independently. It's the "proof" panel.

#### Tab Bar

| Tab | Content |
|-----|---------|
| **Media** | Video/audio player (default) |
| **Transcript** | Full speaker-attributed transcript |

#### Chapters (Always visible below tabs, not tabbed)

Chapters display below the media/transcript tab content. They are the timeline navigator.

| Property | Treatment |
|----------|-----------|
| Default state | **Collapsed** (chevron to expand) |
| Section shading | **None** — clean flat list |
| Subtitle | **Hidden** — show on hover only (tooltip) |
| Click behavior | Seeks media player to that timestamp |
| Count | Show "Chapters (25)" in the section header |

```
Chapters (25)                                    ▸
  ▸ Initial chat and form reliability...    0:18
  ▸ Layout preferences and sharing...       1:22
  ▸ Website autofill attempt and...         2:31
  ▸ Completing required fields and...       4:10
  ▸ Recruiting interviewees and...          7:59
  [Show more...]
```

#### Evidence — Linked Out, Not Embedded

**Remove the inline evidence list from this page.** Instead:

- The header metadata shows "148 evidence →" as a link to:
  `/a/:accountId/:projectId/evidence?interview_id={interviewId}`
- "See source" links on takeaways navigate to the Evidence page with the specific evidence highlighted, or open the existing `EvidenceVerificationDrawer` inline
- The Evidence page already supports `?interview_id` filtering with a badge UI

This is the biggest simplification. Evidence browsing belongs on the Evidence page — it already has search, semantic search, facet filters, starring, voting, and sorting. Don't rebuild that here.

#### Transcript Tab

- Lazy-loaded (existing behavior via `LazyTranscriptResults`)
- Speaker-attributed utterances with timestamps
- Speaker names resolved from participants
- Click timestamp → seeks media player
- Copy transcript button
- Topics sub-tab if IAB data available

---

## 4. Interaction Flows

### 4.1 Review Flow (Primary)

```
User lands on page
  → Sees Overview tab (Key Takeaways)
  → Scans HIGH/MEDIUM priorities
  → Clicks "See source" on a takeaway
  → Right column scrolls to evidence OR drawer opens
  → User verifies/challenges the claim
  → Clicks ✓ (agree) or ✗ (disagree) on evidence
  → Returns to next takeaway
```

### 4.2 Action Flow

```
User reviews takeaways
  → Scrolls to Tasks section (always visible)
  → Sees AI-suggested tasks from Recommendations
  → Clicks "Create task →" on a recommendation
  → Task appears in Tasks section
  → Clicks "+ Add task" for manual task
  → Types title, optionally assigns
  → Done — next steps captured
```

### 4.3 Connect Flow

```
User wants to see patterns from this interview
  → Clicks "5 themes →" in header
  → Navigates to Insights page, filtered by interview_id
  → Sees only themes this interview contributed evidence to
  → Can clear filter to see all themes across project
```

Alternatively, from a takeaway:
```
User sees a key takeaway
  → Clicks "Link to theme"
  → Theme picker appears (existing themes + "Create new")
  → Selects theme → evidence linked
  → Theme count in header updates
```

### 4.4 Deep Dive Flow

```
User wants to explore all evidence from this interview
  → Clicks "148 evidence →" in header
  → Navigates to Evidence page, pre-filtered by interview_id
  → Full search, filter, sort capabilities available
  → Can navigate back to interview detail via breadcrumb
```

---

## 5. Technical Notes & Fixes

### 5.1 Fix: All Insights Must Have Source Links

**Problem:** Some takeaways lack "See source" links because:
- `supportingEvidenceIds` is empty on older interviews (pre-schema update)
- Fuzzy text matching in `matchTakeawaysToEvidence()` fails when AI paraphrasing diverges from stored verbatim

**Fix (two-part):**
1. **Improve fuzzy matching** — Lower the score threshold or use token overlap (Jaccard similarity) instead of substring inclusion. Consider matching against `gist` field as well as `verbatim`.
2. **Backfill** — For interviews where `supportingEvidenceIds` is empty, re-run the `conversation-overview` lens (which now populates IDs) via a migration script or background task.
3. **Fallback UI** — If after matching an insight still has no evidence link, show a muted "No source found" with a "Re-analyze" button that re-runs the overview lens.

### 5.2 Evidence Page Linking

The Evidence page already supports these query params:
- `?interview_id=xxx` — filters to interview, shows badge
- `?starred=true`, `?upvoted=true`, `?confidence=high|medium|low`
- `?facet_kind=goal|gain|pain`
- `?sort_by=created_at&sort_dir=desc`

No new backend work needed for the basic interview-scoped evidence link.

### 5.3 Insights Page — Add `?interview_id` Filter

The Insights (Themes) page does not currently support `?interview_id` filtering, but adding it is trivial. The data path already exists:

**Data path:** `themes → theme_evidence → evidence.interview_id`

The `getInsights()` DB function already fetches `theme_evidence` joined with `evidence(interview_id)` and builds a `themeInterviewsMap` per theme. The filter is a simple post-query step:

1. **Loader change** (`themes.tsx`): Read `?interview_id` from searchParams
2. **Filter step**: After building `themeInterviewsMap`, filter `themesWithSignal` to only themes whose `themeInterviewsMap` includes the target `interview_id`
3. **UI badge**: Show "Interview: {title}" filter badge (same pattern as Evidence page)
4. **Clear filter**: "×" button on badge to remove filter and show all themes

This enables the "See themes from this interview →" link in the interview detail header, completing the cross-page navigation story:

| Link in header | Destination |
|---|---|
| "148 evidence →" | `/evidence?interview_id={id}` (already works) |
| "5 themes →" | `/insights/themes?interview_id={id}` (new, trivial) |

### 5.4 Task Creation

Currently the interview detail page has no task creation UI. This spec requires:
- An inline "Add task" form in the Tasks section (title + assignee)
- A "Create task →" action on Recommendation cards that pre-fills the task title
- Both create a `task` row and a `task_links` row (`entity_type='interview'`, `entity_id={interviewId}`)

### 5.5 Component Changes Summary

| Component | Action |
|-----------|--------|
| `InterviewScorecard` | **Replace** with lightweight inline header |
| `InterviewInsights` | **Keep** — becomes the Overview tab content |
| `InterviewRecommendations` | **Keep** — moves inside Overview tab as collapsible |
| `LensAccordion` | **Replace** with lens dropdown/switcher + single `GenericLensView` |
| `InterviewSourcePanel` | **Refactor** — becomes tabbed (Media / Transcript), remove embedded evidence list |
| `InterviewChapters` | **Simplify** — collapsed default, no shading, hover-only subtitles |
| `LazyTranscriptResults` | **Move** into Source Panel as a tab |
| Evidence list (in source panel) | **Remove** — replaced by link to Evidence page |
| Tasks section | **New** — persistent section with inline creation |
| `EvidenceVerificationDrawer` | **Keep** — still used for "See source" deep-dive |

### 5.6 Architectural Cleanup Opportunities

- Split `detail.tsx` (2,033 lines) into separate loader, action, and component files
- Remove legacy `salesLens` loading (dead code)
- Deduplicate `getEvidenceSpeakerNames` and `deriveMediaFormat`
- Fix `shouldRevalidate` (currently always returns `true`)

---

## 6. What's Out of Scope

| Item | Reason |
|------|--------|
| Empathy Map visualization | It's a lens — accessible via the Lenses dropdown |
| Evidence inline list | Linked out to Evidence page |
| Scorecard/hero card | Replaced by lightweight header |
| Full evidence voting/search on this page | That's the Evidence page's job |
| Full Insights page redesign | Only adding `?interview_id` filter; no other Insights page changes |

---

## 7. Success Criteria

1. **Time to first action** — User can identify top takeaway and verify it within 30 seconds of landing
2. **Task capture rate** — Users create/confirm at least one task per interview review session
3. **Reduced bounce** — Users no longer leave the page without reviewing (measured by scroll depth + time on page)
4. **Evidence link coverage** — 95%+ of takeaways have a working "See source" link after fix
5. **Cognitive load** — Page shows max 3 sections on initial render (header, takeaways, tasks) vs current 7+
