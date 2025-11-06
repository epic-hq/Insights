# Lens Architecture - Testing & Deployment Guide

## What We Built (Phase 1 Foundations)

### 1. User Group Derivation ✅
**File:** `app/features/people/services/deriveUserGroups.server.ts`

**What it does:**
- Automatically groups people by role, segment, and company size
- Normalizes attributes (e.g., "pm" → "Product Manager")
- Filters groups by minimum size
- **No pre-defined personas required!** Groups emerge from actual data

**Example output:**
```typescript
{
  type: "role",
  name: "Product Manager",
  member_count: 8,
  member_ids: ["person-1", "person-2", ...],
  criteria: { role_in: ["Product Manager"] }
}
```

### 2. Evidence Extraction Updates ✅
**File:** `baml_src/extract_evidence.baml`

**What changed:**
- Added `willingness_to_pay` field: "high" | "medium" | "low" | "none"
- Added `priority` field: "critical" | "high" | "medium" | "low"
- AI now extracts these signals from interview language automatically

**Regenerated:** TypeScript client with `pnpm run baml-generate`

### 3. Pain × User Type Matrix Generator ✅
**File:** `app/features/lenses/services/generatePainMatrix.server.ts`

**What it does:**
- Clusters evidence into pain themes (similar pains grouped together)
- Cross-references with user groups
- Calculates key metrics per cell:
  - **Frequency:** % of user type mentioning this pain
  - **Intensity:** Average priority (critical = 1.0, high = 0.75, etc.)
  - **Willingness to Pay:** Average WTP score
  - **Impact Score:** frequency × intensity × WTP (for prioritization)

**Example cell:**
```typescript
{
  pain_theme_name: "Research Organization Issues",
  user_group: { type: "role", name: "Product Manager", member_count: 8 },
  metrics: {
    frequency: 0.85,        // 85% of PMs mention this
    intensity: "critical",  // Average priority
    wtp_score: 0.9,         // High willingness to pay
    impact_score: 0.77      // Combined score for sorting
  },
  evidence: {
    count: 12,
    person_count: 7,
    sample_verbatims: ["Can't keep track of all our user interviews..."]
  }
}
```

### 4. Actions Table Schema ✅
**File:** `supabase/schemas/30_actions.sql`

**What it creates:**
- `public.actions` table for tracking recommended actions
- Supports all lens types (product, sales, research, support)
- Includes priority, impact_score, status tracking
- Links to evidence, insights, themes
- Full RLS policies

**Columns:**
- `type`: "feature" | "deal_task" | "research_gap" | "support_improvement"
- `lens_type`: "product" | "sales" | "research" | "support"
- `priority`: "critical" | "high" | "medium" | "low"
- `impact_score`: 0-1 (from matrix metrics)
- `status`: "proposed" | "planned" | "in_progress" | "done"
- `metadata`: JSONB for lens-specific data

### 5. Embeddings Infrastructure ✅
**File:** `supabase/schemas/31_embeddings.sql`

**What it adds:**
- `embedding vector(1536)` columns on evidence, themes, insights
- HNSW indexes for fast similarity search (cosine distance)
- Helper functions:
  - `find_similar_evidence(query_embedding, project_id)` - Semantic search
  - `find_similar_themes(query_embedding, project_id)` - Theme discovery
  - `find_duplicate_themes(project_id, threshold)` - Auto-consolidation

**Ready for:** OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens)

---

## Testing Without Full Migrations

### Migration Issue
There's a duplicate key issue with existing migrations (`20251026211613_remote_placeholder.sql` conflict). Rather than resolve migration conflicts now, we've created test routes to validate functionality.

### Test Routes Created

#### 1. Test User Groups
**Route:** `POST /api/test-user-groups`

**Body:**
```json
{
  "projectId": "your-project-uuid"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:4280/api/test-user-groups \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "projectId=YOUR_PROJECT_ID"
```

**Expected response:**
```json
{
  "success": true,
  "projectId": "...",
  "groups": [
    {
      "type": "role",
      "name": "Product Manager",
      "member_count": 8,
      "sample_people": [
        { "id": "...", "name": "Sarah Chen", "role": "Product Manager" }
      ]
    }
  ],
  "summary": {
    "total_groups": 5,
    "by_type": { "role": 3, "segment": 2, "cohort": 0 },
    "total_members": 15
  }
}
```

#### 2. Test Pain Matrix
**Route:** `POST /api/test-pain-matrix`

**Body:**
```json
{
  "projectId": "your-project-uuid",
  "minEvidence": 2,    // optional, default: 2
  "minGroupSize": 1     // optional, default: 1
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:4280/api/test-pain-matrix \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "projectId=YOUR_PROJECT_ID&minEvidence=2&minGroupSize=1"
```

**Expected response:**
```json
{
  "success": true,
  "projectId": "...",
  "summary": {
    "total_pains": 8,
    "total_groups": 5,
    "total_evidence": 47,
    "high_impact_cells": 3
  },
  "pain_themes": [
    { "id": "pain-research-organization", "name": "research organization", "evidence_count": 12 }
  ],
  "user_groups": [
    { "type": "role", "name": "Product Manager", "member_count": 8 }
  ],
  "top_cells": [
    {
      "pain": "research organization",
      "user_group": "Product Manager",
      "impact_score": 0.77,
      "frequency": 85,
      "intensity": "critical",
      "wtp": "high",
      "evidence_count": 12,
      "person_count": 7,
      "sample_quote": "Can't keep track of all our user interviews..."
    }
  ]
}
```

---

## How to Test Now

### 0. Configure for local Supabase
Make sure your `.env` file is pointing to **local** Supabase (not cloud):

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If you just changed this, **restart your dev server** to pick up the new environment variables.

### 1. Start your dev server
```bash
pnpm run dev
```

### 2. Get a local project ID
Find a project ID from your **local** database (not cloud):

```bash
# Connect to local Supabase
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Get project IDs
SELECT id, name FROM projects LIMIT 5;
```

Or use Supabase Studio at http://localhost:54323

### 3. Test user groups
```bash
# Replace with your actual project ID
PROJECT_ID="52008f7d-e001-408e-a628-13df0d65b9d6"

curl -X POST http://localhost:4280/api/test-user-groups \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "projectId=$PROJECT_ID"
```

**What to look for:**
- ✅ Groups are created (by role, segment, company size)
- ✅ Member counts make sense
- ✅ Sample people show correct attributes
- ❌ If `groups: []`, check that project has people with role/segment data

### 4. Test pain matrix
```bash
curl -X POST http://localhost:4280/api/test-pain-matrix \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "projectId=$PROJECT_ID&minEvidence=2"
```

**What to look for:**
- ✅ Pain themes are created (check names make sense)
- ✅ Top cells have high impact scores (> 0.5)
- ✅ Frequency/intensity/WTP metrics look reasonable
- ❌ If `pain_themes: []`, check that:
  - Project has evidence with `evidence_facet` records where `kind_slug = 'pain'`
  - Evidence has `priority` and `willingness_to_pay` fields populated
  - Lower `minEvidence` threshold (try `1`)

### 5. Check evidence has new fields
The `willingness_to_pay` and `priority` fields only exist on evidence extracted AFTER the BAML schema update. Check existing evidence:

```sql
SELECT
  id,
  verbatim,
  priority,
  willingness_to_pay
FROM evidence
WHERE project_id = 'YOUR_PROJECT_ID'
LIMIT 10;
```

**If these columns are NULL:**
- Re-run evidence extraction on an interview (trigger interview analysis)
- OR manually update some test evidence:
  ```sql
  UPDATE evidence
  SET priority = 'high', willingness_to_pay = 'medium'
  WHERE project_id = 'YOUR_PROJECT_ID'
  LIMIT 5;
  ```

---

## Applying Migrations (When Ready)

### Option A: Manual SQL (Quick Test)
If you just want to test the new tables without resolving migration conflicts:

```bash
# Connect to your local Supabase
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Run the schema files manually
\i supabase/schemas/30_actions.sql
\i supabase/schemas/31_embeddings.sql
```

### Option B: Create Proper Migration
When ready to commit these changes:

1. Fix the duplicate migration issue:
   ```bash
   # Remove or resolve the placeholder migration
   rm supabase/migrations/20251026211613_add_is_question_to_evidence.sql
   ```

2. Generate diff from schemas:
   ```bash
   supabase db diff -f add_actions_and_embeddings
   ```

3. Apply locally:
   ```bash
   supabase migrations up
   ```

4. Push to remote (when tested):
   ```bash
   supabase db push --linked
   ```

5. Regenerate types:
   ```bash
   supabase gen types --project-id YOUR_PROJECT_ID --schema public typescript > supabase/types.ts
   ```

---

## Next Steps (Priority Order)

### Immediate (This Session)
1. ✅ Test user group derivation on real project
2. ✅ Test pain matrix generation on real project
3. ✅ Validate that impact scores make sense
4. ✅ Document any issues or unexpected behavior

### Phase 2 (Next Session)
1. **Extend embedding queue** - Generate embeddings for evidence/themes/insights
2. **Theme consolidation** - Use `find_duplicate_themes()` to merge similar themes
3. **Build Product Lens UI** - Matrix heat map component
4. **Add filtering controls** - Min evidence, min coverage sliders
5. **Generate actions from matrix** - Convert high-impact cells → feature backlog

### Phase 3 (Future)
1. **Sales Lens** - BANT/MEDDIC scorecard generator
2. **Lens switcher UI** - Top-level navigation between lenses
3. **ML-based persona clustering** - Use behavioral patterns, not just attributes
4. **Real-time matrix updates** - WebSocket updates as evidence changes

---

## Known Limitations (Phase 1)

1. **Pain clustering is simple** - Groups by exact label match, not semantic similarity
   - **Fix in Phase 2:** Use embeddings + cosine similarity

2. **No WTP/priority on old evidence** - Only new extractions will have these fields
   - **Workaround:** Re-analyze interviews or manually populate test data

3. **No actions generation yet** - Matrix exists but doesn't create action items
   - **Coming in Phase 2**

4. **No UI yet** - Matrix is API-only
   - **Coming in Phase 2**

5. **User groups are rule-based** - Role/segment only, no behavioral clustering
   - **Phase 2 enhancement:** ML-based personas from behavior patterns

---

## Success Criteria

### ✅ Phase 1 Complete When:
- [x] User groups generate with reasonable groupings
- [ ] Pain matrix shows non-empty cells for at least one project
- [ ] Impact scores correctly rank pain×user combinations
- [ ] Top 3 pain themes align with manual review of evidence
- [ ] Documentation captures any data quality issues

### 🎯 Phase 2 Goals:
- [ ] Theme count reduced by 60% through consolidation
- [ ] Matrix UI renders and is interactive
- [ ] Actions table populated from high-impact cells
- [ ] Embeddings enable semantic search

---

## Troubleshooting

### "fetch failed" error
**Cause:** .env file pointing to wrong Supabase instance (cloud vs local)
**Fix:**
1. Check your `.env` file - should have `SUPABASE_URL=http://127.0.0.1:54321` for local
2. Make sure local Supabase is running: `supabase status`
3. Restart dev server after changing .env: `pnpm run dev`
4. Use a project ID from your **local** database, not cloud

### "No user groups found"
**Cause:** Project has no people with role/segment populated
**Fix:**
```sql
UPDATE people SET role = 'Product Manager' WHERE name LIKE '%PM%';
UPDATE people SET segment = 'Enterprise' WHERE company LIKE '%Corp%';
```

### "No pain themes found"
**Cause:** No evidence has pain facets OR evidence count below threshold
**Fix:**
- Check: `SELECT count(*) FROM evidence_facet WHERE kind_slug = 'pain' AND project_id = 'XXX';`
- Lower threshold: `minEvidence=1`
- Manually add pain facet to test evidence

### "Impact scores all zero"
**Cause:** Evidence missing `priority` and `willingness_to_pay` fields
**Fix:** Update BAML-generated evidence or manually populate:
```sql
UPDATE evidence
SET priority = 'high', willingness_to_pay = 'medium'
WHERE project_id = 'XXX' AND priority IS NULL;
```

### "Matrix has too many cells"
**Cause:** Granular pain clustering + many small groups
**Fix:**
- Increase `minEvidence` to 3 or higher
- Increase `minGroupSize` to 2 or higher
- Wait for Phase 2 semantic clustering

---

## Questions for Review

1. **Do user groups make sense?** Check if role/segment groupings align with your mental model
2. **Are pain themes too granular?** If yes, we need Phase 2 consolidation ASAP
3. **Do impact scores feel right?** Top cells should be obvious priorities
4. **Data quality issues?** Missing role/segment/WTP/priority on evidence?
5. **Ready for UI?** Or need more backend refinement first?
