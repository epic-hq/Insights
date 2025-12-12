# Insights (Themes) Technical Design

## Overview

The Insights system extracts, groups, and enriches thematic patterns from interview evidence. This document covers the complete data flow from transcript to displayed insight.

## Architecture

### Data Model

```sql
-- Core tables
themes                  -- Project-level thematic groupings
evidence                -- Verbatim quotes from interviews with embeddings
theme_evidence          -- Junction table linking themes to evidence

-- Key relationships
themes.project_id       → projects.id
evidence.interview_id   → interviews.id
evidence.project_id     → projects.id
evidence.embedding      → vector(1536)  -- For semantic search
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
| `statement` | text | 1-2 sentence description (used for semantic matching) |
| `inclusion_criteria` | text | What evidence belongs (used for semantic matching) |
| `exclusion_criteria` | text | What evidence doesn't belong |
| `synonyms` | text[] | Alternative phrasings |
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
| `rationale` | text | How this evidence was linked (e.g., "Semantic match (78%)") |
| `confidence` | numeric | 0.0-1.0 similarity score from vector search |

**Unique constraint**: `(theme_id, evidence_id, account_id)`

---

## Data Flow

### Two-Phase Theme Consolidation (Primary Flow)

The system uses a **two-phase approach** that separates theme creation from evidence linking:

```
User clicks "Consolidate Themes"
       ↓
┌──────────────────────────────────────────────────────────────┐
│  Phase 1: Theme Creation (LLM)                               │
├──────────────────────────────────────────────────────────────┤
│  1. Load all evidence from project (up to 600 items)         │
│  2. Pass evidence JSON to BAML AutoGroupThemes               │
│  3. LLM analyzes patterns and returns theme definitions      │
│  4. Themes created with: name, statement, inclusion_criteria │
└──────────────────────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────────────────────┐
│  Phase 2: Evidence Linking (Vector Search)                   │
├──────────────────────────────────────────────────────────────┤
│  For each theme:                                             │
│  1. Build search query from statement + inclusion_criteria   │
│  2. Generate embedding via OpenAI text-embedding-3-small     │
│  3. Query pgvector: find_similar_evidence(embedding, project)│
│  4. Create theme_evidence links with similarity as confidence│
└──────────────────────────────────────────────────────────────┘
```

**Why Two Phases?**

LLMs are unreliable at copying UUIDs. When asked to return `evidence_id` values, they hallucinate non-existent IDs. By separating theme creation from linking:

- LLM focuses on pattern recognition (its strength)
- Vector search handles ID matching (reliable, from database)
- No hallucinated IDs, no foreign key errors

### Key Function: `autoGroupThemesAndApply`

Location: `app/features/themes/db.autoThemes.server.ts`

```typescript
export async function autoGroupThemesAndApply(opts) {
  // Phase 1: Load evidence and create themes via LLM
  const evidence = await loadEvidence(supabase, account_id, project_id, limit)
  const { themes } = await baml.AutoGroupThemes(JSON.stringify(evidence), guidance)

  // Phase 2: Link evidence via semantic similarity
  for (const theme of themes) {
    const searchQuery = [theme.statement, theme.inclusion_criteria].join(". ")
    const matches = await findSimilarEvidenceForTheme(supabase, project_id, searchQuery)

    for (const match of matches) {
      await upsertThemeEvidence({
        theme_id: theme.id,
        evidence_id: match.id,  // Real ID from database
        confidence: match.similarity,
        rationale: `Semantic match (${Math.round(match.similarity * 100)}%)`
      })
    }
  }
}
```

### Semantic Search Function

```typescript
async function findSimilarEvidenceForTheme(
  supabase, projectId, themeText, threshold = 0.45, limit = 100
) {
  // Generate embedding for theme description
  const embedding = await generateEmbedding(themeText)

  // Find similar evidence via pgvector
  const { data } = await supabase.rpc("find_similar_evidence", {
    query_embedding: embedding,
    project_id_param: projectId,
    match_threshold: threshold,
    match_count: limit
  })

  return data  // [{ id, verbatim, similarity }]
}
```

### BAML Contract

Location: `baml_src/auto_group_themes.baml`

```baml
class ProposedTheme {
  name string                    // "Users struggle with complex onboarding"
  statement string               // Used for semantic matching
  inclusion_criteria string      // What quotes belong to this theme
  exclusion_criteria string?     // What should NOT be included
  synonyms string[]              // Alternative phrasings
}

function AutoGroupThemes(evidence_json, guidance) -> { themes: ProposedTheme[] }
```

**Note**: The BAML contract does NOT include evidence links. Evidence linking is handled entirely by vector search.

---

## Per-Interview Theme Generation

Location: `src/trigger/interview/v2/generateInsights.ts`

When an interview is processed, themes are created but **not linked to evidence**:

```typescript
// Create themes from BAML output
const themeRows = insights.map(i => ({
  name: i.name,
  statement: i.details,
  inclusion_criteria: i.evidence,
  // NO theme_evidence links created here
}))

await client.from("themes").insert(themeRows)

// Evidence linking deferred to consolidation
consola.info("Themes created. Evidence linking deferred to consolidation.")
```

**Rationale**: Per-interview linking previously created N×M relationships (every theme to every evidence). This was over-linking. Now themes are created empty and linked during consolidation.

---

## Theme Enrichment

Location: `src/trigger/enrich-themes.ts`

After themes have evidence links, enrichment adds metadata:

```
1. Find themes missing metadata (pain, jtbd, category)
2. For each theme, load linked evidence via theme_evidence
3. Call assess-cluster to generate metadata from evidence
4. Update theme with enriched fields
```

**Dependency**: Enrichment requires `theme_evidence` links. Run consolidation first.

---

## Database Functions

### find_similar_evidence

Location: `supabase/schemas/34_embeddings.sql`

```sql
create function find_similar_evidence(
  query_embedding vector(1536),
  project_id_param uuid,
  match_threshold float default 0.7,
  match_count int default 10
) returns table (id uuid, verbatim text, similarity float)
```

Uses pgvector cosine similarity to find evidence matching a theme description.

---

## UI Components

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/insights` | `_layout.tsx` | Layout with Consolidate/Enrich buttons |
| `/insights/quick` | `quick.tsx` | Card view |
| `/insights/table` | `table.tsx` | Table view |
| `/insights/:id` | `insight-detail.tsx` | Detail with evidence |

### Insight Detail Page

Shows:
- Theme name, statement, metadata
- Supporting evidence grouped by interview
- Semantic similarity section (related but unlinked evidence)
- Annotations panel for votes/comments

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/consolidate-themes` | POST | Trigger theme consolidation with semantic linking |
| `/api/enrich-themes` | POST | Trigger batch theme enrichment |
| `/api/diagnose-themes` | GET | Debug theme/evidence state |
| `/api/similar-evidence-for-insight` | GET | Find semantically related evidence |

---

## Configuration

### Semantic Search Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `match_threshold` | 0.45 | Minimum similarity (0-1) to create link |
| `match_count` | 100 | Max evidence per theme |

Lower threshold = more links (potentially noisy)
Higher threshold = fewer links (potentially missing relevant evidence)

### Embedding Model

- Model: `text-embedding-3-small`
- Dimensions: 1536
- Provider: OpenAI

---

## Troubleshooting

### No evidence linked to themes

1. Check evidence has embeddings: `SELECT count(*) FROM evidence WHERE embedding IS NOT NULL`
2. Check threshold isn't too high (default 0.45)
3. Run consolidation: `/api/diagnose-themes?action=reset`

### Themes have too many evidence links

1. Increase threshold (e.g., 0.6)
2. Check theme statements are specific enough

### Consolidation fails

1. Check OPENAI_API_KEY is set
2. Check Supabase connection
3. Review logs for specific errors
