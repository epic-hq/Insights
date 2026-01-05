# Product Lens Implementation Guide

This document captures the code-level implementation of the Product Lens feature, which generates a Pain × User Type matrix to help product teams prioritize features based on customer evidence.

## Data Model (Supabase)

### Pain Matrix Cache (`supabase/schemas/44_pain_matrix_cache.sql`)

The product lens uses a dedicated cache table to avoid expensive recalculations:

- `pain_matrix_cache` – stores computed pain matrices per project with metadata for invalidation
  - `matrix_data` (jsonb) – full PainMatrix object including cells, themes, and user groups
  - `insights` (text) – LLM-generated strategic insights
  - `evidence_count`, `pain_count`, `user_group_count` – metadata for cache invalidation
  - `computation_time_ms` – performance tracking

Each cached matrix is unique per project and includes timestamp triggers for cache staleness detection. RLS policies protect access by account membership, with a special `service_role` policy for background operations.

### Evidence Requirements

The product lens relies on existing evidence with:
- Pain signals in `evidence.pains` field (text array from empathy maps)
- User segmentation via `evidence_facet` entries with `kind_slug = 'persona'` or `'role'`
- Evidence linked to people via `evidence_person` junction table

## Core Generator (`app/features/lenses/services/generatePainMatrix.server.ts`)

`generatePainMatrix` is the main entry point that builds the pain × user type matrix.

### Key Architecture

1. **Semantic Clustering** – Uses OpenAI embeddings to cluster similar pain themes from raw pain strings
   - Embeddings stored in `evidence_facet.embedding` (vector(1536))
   - Clustering threshold: 0.85 cosine similarity
   - Falls back to raw text grouping if embeddings unavailable

2. **User Groups** – Builds groups from persona/role facets in evidence
   - Each group tracks member count and member IDs
   - Supports both persona-based and role-based segmentation

3. **Cell Calculation** – For each pain × user group intersection:
   ```typescript
   // Frequency: % of group that mentions this pain
   frequency = personCount / groupMemberCount

   // Impact score accounts for small sample sizes
   groupSizeFactor = min(groupMemberCount, 10)
   impact_score = frequency × groupSizeFactor × intensityScore × wtpScore
   ```

4. **Intensity & WTP Scoring**:
   - Extracts from evidence empathy map fields (`does`, `feels`, `gains`, `pains`)
   - Uses OpenAI to classify: low/medium/high intensity, low/medium/high willingness to pay
   - Scores: low=0.33, medium=0.66, high=1.0

5. **Strategic Insights** – Uses BAML to generate concise, actionable insights:
   - Acknowledges small sample sizes (< 30 evidence or < 3 people per segment)
   - Recommends top 3 actions by impact score
   - Direct, pragmatic business tone

### Caching Strategy

- Cache key: `project_id`
- Invalidation triggers: evidence count change (checked on load)
- Force refresh via `forceRefresh` parameter
- Service role bypass allows background cache updates

## API Route (`app/routes/api.test-pain-matrix.tsx`)

Test endpoint for development:
- `POST /api/test-pain-matrix`
- Parameters: `projectId`, `minEvidence`, `minGroupSize`, `forceRefresh`
- Uses admin client to bypass RLS for testing
- Returns full matrix with all cells for heat map rendering

## UI Components

### PainMatrixComponent (`app/features/lenses/components/PainMatrix.tsx`)

Heat map visualization with:
- **Sortable rows** – by impact score or frequency
- **Impact filter** – slider (0-3 range) to hide low-impact pains
- **Color coding** – impact score ranges:
  - Critical (2.0+): red
  - High (1.5-2.0): orange
  - Medium (1.0-1.5): yellow
  - Low (0.5-1.0): green
  - Minimal (<0.5): gray
- **Interactive cells** – click to see evidence details
- **Key insights panel** – LLM-generated summary with top 3 actions

### Product Lens Page (`app/features/lenses/pages/product-lens.tsx`)

Full-page view:
- Loads matrix on mount with loading/error states
- Cell detail modal showing:
  - Metrics (impact score, frequency, intensity, WTP)
  - Evidence count and person count
  - Sample verbatims
  - Link to view all evidence

## BAML Configuration (`baml_src/pain_matrix_insights.baml`)

LLM-powered insights generation:

```baml
function GeneratePainMatrixInsights(
  matrix_data: PainMatrixInsightsInput
) -> PainMatrixInsights {
  client CustomGPT4oMini
  // Generates:
  // - summary: 1-2 sentence opportunity overview
  // - top_3_actions: Exactly 3 bullets with pain, segment, and impact score
}
```

Prompt rules:
- Direct, no corporate speak
- Acknowledge small samples and recommend more interviews
- Use actual pain/segment names from data
- Include 1-decimal impact scores

## Impact Score Design

The impact formula balances small sample sizes:

```typescript
// For 1 person group with 100% frequency, high intensity, medium WTP:
// 1.0 × 1 × 1.5 × 0.66 = 0.99

// For 2 person group with 100% frequency, high intensity, high WTP:
// 1.0 × 2 × 1.5 × 1.0 = 3.0
```

High-impact threshold: ≥ 1.0 (appears in yellow/orange/red on heat map)

This prevents the "everyone is low impact" problem with small research samples while still allowing differentiation between opportunities.

## Performance Considerations

- **Clustering**: O(n²) on pain theme count, but typically < 50 themes
- **Embeddings**: Cached in DB, regenerated only when facet label changes
- **Matrix generation**: ~3-5 seconds for 30 evidence items, 14 pains, 4 groups
- **Cache hits**: < 100ms when evidence count unchanged

## Future Enhancements

- Export to product roadmap tools (Linear, Jira)
- Historical trending (track impact scores over time)
- Opportunity sizing (convert impact to TAM/SAM estimates)
- Feature request linking (create issues directly from cells)
