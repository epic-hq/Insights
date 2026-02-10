# Interview Detail Page — Test Coverage & Next-Phase Plan

**Date**: 2026-02-10 (updated 2026-02-11)
**Status**: Phase 1 complete, Trigger.dev v2 pipeline tests added

---

## What Was Done (Phase 1)

### Refactoring for Testability

Extracted 8 pure helper functions from `detail.tsx` into `app/features/interviews/lib/interviewDetailHelpers.ts`:

| Function | Purpose |
| --- | --- |
| `parseFullName` | Split "First Last" into `{ first, last }` |
| `normalizeMultilineText` | JSON array → bullet string, handles nulls |
| `deriveMediaFormat` | Extension + source_type → `"audio"` / `"video"` |
| `extractAnalysisFromInterview` | JSONB → typed analysis object |
| `matchTakeawaysToEvidence` | Link AI takeaways to evidence rows by snippet match |
| `extractAnchorSeconds` | Normalize anchor timestamps across 6+ formats |
| `formatTimestamp` | Seconds → `MM:SS` display |
| `getFocusAreaColor` | Focus area label → tailwind color class |

Also fixed a **bug**: `.webm` was incorrectly listed in `AUDIO_EXTENSIONS`, causing all webm files to resolve as audio regardless of `source_type`.

### Unit Tests — 69 passing

**File**: `app/features/interviews/lib/interviewDetailHelpers.test.ts`

```bash
npx vitest run --config vitest.unit.config.ts app/features/interviews/lib/interviewDetailHelpers.test.ts
```

Covers all 8 helpers with edge cases (nulls, empty strings, malformed JSON, case-insensitive matching, ms→sec conversion, reverse containment, etc).

### Integration Tests — 10 passing (staging DB)

**File**: `app/test/integration/interview-detail-wow.integration.test.ts`

```bash
dotenvx run -- npx vitest run --config vitest.integration.config.ts app/test/integration/interview-detail-wow.integration.test.ts
```

| # | Test | What it validates |
| --- | --- | --- |
| 1 | Interview loads with all detail-page fields | `getInterviewById` query shape |
| 2 | Participants load with people join | `interview_people → people` join |
| 3 | Empty participants for interview without people | Graceful empty state |
| 4 | Evidence creation + query by interview_id | Insert + `select *` with evidence_people join |
| 5 | Evidence-people link + query | `evidence_people.account_id` NOT NULL, FK join |
| 6 | Conversation overview lens upsert + read | `conversation_lens_analyses` write → `loadLensAnalyses()` read |
| 7 | Lens → display format parse | `parseConversationOverviewLens()` with real DB row |
| 8 | Legacy JSONB fallback parse | `parseConversationAnalysisLegacy()` for un-migrated interviews |
| 9 | Evidence-takeaway matching with DB shapes | `matchTakeawaysToEvidence()` with real evidence rows |
| 10 | Full loader data assembly simulation | Parallel fetch (interview + participants + evidence + lens), parse, match — mirrors production loader |

### Schema Lessons Learned

These constraints were discovered during integration testing and are worth noting for future test authors:

- `evidence_people.account_id` is **NOT NULL** — must be included in inserts
- `evidence.id` is auto-generated — don't pass it in inserts; use `.select("id").single()` to get it back
- `evidence.sentiment` and `evidence.topic` don't exist in the current staging schema (types still reference them)
- `conversation_lens_templates` must have a `conversation-overview` row before writing to `conversation_lens_analyses` — the test seeds this if missing

---

## Current Coverage Matrix

| Area | Unit | Integration | E2E | Notes |
| --- | --- | --- | --- | --- |
| Helper functions (8) | ✅ 69 tests | — | — | `interviewDetailHelpers.test.ts` |
| Interview data loading | — | ✅ | — | Fields, participants, empty states |
| Evidence CRUD + people links | — | ✅ | — | Insert, query, FK joins |
| Conversation lens write/read | — | ✅ | — | Upsert, `loadLensAnalyses`, parse |
| Legacy JSONB fallback | — | ✅ | — | `parseConversationAnalysisLegacy` |
| Evidence-takeaway matching | ✅ | ✅ | — | Unit + real DB shapes |
| Full loader assembly | — | ✅ | — | Mirrors production parallel fetch |
| Conversation overview lens pipeline | ✅ | — | — | `conversation-overview-lens.test.ts` |
| Webhook + workflow state | — | ✅ | — | `conversation-analysis-consolidation.test.ts` |
| Upload DB operations | — | ✅ | — | `interview-upload.integration.test.ts` |
| `evidenceTranscriptMap.ts` | ❌ | — | — | **Phase 2** |
| `parseConversationAnalysis.server.ts` (direct) | ❌ | ✅ partial | — | **Phase 2** |
| `InterviewInsights` component | ❌ | — | ❌ | **Phase 2** |
| `InterviewRecommendations` component | ❌ | — | ❌ | **Phase 2** |
| `InterviewSourcePanel` component | ❌ | — | ❌ | **Phase 3** |
| `EvidenceVerificationDrawer` | ❌ | — | ❌ | **Phase 3** |
| Evidence voting (upvote/downvote) | ❌ | ❌ | ❌ | **Phase 2** |
| Share token + public view | ❌ | ❌ | ❌ | **Phase 3** |
| Theme-evidence junction (`getInterviewInsights`) | ❌ | ❌ | — | **Phase 2** |
| Regenerate conversation analysis | ❌ | ❌ | — | **Phase 3** |
| People normalization | ✅ 33 tests | ❌ | — | `peopleResolution.test.ts` |
| Real-time subscription updates | — | ✅ | — | `conversation-analysis-consolidation.test.ts` |
| **Trigger.dev v2 Pipeline** | | | | |
| Timestamp mapping (6 functions) | ✅ 36 tests | — | — | `timestampMapping.test.ts` |
| Workflow state (shouldExecuteStep, errorMessage) | ✅ 10 tests | — | — | `state.test.ts` |
| People resolution (7 functions) | ✅ 33 tests | — | — | `peopleResolution.test.ts` |
| Workflow state round-trip (init→save→load→resume) | — | ✅ 14 tests | — | `trigger-v2-workflow-state.integration.test.ts` |
| Progress + error state DB ops | — | ✅ | — | Included in workflow state integration tests |
| Finalize status transitions (processing→ready/error) | — | ✅ | — | Included in workflow state integration tests |
| Conversation lens upsert during finalize | — | ✅ | — | Included in workflow state integration tests |
| Full lifecycle simulation (upload→finalize) | — | ✅ | — | Included in workflow state integration tests |

---

## Trigger.dev v2 Pipeline Tests (New)

### Why

The v2 interview processing pipeline has been the #1 source of stuck/failed interviews. State corruption, lost progress, and stale reads in `conversation_analysis` JSONB cause interviews to hang indefinitely. These tests lock down the state machine and its DB interactions.

### Unit Tests — 79 passing

Three test files covering all exported pure functions:

| File | Tests | What it covers |
| --- | --- | --- |
| `src/trigger/interview/v2/timestampMapping.test.ts` | 36 | `coerceSeconds`, `normalizeTokens`, `normalizeForSearchText`, `buildWordTimeline`, `buildSegmentTimeline`, `findStartSecondsForSnippet` |
| `src/trigger/interview/v2/state.test.ts` | 10 | `shouldExecuteStep` (step ordering, resume-from, skip completed), `errorMessage` (Error/string/object coercion) |
| `src/trigger/interview/v2/peopleResolution.test.ts` | 33 | `isGenericPersonLabel`, `parseFullName`, `generateFallbackPersonName`, `humanizeKey`, `sanitizePersonKey`, `coerceString`, `resolveName` |

```bash
npx vitest run --config vitest.unit.config.ts src/trigger/interview/v2/
```

### Integration Tests — 14 passing (staging DB)

**File**: `app/test/integration/trigger-v2-workflow-state.integration.test.ts`

```bash
dotenvx run -- npx vitest run --config vitest.integration.config.ts app/test/integration/trigger-v2-workflow-state.integration.test.ts
```

| # | Test | What it validates |
| --- | --- | --- |
| 1 | Initialize workflow state | `initializeWorkflowState` creates empty state in `conversation_analysis` JSONB |
| 2 | Persist state to JSONB | State written to `conversation_analysis` column, readable via direct query |
| 3 | Save + load round-trip | `saveWorkflowState` → `loadWorkflowState` preserves all fields (transcript, evidenceIds, language) |
| 4 | Partial state merge | Second `saveWorkflowState` adds fields without clobbering existing ones (transcript preserved) |
| 5 | Null for empty interview | `loadWorkflowState` returns null when no `conversation_analysis` |
| 6 | Progress update | `updateAnalysisJobProgress` writes step/progress/statusDetail to JSONB |
| 7 | Progress preserves workflow_state | Progress update doesn't clobber existing `workflow_state` key |
| 8 | Progress no-op for undefined ID | `updateAnalysisJobProgress(db, undefined, ...)` doesn't throw |
| 9 | Error state + status transition | `updateAnalysisJobError` sets `status='error'` and writes `last_error` to JSONB |
| 10 | Error no-op for undefined ID | `updateAnalysisJobError(db, undefined, ...)` doesn't throw |
| 11 | Full lifecycle simulation | upload→evidence→insights→finalize, verifying accumulated state at each step |
| 12 | Status transition: processing→ready | Finalize sets `status='ready'` + complete `conversation_analysis` |
| 13 | Status transition: processing→error | Error sets `status='error'` + `processing_metadata` with error details |
| 14 | Conversation lens write/read | Upserts `conversation-overview` lens analysis, reads back with template join |

### Config Change

Added `src/**/*.test.{ts,tsx}` to `vitest.unit.config.ts` include patterns so trigger pipeline tests are discovered.

### Future v2 Pipeline Tests

| Test | Type | Effort | Why |
| --- | --- | --- | --- |
| `facetProcessing.ts` pure functions | Unit | 1h | `normalizeFacetValue`, `sanitizeFacetLabel`, `buildFacetLookup`, `matchFacetFromLookup` |
| `personMapping.ts` with staging DB | Integration | 1h | `mapRawPeopleToInterviewLinks` — person resolution + `interview_people` upsert |
| `extractEvidenceCore.ts` exported helpers | Unit | 30m | `sanitizeVerbatim`, `stringHash`, `computeIndependenceKey` (need to export first) |
| Orchestrator resume-from-step simulation | Integration | 2h | Full orchestrator with mocked task triggers, verify skip/resume logic |
| Evidence batch extraction contract test | Integration | 2h | `batchExtractEvidence` with stubbed BAML, verify evidence insert + facet linking |

---

## Phase 2 — Next Priority Tests

### 2a. `evidenceTranscriptMap.ts` unit tests (~1 hour, high ROI)

All 5 exported functions are pure — zero DB or React dependencies. This is the evidence verification drawer's data layer.

```typescript
// app/features/interviews/lib/evidenceTranscriptMap.test.ts
describe("parseAnchorTime", () => {
  it("converts ms integer > 500 to seconds")
  it("passes through seconds integer < 500")
  it("parses '1200ms' string format")
  it("parses '2:30' MM:SS format")
  it("returns null for invalid input")
})

describe("extractEvidenceTimeRange", () => {
  it("extracts from start_ms/end_ms format")
  it("extracts from startSeconds/endSeconds format")
  it("handles missing end → null endSec")
  it("returns null for empty anchors array")
  it("returns null for non-array anchors")
})

describe("findOverlappingUtterances", () => {
  it("returns indices of utterances overlapping the time range")
  it("uses 5s default window when endSec is null")
  it("includes 0.5s tolerance on boundaries")
  it("returns empty array when no overlap")
})

describe("buildUtteranceEvidenceMap", () => {
  it("maps utterance indices to evidence IDs")
  it("aggregates multiple evidence on same utterance")
  it("skips evidence with no valid anchors")
})

describe("findBestUtteranceIndex", () => {
  it("returns closest utterance to evidence start time")
  it("returns 0 for empty utterance array")
})
```

### 2b. `parseConversationAnalysis.server.ts` direct unit tests (~30 min)

The parsers are tested indirectly via integration tests, but dedicated unit tests catch edge cases faster:

```typescript
// app/features/interviews/lib/parseConversationAnalysis.server.test.ts
describe("parseKeyTakeaways", () => {
  it("parses valid takeaway array")
  it("skips entries with empty summary")
  it("defaults priority to 'medium' when invalid")
  it("returns empty array for non-array input")
})

describe("parseRecommendations", () => {
  it("parses valid recommendation array")
  it("skips entries where all fields are empty")
  it("trims whitespace from focus_area/action/rationale")
})

describe("parseConversationOverviewLens", () => {
  it("returns null for null/undefined input")
  it("maps overview → summary")
  it("always returns status='completed'")
})
```

### 2c. Theme-evidence junction integration test (~1 hour)

`getInterviewInsights` has deduplication logic (same theme linked to multiple evidence items). This needs a real DB test:

```typescript
// Add to interview-detail-wow.integration.test.ts or new file
describe("Theme-evidence junction for detail page", () => {
  it("should deduplicate themes linked to multiple evidence items")
  it("should return empty array for interview with no theme-linked evidence")
  it("should include theme statement and inclusion/exclusion criteria")
})
```

### 2d. Evidence voting round-trip integration test (~1 hour)

The voting system (`useVoting` hook → `annotations` table) is a core interaction on the detail page:

```typescript
describe("Evidence voting", () => {
  it("should create an upvote annotation on evidence")
  it("should toggle vote from upvote to downvote")
  it("should aggregate vote counts correctly")
})
```

### 2e. Component rendering tests with Storybook (~2 hours)

`InterviewInsights` and `InterviewRecommendations` already have a Storybook file (`detail.stories.tsx`). Add browser-level tests:

```typescript
// app/features/interviews/components/InterviewInsights.test.tsx
describe("InterviewInsights", () => {
  it("renders takeaway cards with priority badges")
  it("shows 'No insights' empty state when keyTakeaways is empty")
  it("links evidence snippets to source panel anchor")
})

// app/features/interviews/components/InterviewRecommendations.test.tsx
describe("InterviewRecommendations", () => {
  it("renders recommendation cards with focus area color badges")
  it("renders open questions section")
  it("shows empty state when no recommendations")
})
```

---

## Phase 3 — Backlog

| Test | Type | Effort | Why |
| --- | --- | --- | --- |
| `InterviewSourcePanel` media player rendering | Browser | 3h | Complex component with media player, transcript, evidence timeline |
| `EvidenceVerificationDrawer` 3-mode display | Browser | 3h | Focused / Context / Full Transcript toggle logic |
| Share token generation + `PublicInterviewView` | Integration | 2h | `share_token`, `share_enabled`, `share_expires_at` fields |
| Regenerate conversation analysis flow | Integration | 2h | `POST /api/regenerate-conversation-analysis` → lens upsert |
| `peopleNormalization.server.ts` | Unit | 1h | Name parsing, dedup, merge logic |
| Upload source type branching (5 paths) | Integration | 2h | `api.onboarding-start` parameterized test |
| Custom lens defaults hook | Unit | 30m | `useCustomLensDefaults` |
| Empathy map processing | Unit | 1h | `processEmpathyMap.server.ts` |

---

## Test Commands

```bash
# Unit tests (interview detail helpers)
npx vitest run --config vitest.unit.config.ts app/features/interviews/lib/interviewDetailHelpers.test.ts

# Integration tests (interview detail wow)
dotenvx run -- npx vitest run --config vitest.integration.config.ts app/test/integration/interview-detail-wow.integration.test.ts

# All integration tests
dotenvx run -- npx vitest run --config vitest.integration.config.ts

# All unit tests
npx vitest run --config vitest.unit.config.ts

# Browser component tests (Storybook-based)
npx vitest run --config vitest.browser.config.ts
```

---

## Files Reference

| File | Role |
| --- | --- |
| `app/features/interviews/lib/interviewDetailHelpers.ts` | Extracted pure helpers |
| `app/features/interviews/lib/interviewDetailHelpers.test.ts` | 69 unit tests |
| `app/features/interviews/lib/evidenceTranscriptMap.ts` | Evidence ↔ transcript mapping (Phase 2 target) |
| `app/features/interviews/lib/parseConversationAnalysis.server.ts` | Lens/legacy parsing (Phase 2 target) |
| `app/features/interviews/pages/detail.tsx` | Main detail page (loader + component) |
| `app/features/interviews/db.ts` | DB access layer (7 exported functions) |
| `app/features/lenses/lib/loadLensAnalyses.server.ts` | Lens template + analysis loading |
| `app/test/integration/interview-detail-wow.integration.test.ts` | 10 integration tests |
| `app/test/integration/trigger-v2-workflow-state.integration.test.ts` | 14 integration tests for v2 pipeline state |
| `src/trigger/interview/v2/timestampMapping.test.ts` | 36 unit tests for timestamp utilities |
| `src/trigger/interview/v2/state.test.ts` | 10 unit tests for state pure functions |
| `src/trigger/interview/v2/peopleResolution.test.ts` | 33 unit tests for people resolution |
| `app/test/utils/testDb.ts` | Test DB utilities, seed/cleanup |
