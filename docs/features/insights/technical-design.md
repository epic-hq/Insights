# Insights (Themes) Technical Design

## Overview

The Insights system extracts, groups, and enriches thematic patterns from interview evidence. This document covers the complete data flow from transcript to displayed insight.

## Architecture

### Data Model

```sql
-- Core tables
themes                  -- Project-level thematic groupings
evidence                -- Verbatim quotes from interviews with timestamps
theme_evidence          -- Junction table linking themes to evidence

-- Key relationships
themes.project_id       → projects.id
evidence.interview_id   → interviews.id
evidence.project_id     → projects.id
theme_evidence.theme_id → themes.id
theme_evidence.evidence_id → evidence.id
```

### Schema: `themes` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `account_id` | uuid | Account scope (required) |
| `project_id` | uuid | Project scope |
| `name` | text | Theme name (actionable insight) |
| `statement` | text | 1-2 sentence description |
| `inclusion_criteria` | text | What evidence belongs |
| `exclusion_criteria` | text | What evidence doesn't belong |
| `synonyms` | text[] | Alternative phrasings |
| `anti_examples` | text[] | Similar but excluded examples |
| `category` | text | Classification (e.g., "Productivity") |
| `jtbd` | text | Jobs To Be Done |
| `pain` | text | Pain point description |
| `desired_outcome` | text | What user wants to achieve |
| `emotional_response` | text | User's emotional state |

### Schema: `theme_evidence` Junction Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `theme_id` | uuid | FK to themes |
| `evidence_id` | uuid | FK to evidence |
| `account_id` | uuid | Account scope |
| `project_id` | uuid | Project scope |
| `rationale` | text | Why this evidence supports the theme |
| `confidence` | numeric | 0.0-1.0 confidence score |

**Unique constraint**: `(theme_id, evidence_id, account_id)`

---

## Data Flow

### Path 1: Per-Interview Theme Generation

```
Interview Upload
       ↓
┌──────────────────────────────────────────────────────────────┐
│  V2 Orchestrator (interview.v2.orchestrator)                 │
├──────────────────────────────────────────────────────────────┤
│  1. uploadAndTranscribe → transcript                         │
│  2. extractEvidence → evidence rows + evidenceIds            │
│  3. enrichPerson → person metadata                           │
│  4. generateInsights → themes + theme_evidence links         │
│  5. assignPersonas → persona assignments                     │
│  6. attributeAnswers → research question answers             │
│  7. finalizeInterview → status = "completed"                 │
└──────────────────────────────────────────────────────────────┘
```

**Key Task: `generateInsightsTaskV2`** (`src/trigger/interview/v2/generateInsights.ts`)

1. Receives `evidenceUnits` and `evidenceIds` from orchestrator
2. Calls BAML `ExtractInsights` to generate insights from evidence
3. Inserts themes into `themes` table
4. Creates `theme_evidence` links for ALL evidence from that interview

**⚠️ ISSUE IDENTIFIED**: Current implementation links EVERY theme to EVERY evidence from the interview:

```typescript
// Lines 127-138 in generateInsights.ts
for (const theme of createdThemes) {
  for (const evidenceId of evidenceIds) {
    themeEvidenceRows.push({
      theme_id: theme.id,
      evidence_id: evidenceId,
      rationale: "Generated from interview evidence",
      confidence: 0.8,
    })
  }
}
```

This creates N×M links where N = themes and M = evidence, which is **over-linking**. The BAML function should return specific evidence IDs per theme.

### Path 2: Project-Wide Consolidation

```
User clicks "Consolidate Themes"
       ↓
┌──────────────────────────────────────────────────────────────┐
│  API Route: /api/consolidate-themes                          │
├──────────────────────────────────────────────────────────────┤
│  autoGroupThemesAndApply()                                   │
│  1. Load evidence from project (limit 200)                   │
│  2. Call BAML AutoGroupThemes with evidence JSON             │
│  3. Upsert themes (merge by name)                            │
│  4. Create theme_evidence links with rationale + confidence  │
└──────────────────────────────────────────────────────────────┘
```

**Key Function: `autoGroupThemesAndApply`** (`app/features/themes/db.autoThemes.server.ts`)

This function:
1. Loads evidence with facets from `evidence` and `evidence_facet` tables
2. Calls BAML `AutoGroupThemes` which returns themes WITH specific evidence links
3. Upserts themes (finds existing by name or creates new)
4. Creates `theme_evidence` links with AI-generated rationale and confidence

**BAML Contract** (`baml_src/auto_group_themes.baml`):

```baml
class ThemeLink {
  evidence_id string
  rationale string
  confidence float  // 0.0-1.0
}

class ProposedTheme {
  name string
  statement string | null
  links ThemeLink[]  // Specific evidence links
}
```

### Path 3: Theme Enrichment

```
User clicks "Enrich Themes"
       ↓
┌──────────────────────────────────────────────────────────────┐
│  API Route: /api/enrich-themes                               │
├──────────────────────────────────────────────────────────────┤
│  Trigger Task: enrich-themes-batch                           │
│  1. Find themes missing metadata (pain, jtbd, category)      │
│  2. For each theme, trigger enrich-theme task                │
│  3. Load linked evidence via theme_evidence                  │
│  4. Call assess-cluster Edge Function                        │
│  5. Update theme with enriched metadata                      │
└──────────────────────────────────────────────────────────────┘
```

**Dependency**: Enrichment REQUIRES `theme_evidence` links to exist. If themes have no linked evidence, enrichment will skip them.

---

## UI Components

### Pages

| Route | Component | Data Source |
|-------|-----------|-------------|
| `/insights` | `_layout.tsx` | Layout with Enrich/Consolidate buttons |
| `/insights/quick` | `quick.tsx` | Card view via `getInsights()` |
| `/insights/table` | `table.tsx` | Table view via `getInsights()` |
| `/themes` | `index.tsx` | Alternative view with persona matrix |

### Data Fetching: `getInsights()`

Location: `app/features/insights/db.ts`

```typescript
const baseQuery = supabase
  .from("themes")
  .select(`
    id, name, statement, inclusion_criteria, exclusion_criteria,
    synonyms, anti_examples, category, jtbd, pain, desired_outcome,
    journey_stage, emotional_response, motivation, updated_at,
    project_id, created_at,
    theme_evidence(count)  // Evidence count
  `)
  .eq("project_id", projectId)
```

Also fetches:
- `insight_tags` for tag associations
- `persona_insights` for persona associations
- `interviews` for linked interview titles
- `insights_with_priority` for priority scores
- `votes` for vote counts

---

## Discrepancies & Issues

### 1. Over-Linking in Per-Interview Generation

**Problem**: `generateInsightsTaskV2` links every theme to every evidence from the interview.

**Impact**:
- Themes appear to have more evidence than they actually support
- Evidence counts are inflated
- Enrichment may use irrelevant evidence

**Fix Required**: Update BAML `ExtractInsights` to return specific evidence IDs per insight, then use those IDs when creating `theme_evidence` links.

### 2. Duplicate Themes Across Interviews

**Problem**: Each interview generates its own themes. Similar themes from different interviews are not merged.

**Impact**:
- "Need for AI Tools" might exist 5 times with slight variations
- Users see fragmented insights

**Mitigation**: "Consolidate Themes" button runs `AutoGroupThemes` which merges by name. But this is manual.

**Recommendation**: Consider auto-consolidation after each interview, or batch consolidation on a schedule.

### 3. Enrichment Dependency on Links

**Problem**: `enrich-theme` task skips themes with no `theme_evidence` links.

```typescript
// Lines 153-156 in enrich-themes.ts
if (!evidenceLinks || evidenceLinks.length === 0) {
  return { enriched: false, reason: "No evidence" }
}
```

**Impact**: If per-interview linking fails, themes can never be enriched.

### 4. Two Separate UI Pages

**Problem**: `/insights` and `/themes` show the same data with different views.

**Current State**:
- `/insights` has Enrich + Consolidate buttons
- `/themes` has Enrich button + persona matrix

**Recommendation**: Consolidate to single page or clearly differentiate purposes.

### 5. Missing Evidence Count in Some Views

**Problem**: `InsightCardV3` casts `evidence_count` as `(insight as any).evidence_count` suggesting type mismatch.

**Impact**: TypeScript doesn't validate this field exists.

---

## BAML Contracts

### ExtractInsights (Per-Interview)

Location: `baml_src/extract_insights.baml`

Used by `generateInterviewInsightsFromEvidenceCore()` during interview processing.

### AutoGroupThemes (Consolidation)

Location: `baml_src/auto_group_themes.baml`

```baml
function AutoGroupThemes(evidence_json: string, guidance: string) -> AutoGroupThemesResponse {
  // Returns themes with specific evidence links
}
```

Rules enforced:
- 5-15 themes maximum
- Each theme should have evidence from 2+ sources
- Theme names should be actionable insights
- Link each evidence to at most 1-2 themes
- Confidence scoring: 0.9+ = direct quote, 0.7-0.9 = strong implied, etc.

---

## Trigger.dev Tasks

| Task ID | File | Purpose |
|---------|------|---------|
| `interview.v2.generate-insights` | `generateInsights.ts` | Per-interview theme generation |
| `enrich-themes-batch` | `enrich-themes.ts` | Batch enrichment coordinator |
| `enrich-theme` | `enrich-themes.ts` | Single theme enrichment |

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/consolidate-themes` | POST | Trigger project-wide theme consolidation |
| `/api/enrich-themes` | POST | Trigger batch theme enrichment |

---

## Recommendations

### Short-Term Fixes

1. **Fix over-linking**: Update `generateInsightsTaskV2` to use BAML-returned evidence IDs
2. **Add evidence_count to types**: Update `Insight` type to include `evidence_count`
3. **Unify UI**: Decide on single insights page or clear differentiation

### Medium-Term Improvements

1. **Auto-consolidation**: Run `AutoGroupThemes` after each interview finishes
2. **Incremental enrichment**: Enrich new themes automatically
3. **Better linking UI**: Show which evidence supports which theme

### Long-Term Vision

1. **Theme hierarchy**: Parent/child theme relationships
2. **Cross-project themes**: Account-level theme library
3. **Theme suggestions**: AI suggests merging similar themes
