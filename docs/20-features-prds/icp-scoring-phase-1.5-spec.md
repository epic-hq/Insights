# ICP Scoring Phase 1.5: Algorithm Flexibility & Data Enrichment

**Date:** 2026-02-07
**Status:** Ready for implementation
**Parent Epic:** Insights-3ml (ICP Match Lens & Recommendation Engine)

---

## Problem

Phase 1 ICP scoring is live but produces mostly "No match" results because:

1. **Sparse people data**: 22/31 people missing job title, 28/31 missing company. The algorithm penalizes missing data via a confidence multiplier that crushes scores to near-zero.
2. **No way to skip irrelevant criteria**: If users don't care about company size (e.g., B2C use case, anonymous survey respondents), the size dimension still contributes 30% weight as a zero, dragging the score down.
3. **No data enrichment path**: Users see the data quality warning but have no automated way to fill gaps.

### Real Example (Rick's project)

- 31 people scored, 1 LOW, 30 NONE
- Most people came from anonymous survey links with no title/company
- ICP criteria: "Founder, Entrepreneur, Marketing Director, Sales" as target roles
- Even people who ARE founders scored poorly because `confidence = 0` when title is null

---

## Solution: Two Work Streams

### Stream A: Smarter Algorithm (this agent)

Fix `calculateICPScore.server.ts` to handle missing data gracefully.

### Stream B: People Data Enrichment Tool (separate agent)

New Mastra tool that researches people via web to fill in missing title/company/org fields.

---

## Stream A: Algorithm Changes

### Current Problem

```
overall_score = rawScore * confidence
```

When `confidence = 0` (no title, no company, no org, no role), overall_score = 0 regardless of any matches. Even with one field present, confidence = 0.3, so a perfect role match (rawScore = 0.7) becomes 0.21 — below the LOW threshold.

### New Approach: Skip Missing Dimensions

Instead of scoring all 3 dimensions and multiplying by confidence, **only score dimensions where we have data**. Re-weight the remaining dimensions dynamically.

#### Algorithm Change

```typescript
// OLD: fixed weights, confidence multiplier
const rawScore = role * 0.4 + org * 0.3 + size * 0.3
const overall = rawScore * confidence  // confidence crushes everything

// NEW: dynamic weights based on available data
const dimensions = []
if (hasRoleData && targetRoles.length > 0)
  dimensions.push({ score: roleScore, weight: 0.4 })
if (hasOrgData && targetOrgs.length > 0)
  dimensions.push({ score: orgScore, weight: 0.3 })
if (hasSizeData && targetSizes.length > 0)
  dimensions.push({ score: sizeScore, weight: 0.3 })

if (dimensions.length === 0) {
  // No data at all → return indeterminate, not zero
  return { overall_score: null, band: null, confidence: 0 }
}

// Re-normalize weights to sum to 1.0
const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0)
const overall = dimensions.reduce((sum, d) =>
  sum + (d.score * d.weight / totalWeight), 0)
```

#### What Counts as "Has Data"

| Dimension | "Has Data" if |
|-----------|---------------|
| Role | `person.title` is not null OR `person.role` is not null |
| Org | `person.company` is not null OR `person.organizations` is not null |
| Size | `person.organizations?.size_range` is not null |

#### Confidence Becomes Informational

Confidence no longer multiplies the score. Instead it's stored alongside the score to tell the user "how much data backed this":

- 3/3 dimensions scored → confidence = 1.0
- 2/3 dimensions scored → confidence = 0.67
- 1/3 dimensions scored → confidence = 0.33
- 0/3 dimensions scored → confidence = 0 (score = null, band = null)

#### When Criteria Are Empty

If the user hasn't set a particular criterion (e.g., `target_company_sizes = []`), that dimension is **skipped entirely** — it doesn't contribute as 0.5 neutral. This prevents empty criteria from inflating scores.

#### Band Thresholds (unchanged)

- >= 0.85 → HIGH
- >= 0.65 → MEDIUM
- >= 0.40 → LOW
- < 0.40 → null

### Files to Modify

**`app/features/people/services/calculateICPScore.server.ts`**

1. Replace `calculateConfidence()` function — now based on dimensions scored, not data completeness
2. Replace the weighted average in `calculateICPScore()` — dynamic weights
3. Update `scoreRoleMatch`, `scoreOrgMatch`, `scoreSizeMatch` — return `{ score, matched, hasData }` instead of using neutral 0.5 for empty criteria
4. Handle edge case: 0 dimensions have data → return `{ overall_score: null, band: null }`

**`src/trigger/people/scoreICPMatches.ts`**

5. Handle `null` overall_score in upsert — set `score: 0, band: null` when indeterminate
6. Track `indeterminate` count in results alongside processed/updated/skipped/errors

**`app/features/lenses/components/ICPMatchSection.tsx`**

7. Add "Indeterminate" bucket to distribution display
8. Show confidence value in People Scores list (e.g., "67% conf")

### Acceptance Criteria

- [ ] Person with title "Founder" and no other data → scores on role dimension only → gets HIGH or MEDIUM (not zero)
- [ ] Person with no data at all → score = null, band = null, shows as "Insufficient data" not "No match"
- [ ] Empty criteria dimension is skipped (doesn't inflate or deflate)
- [ ] Confidence reflects how many dimensions were actually scored (0.33/0.67/1.0)
- [ ] Re-scoring Rick's 31 people produces meaningful distribution (not all NONE)

---

## Stream B: People Data Enrichment Tool

> **Separate agent will build this.** Spec here for context and interface contract.

### Concept

A Mastra agent tool that takes a person record and researches them via web to fill missing fields.

### Interface

```typescript
// Tool: enrich-person-data
// Input:
{
  personId: string
  accountId: string
  // Optional hints to help the search:
  knownName?: string
  knownEmail?: string
  knownCompany?: string
  knownLinkedIn?: string
}

// Output:
{
  enriched: boolean
  fieldsUpdated: string[]  // e.g., ["title", "company", "role"]
  source: string           // e.g., "linkedin", "company_website", "web_search"
  confidence: number       // 0-1 how confident in the enrichment
  data: {
    title?: string
    role?: string
    company?: string
    industry?: string
    companySize?: string
    linkedinUrl?: string
  }
}
```

### Batch Mode

A Trigger.dev task `people.enrich-batch` that:
1. Queries people with missing key fields (no title AND no company)
2. Calls the enrichment tool for each
3. Updates `people` table with results
4. Sets `source` metadata to distinguish AI-enriched vs user-entered data
5. Optionally re-triggers ICP scoring after enrichment

### UI Integration

- "Enrich Data" button on `ICPMatchSection` data quality warning
- Shows progress toast
- After completion, re-triggers ICP scoring
- In people list, enriched fields show subtle indicator (e.g., sparkle icon or "AI" badge)

### Guardrails

- Never overwrite user-entered data (only fill nulls)
- Rate limit: max 50 lookups per batch
- Store enrichment timestamp and source for audit
- User can reject/undo enrichment per person

---

## Implementation Order

1. **Algorithm fix** (Stream A, steps 1-6) — immediate, unblocks meaningful scoring
2. **UI updates** (Stream A, step 7-8) — show indeterminate state + confidence
3. **Enrichment tool** (Stream B) — separate agent, parallel work
4. **Enrichment UI** (Stream B UI) — "Enrich Data" button integration
5. **Re-score after enrich** — wire enrichment → scoring pipeline

---

## Testing

### Manual Verification

After algorithm fix:
```sql
-- Should see more varied distribution
SELECT band, COUNT(*)
FROM person_scale
WHERE kind_slug = 'icp_match' AND project_id = '{projectId}'
GROUP BY band;

-- Check a person with only title
SELECT p.name, p.title, ps.score, ps.band, ps.confidence
FROM person_scale ps
JOIN people p ON p.id = ps.person_id
WHERE ps.kind_slug = 'icp_match'
AND p.title IS NOT NULL
ORDER BY ps.score DESC;
```

### Unit Tests

```
calculateICPScore.server.test.ts:
- Person with only title matching target_role → HIGH (role-only scoring)
- Person with company matching target_org, no title → MEDIUM (org-only)
- Person with no data at all → null score, null band
- Empty target_roles → role dimension skipped entirely
- All 3 dimensions present → uses standard weights (0.4, 0.3, 0.3)
- Confidence = dimensions_scored / total_criteria_dimensions
```
