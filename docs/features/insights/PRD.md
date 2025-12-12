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

- [x] Insights page shows all themes for the current project
- [x] Card view displays: name, statement, category, emotional response, evidence count
- [x] Table view displays: name, category, evidence count, votes
- [x] Clicking an insight opens a detail view with full information
- [x] Evidence count reflects actual `theme_evidence` links

### FR2: Generate Insights from Interviews

**Description**: When an interview is processed, themes are created from the evidence.

**Acceptance Criteria**:

- [x] After interview finalization, themes are created in `themes` table
- [x] Themes include: name, statement, inclusion_criteria
- [ ] Evidence linking deferred to consolidation (see FR3)

**Note**: Per-interview theme generation creates themes but does NOT link evidence. This avoids over-linking issues. Evidence is linked during consolidation via semantic similarity.

### FR3: Consolidate Themes

**Description**: Users can consolidate themes across interviews with automatic evidence linking.

**Acceptance Criteria**:

- [x] "Consolidate Themes" button triggers project-wide theme analysis
- [x] AI identifies patterns and creates consolidated themes
- [x] Evidence is linked via semantic similarity (vector search)
- [x] Each link includes confidence score based on similarity
- [x] User receives feedback on consolidation results

**Implementation**: Uses two-phase approach:
1. LLM analyzes evidence and creates theme definitions
2. Vector search matches evidence to themes by semantic similarity

### FR4: Enrich Themes

**Description**: Users can add metadata to themes that are missing pain points, JTBD, or categories.

**Acceptance Criteria**:

- [x] "Enrich Themes" button triggers batch enrichment
- [x] Only themes missing metadata are processed
- [x] Enrichment uses linked evidence to generate metadata
- [x] Updated fields: pain, jtbd, category, desired_outcome, emotional_response

### FR5: View Supporting Evidence

**Description**: Users can see which evidence supports each insight.

**Acceptance Criteria**:

- [x] Insight detail shows list of linked evidence
- [x] Each evidence item shows: verbatim quote, interview source, attribution
- [x] Evidence grouped by interview/company
- [x] Semantic similarity section shows related but unlinked evidence
- [x] Clicking evidence navigates to the interview

### FR6: Vote on Insights

**Description**: Users can upvote/downvote insights to indicate importance.

**Acceptance Criteria**:

- [x] Vote buttons on insight cards and detail view
- [x] Vote count displayed on cards
- [x] Votes are project-scoped

---

## Non-Functional Requirements

### NFR1: Performance

- Insights page should load in < 2 seconds for projects with < 500 themes
- Consolidation should complete in < 60 seconds for projects with < 600 evidence items

### NFR2: Data Integrity

- Theme-evidence links are created via semantic similarity (no over-linking)
- Deleted evidence cascades to remove theme_evidence links
- Deleted themes cascade to remove theme_evidence links

### NFR3: Idempotency

- Re-running consolidation updates existing themes (matched by name)
- Re-running enrichment does not overwrite user-edited fields

---

## User Flows

### Flow 1: View and Explore Insights

```text
1. User navigates to /insights
2. System displays insights in card view (default)
3. User can toggle to table view
4. User clicks an insight card
5. Detail page shows full insight with evidence grouped by interview
6. Semantic similarity section shows related evidence not yet linked
```

### Flow 2: Consolidate Themes

```text
1. User clicks "Consolidate Themes" button
2. System loads all evidence from project
3. LLM analyzes evidence and creates theme definitions
4. For each theme, vector search finds semantically similar evidence
5. Theme-evidence links created with confidence scores
6. Toast notification shows results (X themes, Y links)
7. Page reloads with consolidated themes
```

### Flow 3: Enrich Themes

```text
1. User clicks "Enrich Themes" button
2. System finds themes missing metadata
3. For each theme, loads linked evidence
4. AI generates metadata from evidence
5. Theme updated with pain, jtbd, category, etc.
6. Toast notification shows results
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Themes per project | 5-15 consolidated |
| Evidence links per theme | 10-100 (via semantic matching) |
| Semantic match accuracy | > 70% relevant |
| Enrichment success rate | > 80% |

---

## Dependencies

- **BAML**: `AutoGroupThemes` for theme creation
- **OpenAI**: `text-embedding-3-small` for semantic matching
- **pgvector**: `find_similar_evidence` RPC for vector search
- **Trigger.dev**: `generateInsightsTaskV2`, `enrich-themes-batch`
- **Database**: `themes`, `evidence`, `theme_evidence` tables
