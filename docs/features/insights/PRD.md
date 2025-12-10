# Insights (Themes) Product Requirements

## Overview

Insights are the core output of the discovery process. They represent validated patterns, pain points, and user needs extracted from interview conversations. Users rely on insights to make product decisions, prioritize features, and understand their customers.

## User Stories

### Primary User: Product Manager / Researcher

1. **As a PM**, I want to see all insights from my project in one place, so I can understand the patterns across all interviews.

2. **As a PM**, I want insights to show supporting evidence, so I can validate the insight with real user quotes.

3. **As a PM**, I want to enrich insights with metadata (pain points, JTBD, category), so I can filter and prioritize them.

4. **As a PM**, I want to consolidate similar insights across interviews, so I don't have duplicate themes.

5. **As a PM**, I want to see which personas are associated with each insight, so I can understand who experiences this pain.

6. **As a PM**, I want to vote on insights, so my team knows which ones are most important.

---

## Functional Requirements

### FR1: View Insights

**Description**: Users can view all insights for a project in card or table format.

**Acceptance Criteria**:

- [ ] Insights page shows all themes for the current project
- [ ] Card view displays: name, statement, category, emotional response, evidence count
- [ ] Table view displays: name, category, evidence count, votes
- [ ] Clicking an insight opens a detail modal with full information
- [ ] Evidence count reflects actual `theme_evidence` links

### FR2: Generate Insights from Interviews

**Description**: When an interview is processed, insights are automatically generated from the evidence.

**Acceptance Criteria**:

- [ ] After interview finalization, themes are created in `themes` table
- [ ] Each theme is linked to its supporting evidence via `theme_evidence`
- [ ] Themes include: name, statement, inclusion_criteria
- [ ] Evidence links include: rationale, confidence score

**Current Status**: ⚠️ Partially implemented. Themes are created but ALL evidence is linked to ALL themes (over-linking bug).

### FR3: Consolidate Themes

**Description**: Users can merge similar themes across interviews into consolidated insights.

**Acceptance Criteria**:

- [ ] "Consolidate Themes" button triggers project-wide theme analysis
- [ ] AI identifies similar themes and merges them
- [ ] Merged themes retain all evidence links from source themes
- [ ] Duplicate themes are either merged or marked for review
- [ ] User receives feedback on consolidation results

**Current Status**: ✅ Implemented via `/api/consolidate-themes` and `AutoGroupThemes` BAML.

### FR4: Enrich Themes

**Description**: Users can add metadata to themes that are missing pain points, JTBD, or categories.

**Acceptance Criteria**:

- [ ] "Enrich Themes" button triggers batch enrichment
- [ ] Only themes missing metadata are processed
- [ ] Enrichment uses linked evidence to generate metadata
- [ ] Updated fields: pain, jtbd, category, desired_outcome, emotional_response
- [ ] User receives feedback on enrichment results

**Current Status**: ✅ Implemented via `/api/enrich-themes` and `assess-cluster` Edge Function.

### FR5: View Supporting Evidence

**Description**: Users can see which evidence supports each insight.

**Acceptance Criteria**:

- [ ] Insight detail shows list of linked evidence
- [ ] Each evidence item shows: verbatim quote, interview source, timestamp
- [ ] Clicking evidence navigates to the interview at that timestamp
- [ ] Evidence count badge is accurate

**Current Status**: ⚠️ Partially implemented. Evidence count is shown but detail view may not list all evidence.

### FR6: Vote on Insights

**Description**: Users can upvote/downvote insights to indicate importance.

**Acceptance Criteria**:

- [ ] Vote buttons on insight cards and detail view
- [ ] Vote count displayed on cards
- [ ] Votes are project-scoped
- [ ] High-vote insights can be filtered/sorted

**Current Status**: ✅ Implemented via annotations system.

---

## Non-Functional Requirements

### NFR1: Performance

- Insights page should load in < 2 seconds for projects with < 500 themes
- Consolidation should complete in < 30 seconds for projects with < 200 evidence items

### NFR2: Data Integrity

- Theme-evidence links must be accurate (no over-linking)
- Deleted evidence should cascade to remove theme_evidence links
- Deleted themes should cascade to remove theme_evidence links

### NFR3: Idempotency

- Re-running consolidation should not create duplicate themes
- Re-running enrichment should not overwrite user-edited fields

---

## User Flows

### Flow 1: View and Explore Insights

```text
1. User navigates to /insights
2. System displays insights in card view (default)
3. User can toggle to table view
4. User clicks an insight card
5. Modal opens with full insight details
6. User can see linked evidence, personas, and metadata
```

### Flow 2: Consolidate Themes

```text
1. User clicks "Consolidate Themes" button
2. Button shows loading spinner
3. System calls /api/consolidate-themes
4. AutoGroupThemes BAML analyzes all evidence
5. Similar themes are merged
6. Toast notification shows results
7. Page reloads with consolidated themes
```

### Flow 3: Enrich Themes

```text
1. User clicks "Enrich Themes" button
2. Button shows loading spinner
3. System calls /api/enrich-themes
4. Trigger.dev task processes themes in batch
5. Each theme is enriched with metadata
6. Toast notification shows results
7. Page reloads with enriched themes
```

---

## Open Questions

1. **Should consolidation run automatically after each interview?**
   - Pro: Users always see consolidated view
   - Con: May merge themes user wants separate

2. **How should we handle conflicting theme names?**
   - Current: Merge by exact name match
   - Alternative: Semantic similarity matching

3. **Should users be able to manually link/unlink evidence from themes?**
   - Current: No UI for this
   - Needed: For correcting AI mistakes

4. **What's the relationship between /insights and /themes pages?**
   - Current: Both show same data, different views
   - Recommendation: Consolidate or clearly differentiate

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Insights per interview | 3-8 | Unknown |
| Evidence links per theme | 2-10 | Over-linked |
| Enrichment success rate | > 80% | Unknown |
| User engagement (votes) | > 50% of insights voted | Unknown |

---

## Dependencies

- **BAML**: `ExtractInsights`, `AutoGroupThemes` functions
- **Trigger.dev**: `generateInsightsTaskV2`, `enrich-themes-batch`
- **Edge Functions**: `assess-cluster` for enrichment
- **Database**: `themes`, `evidence`, `theme_evidence` tables
