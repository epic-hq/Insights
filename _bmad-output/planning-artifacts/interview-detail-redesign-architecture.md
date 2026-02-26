# Interview Detail Redesign — Architecture Decision Document

**Date:** 2026-02-24
**Input:** `_bmad-output/interview-detail-redesign-ux-spec.md`
**Status:** Ready for implementation

---

## 1. Scope & Goals

Refactor the Interview Detail page (`app/features/interviews/pages/detail.tsx`, 2033 lines) from a monolithic everything-page into a focused summary hub with cross-page navigation.

**What changes:**
- Replace scorecard with lightweight header
- Replace vertical section stack with tabbed Analysis Workspace (left) + tabbed Source Panel (right)
- Remove inline evidence list (link to Evidence page)
- Replace LensAccordion with lens dropdown switcher
- Add task creation UI
- Simplify chapters (collapsed, no shading, hover subtitles)
- Move transcript into Source Panel tab
- Add `?interview_id` filter to Insights/Themes page

**What doesn't change:**
- Loader/action data fetching (refactored but same queries)
- EvidenceVerificationDrawer (kept for "See source")
- ManagePeopleAssociations dialog
- Delete confirmation dialog
- Realtime subscription for processing status
- Note/Document type early returns

---

## 2. Architecture Decisions

### AD-1: Split detail.tsx into modules

**Current:** 2033-line monolith with loader, action, 10+ action intents, all state, and full render.

**Decision:** Split into:

| File | Responsibility |
|------|---------------|
| `pages/detail.tsx` | Slim orchestrator — imports loader/action, renders layout shell, coordinates tabs |
| `pages/detail.loader.ts` | `loader()` + `shouldRevalidate()` — all server data fetching |
| `pages/detail.action.ts` | `action()` — all form intents (participant CRUD, delete, field updates) |
| `components/InterviewDetailHeader.tsx` | **New** — lightweight header replacing InterviewScorecard |
| `components/AnalysisWorkspace.tsx` | **New** — left column tabs (Overview, Lenses, Notes) |
| `components/LensSwitcher.tsx` | **New** — dropdown to select a lens, replaces LensAccordion |
| `components/InterviewTasks.tsx` | **New** — persistent tasks section with inline creation |
| `components/InterviewSourcePanel.tsx` | **Refactored** — tabbed (Media / Transcript), no embedded evidence |
| `components/InterviewChapters.tsx` | **Simplified** — collapsed, no shading, hover subtitles |

**Why:** The monolith is unmaintainable. Module boundaries follow the UX spec's visual sections, making future changes localized.

### AD-2: Tabs via URL state (not React state)

**Decision:** Use `?tab=overview|notes` searchParam for left column tab state, and `?source=media|transcript` for right column.

**Why:**
- Deep-linkable (share a link that opens on a specific lens)
- Browser back/forward works naturally
- Lens selection via `?lens=sales-discovery` searchParam
- Default: `?tab=overview&source=media`

**Implementation:** `useSearchParams()` in the orchestrator, pass active tab as prop to AnalysisWorkspace and SourcePanel.

### AD-3: Evidence list removed, not hidden

**Decision:** Remove `PlayByPlayTimeline` and all evidence rendering from the interview detail page. Evidence is accessed via:
1. Header link: "148 evidence →" → `/evidence?interview_id={id}`
2. "See source" on takeaways → opens `EvidenceVerificationDrawer` (kept)

**Why:** The Evidence page already has search, semantic search, facet filters, voting, sorting. Duplicating it here adds complexity without value.

**Loader change:** Still fetch evidence for:
- `EvidenceVerificationDrawer` (needs full evidence list for navigation)
- `matchTakeawaysToEvidence()` (needs evidence IDs/verbatim for matching)
- `evidenceMap` for lens timestamp hydration
- Evidence count for header

But we can **reduce the evidence select** — we only need `id, verbatim, gist, anchors, start_ms, confidence, support, topic, evidence_people(people(name))`. No need for full rows.

### AD-4: LensAccordion → LensSwitcher dropdown

**Decision:** Replace the accordion (all lenses stacked vertically) with a dropdown selector that shows one lens at a time in the same viewport.

**Component:** `LensSwitcher` renders:
1. Dropdown trigger showing current lens name
2. Menu: completed lenses listed by display_order, pending lenses disabled with "Processing..." label, "+ Run new lens" at bottom
3. Below dropdown: `GenericLensView` for the selected lens, OR the custom Overview layout for `conversation-overview`

**Data flow:** Same `lensTemplates` + `lensAnalyses` from loader. The switcher just filters to the selected one.

### AD-5: Insights page `?interview_id` filter

**Decision:** Add query param filter to the Themes page loader.

**Implementation:**
1. In `themes.tsx` loader: read `url.searchParams.get("interview_id")`
2. After `getInsights()` returns and `themeInterviewsMap` is built, filter `themesWithSignal` to only themes where `themeInterviewsMap.get(theme.id)?.includes(filterInterviewId)`
3. Pass `filterInterviewId` and interview title to the component
4. Render a filter badge: `"Interview: {title}" ×` (same pattern as Evidence page)
5. "×" clears the param

**Why trivial:** The join `theme_evidence → evidence(interview_id)` already happens in `getInsights()`. We're just post-filtering.

### AD-6: Task creation on interview detail

**Decision:** Add inline task creation in the persistent Tasks section.

**Implementation:**
- "Add task" button reveals inline form (title input + submit)
- Submit POSTs to existing `/api/tasks/create` or a new action intent in `detail.action.ts`
- Creates: `tasks` row + `task_links` row (`entity_type='interview'`, `entity_id={interviewId}`)
- Revalidate after creation to show new task
- "Create task →" on Recommendations pre-fills the task title

### AD-7: Keep loader queries, optimize minimally

**Decision:** Keep the existing parallel query structure but:
1. **Remove** `loadInterviewSalesLens()` — dead code, sales lens display path not in render tree
2. **Remove** `salesLens` from loader return
3. **Remove** Mastra memory/assistant messages loading (not used in redesigned page)
4. **Slim evidence select** — only fetch fields needed for drawer + matching (not full rows)
5. Keep `shouldRevalidate` returning `true` for now (fix separately)

---

## 3. Implementation Phases

### Phase 1: File split + header (foundation)

1. Extract `loader()` → `detail.loader.ts`
2. Extract `action()` → `detail.action.ts`
3. Create `InterviewDetailHeader.tsx` replacing `InterviewScorecard`
   - Lightweight: title, participants as links, metadata row (duration, evidence count link, theme count link, status)
   - Actions: Share, Edit, dropdown menu
4. Wire up in slim `detail.tsx` orchestrator

**Test:** Page renders identically to before (minus scorecard visual changes). All actions still work.

### Phase 2: Left column — Analysis Workspace

1. Create `AnalysisWorkspace.tsx` with tab bar (Overview | Lenses | Notes)
2. Move `InterviewInsights` into Overview tab
3. Move `InterviewRecommendations` into Overview tab as collapsible
4. Create `LensSwitcher.tsx` — dropdown + single lens view
5. Move Notes `InlineEdit` into Notes tab
6. URL state for tab selection (`?tab=`)

**Test:** All lenses render correctly. Tab switching works. Notes save.

### Phase 3: Right column — Source Panel refactor

1. Refactor `InterviewSourcePanel` into tabbed (Media | Transcript)
2. Move `LazyTranscriptResults` into Transcript tab
3. Remove embedded evidence list from source panel
4. Simplify `InterviewChapters`: collapsed default, no shading, hover subtitles
5. URL state for source tab (`?source=`)

**Test:** Media plays. Transcript loads lazily. Chapters seek correctly. No evidence list visible.

### Phase 4: Tasks + cross-page links

1. Create `InterviewTasks.tsx` — persistent section below tabs
2. Add inline task creation (title + submit)
3. Add "Create task →" action on Recommendation cards
4. Add `?interview_id` filter to Insights/Themes page
5. Wire header links: evidence count → Evidence page, theme count → Insights page

**Test:** Tasks create and link correctly. Header links navigate with correct filters. Insights page shows filtered themes.

### Phase 5: Insight source link fix

1. Improve `matchTakeawaysToEvidence()` — lower threshold, add token overlap matching, match against `gist`
2. Add "Re-analyze" button for unlinked insights (re-runs `conversation-overview` lens)
3. Backfill: create a Trigger.dev task to re-run `conversation-overview` for interviews with empty `supportingEvidenceIds`

**Test:** >95% of takeaways have working "See source" links.

### Phase 6: Cleanup

1. Remove `InterviewScorecard` component (replaced by header)
2. Remove `LensAccordion` usage from interview detail (may still be used elsewhere)
3. Remove dead imports and unused hooks from detail.tsx
4. Remove legacy `salesLens` from loader
5. Deduplicate `getEvidenceSpeakerNames` and `deriveMediaFormat` into shared utils

---

## 4. Files Changed

### New files
| File | Purpose |
|------|---------|
| `app/features/interviews/pages/detail.loader.ts` | Extracted loader |
| `app/features/interviews/pages/detail.action.ts` | Extracted action |
| `app/features/interviews/components/InterviewDetailHeader.tsx` | Lightweight header |
| `app/features/interviews/components/AnalysisWorkspace.tsx` | Left column tabs |
| `app/features/interviews/components/LensSwitcher.tsx` | Lens dropdown + view |
| `app/features/interviews/components/InterviewTasks.tsx` | Tasks with inline creation |

### Modified files
| File | Changes |
|------|---------|
| `app/features/interviews/pages/detail.tsx` | Slim orchestrator (~200 lines), imports loader/action |
| `app/features/interviews/components/InterviewSourcePanel.tsx` | Add Media/Transcript tabs, remove evidence list |
| `app/features/interviews/components/InterviewChapters.tsx` | Collapsed default, no shading, hover subtitles |
| `app/features/insights/pages/themes.tsx` | Add `?interview_id` filter in loader + badge UI |

### Removed/deprecated
| File | Status |
|------|--------|
| `InterviewScorecard.tsx` | Replaced by `InterviewDetailHeader` |
| `LensAccordion` usage in interview detail | Replaced by `LensSwitcher` (component may be used elsewhere) |

---

## 5. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Loader/action split breaks React Router type inference | Export `loader` and `action` types from new files, re-export from `detail.tsx` |
| Evidence removal breaks "See source" flow | Keep full evidence fetch for drawer; test all takeaway → evidence navigation |
| Tab URL state conflicts with other searchParams | Namespace: `?tab=`, `?source=`, `?lens=` — won't collide with existing params |
| Task creation needs new API endpoint | Can reuse existing `/api/tasks/create` or add intent to detail action |
| Themes `?interview_id` filter shows zero results for interviews with no theme-linked evidence | Show "No themes from this interview yet" empty state with link to run analysis |

---

## 6. Non-Goals (Explicit)

- No changes to the loader's Supabase query patterns (beyond removing dead code)
- No changes to the Evidence page
- No changes to how lenses are processed/stored
- No mobile-specific layout work
- No changes to note/document type interview views
- No performance optimization of the loader query parallelism
