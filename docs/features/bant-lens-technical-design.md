# BANT Lens - Technical Design

## Architecture Overview

The BANT Lens implements a **Budget × Authority qualification matrix** for sales opportunities, following the same pattern as Product Lens (Pain × User matrix).

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer: BantMatrix.tsx + bant-lens.tsx                   │
│  - Heat map visualization                                    │
│  - Cell drill-down modals                                    │
│  - Summary statistics                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Service Layer: generateBantMatrix.server.ts                │
│  - Aggregates opportunities by Budget × Authority            │
│  - Maps amounts to budget buckets                            │
│  - Maps stakeholder influence to authority levels            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Extraction Layer: salesLens.server.ts                      │
│  - buildInitialSalesLensExtraction()                         │
│  - Extracts BANT slots from evidence                         │
│  - Identifies stakeholders and influence                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Data Layer: PostgreSQL/Supabase                            │
│  - opportunities (base entity)                               │
│  - sales_lens_summaries (interview → opportunity link)       │
│  - sales_lens_slots (BANT fields)                            │
│  - sales_lens_stakeholders (authority data)                  │
│  - evidence (source of truth for structured data)            │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### 1. Opportunities Table
**Schema**: `supabase/schemas/32_opportunities.sql`

```sql
create table opportunities (
  id uuid primary key,
  account_id uuid not null,
  project_id uuid not null,
  title text not null,
  organization_id uuid references organizations,
  primary_contact_id uuid references people,

  -- Sales fields
  stage text,                    -- Custom sales stage
  amount numeric,                -- Deal size (forecast)
  close_date date,               -- Expected close
  kanban_status text,            -- Explore/Validate/Build

  -- Metadata
  source text,                   -- manual/crm/import
  crm_external_id text,          -- CRM integration
  related_insight_ids uuid[],    -- Links to insights

  created_at timestamptz,
  updated_at timestamptz
);
```

**Key Fields**:
- `amount`: Used as fallback for Budget if no explicit budget slot
- `organization_id`: Links to company for stakeholder context
- `kanban_status`: Product-style opportunity stages (not traditional sales funnel)

### 2. Sales Lens Summaries
**Schema**: `supabase/schemas/33_sales_lens.sql`

Links interviews to opportunities and stores framework-specific data:

```sql
create table sales_lens_summaries (
  id uuid primary key,
  account_id uuid not null,
  project_id uuid not null,
  interview_id uuid not null references interviews,
  opportunity_id uuid references opportunities,

  framework text not null,       -- 'BANT_GPCT', 'MEDDIC', etc.
  hygiene_summary jsonb,         -- Quality metrics
  metadata jsonb,

  -- Attendee tracking
  attendee_person_ids uuid[],
  attendee_person_keys text[],
  attendee_unlinked text[],      -- Unresolved attendees

  created_at timestamptz
);
```

**Unique Constraint**: `(interview_id, framework)` - one summary per framework per interview

### 3. Sales Lens Slots
**Schema**: `supabase/schemas/33_sales_lens.sql`

Stores individual BANT fields extracted from interviews:

```sql
create table sales_lens_slots (
  id uuid primary key,
  account_id uuid not null,
  project_id uuid not null,
  summary_id uuid not null references sales_lens_summaries,

  slot text not null,            -- 'budget', 'authority', 'need', 'timeline'
  summary text,                  -- Human-readable description

  -- Typed values
  text_value text,               -- "$500K", "Q2 2025"
  numeric_value numeric,         -- 500000
  date_value date,               -- 2025-06-30

  -- Metadata
  status text,                   -- discovered/validated/committed
  confidence numeric,            -- 0.0-1.0 extraction confidence

  -- Entity links
  owner_person_id uuid references people,
  related_person_ids uuid[],
  related_organization_ids uuid[],

  -- Evidence trail
  evidence_refs jsonb,           -- Links to source evidence
  hygiene jsonb,                 -- Quality checks

  created_at timestamptz
);
```

**Slot Types**:
- `budget`: Deal size, budget allocation
- `authority`: Decision-maker level (stored as text, mapped to influence)
- `need`: Business problem, pain points
- `timeline`: Implementation timeline, urgency

### 4. Sales Lens Stakeholders
**Schema**: `supabase/schemas/33_sales_lens.sql`

Captures decision-makers and their influence:

```sql
create table sales_lens_stakeholders (
  id uuid primary key,
  summary_id uuid not null references sales_lens_summaries,

  -- Person identification
  person_id uuid references people,
  person_key text,               -- Unique key for person
  display_name text not null,
  email text,

  -- Stakeholder attributes
  role text,                     -- Job title
  influence text,                -- 'low', 'medium', 'high'
  labels text[],                 -- ['economic_buyer', 'technical_champion']
  organization_id uuid references organizations,

  confidence numeric,            -- 0.0-1.0
  evidence_refs jsonb,

  created_at timestamptz
);
```

**Authority Mapping**:
```typescript
function mapInfluenceToAuthority(influence: string | null): string {
  switch (influence) {
    case "low": return "Low"
    case "medium": return "Medium"
    case "high": return "High"
    default: return "Unknown"
  }
}
```

### 5. Evidence Table (Reference)
**Schema**: `supabase/schemas/31_evidence.sql`

Evidence is the **source of truth** for structured data:

```sql
create table evidence (
  id uuid primary key,
  interview_id uuid references interviews,

  -- Structured content
  kind text not null,            -- Facet kind (pain, gain, need, etc.)
  content text not null,         -- Extracted text
  context text,                  -- Surrounding context

  -- Entity links
  person_ids uuid[],
  organization_ids uuid[],

  -- Metadata
  confidence numeric,
  embedding vector(1536),        -- For semantic search

  created_at timestamptz
);
```

**Why Evidence, Not observations_and_notes?**
- ✅ **Structured**: Typed by `kind` (pain, gain, budget, need)
- ✅ **Linked**: Connected to people, orgs, interviews
- ✅ **Searchable**: Vector embeddings for semantic queries
- ✅ **Versioned**: Immutable audit trail
- ❌ `observations_and_notes` is unstructured free text, not designed for extraction

## Implementation Details

### Budget Extraction
**File**: `app/utils/salesLens.server.ts` (lines 290-330)

```typescript
// 1. Try to get budget from opportunity.amount
const budgetValue = opp.amount ?? null

// 2. If no amount, look for budget in evidence
const budgetEvidence = evidenceByKind.budget?.[0]
if (budgetEvidence) {
  // Extract numeric value from text like "$500K" or "500000"
  const match = budgetEvidence.content.match(/\$?[\d,]+[kKmM]?/)
  budgetValue = parseNumericValue(match[0])
}

// 3. Create budget slot
bantSlots.push({
  slot: "budget",
  summary: budgetText,
  textValue: budgetText,
  numericValue: budgetValue,
  confidence: budgetValue ? 0.8 : 0.3,
  evidence: [evidenceRef]
})
```

**Fallback Chain**: opportunity.amount → evidence (kind=budget) → null

### Authority Extraction
**File**: `app/utils/salesLens.server.ts` (lines 331-367)

```typescript
// 1. Identify stakeholders from interview attendees
const stakeholders = interview.attendees.map(attendee => ({
  displayName: attendee.name,
  role: attendee.job_title,
  influence: inferInfluence(attendee), // Based on title, seniority
  labels: classifyStakeholder(attendee) // economic_buyer, technical_champion
}))

// 2. Find highest authority stakeholder
const economicBuyer = stakeholders.find(s =>
  s.labels.includes("economic_buyer")
)
const primaryStakeholder = economicBuyer ?? stakeholders[0]

// 3. Create authority slot
bantSlots.push({
  slot: "authority",
  summary: `${primaryStakeholder.displayName} (${primaryStakeholder.influence})`,
  textValue: primaryStakeholder.role,
  relatedPersonIds: [primaryStakeholder.personId],
  confidence: primaryStakeholder.personId ? 0.7 : 0.4
})
```

**Influence Inference**: Based on job title keywords (VP, Director, Manager, etc.) and seniority facets

### Matrix Aggregation
**File**: `app/features/lenses/services/generateBantMatrix.server.ts`

```typescript
export async function generateBantMatrix(opts: {
  supabase: SupabaseClient
  projectId: string
}): Promise<BantMatrix> {
  // 1. Fetch all opportunities with BANT data
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select(`
      id, title, amount, stage, close_date,
      sales_lens_summaries!inner(
        id, framework,
        sales_lens_slots(slot, numeric_value, text_value, confidence),
        sales_lens_stakeholders(influence, labels)
      )
    `)
    .eq("project_id", projectId)
    .eq("sales_lens_summaries.framework", "BANT_GPCT")

  // 2. Initialize matrix cells
  const cellMap = new Map<string, BantMatrixCell>()
  for (const budget of BUDGET_BUCKETS) {
    for (const authority of AUTHORITY_LEVELS) {
      cellMap.set(`${budget}|${authority}`, {
        budget_bucket: budget,
        authority_level: authority,
        metrics: { opportunity_count: 0, total_value: 0, ... },
        sample_opportunities: []
      })
    }
  }

  // 3. Aggregate opportunities into cells
  for (const opp of opportunities) {
    const budgetSlot = opp.sales_lens_summaries[0].sales_lens_slots
      .find(s => s.slot === "budget")
    const budgetValue = opp.amount ?? budgetSlot?.numeric_value
    const budgetBucket = mapBudgetToBucket(budgetValue)

    const stakeholders = opp.sales_lens_summaries[0].sales_lens_stakeholders
    const economicBuyer = stakeholders.find(s =>
      s.labels?.includes("economic_buyer")
    )
    const authorityLevel = mapInfluenceToAuthority(
      economicBuyer?.influence ?? stakeholders[0]?.influence
    )

    const key = `${budgetBucket}|${authorityLevel}`
    const cell = cellMap.get(key)
    cell.metrics.opportunity_count++
    cell.metrics.total_value += budgetValue || 0
    // ... update averages, add samples
  }

  return {
    cells: Array.from(cellMap.values()),
    budget_buckets: BUDGET_BUCKETS,
    authority_levels: AUTHORITY_LEVELS,
    summary: { total_opportunities, total_value, cells_with_data }
  }
}
```

**Bucketing Logic**:
```typescript
const BUDGET_BUCKETS = [
  "Unknown", "<$10K", "$10-50K", "$50-100K",
  "$100-250K", "$250K-1M", ">$1M"
]

const AUTHORITY_LEVELS = [
  "Unknown", "Low", "Medium", "High", "Executive"
]
```

## UI Components

### BantMatrix.tsx
**File**: `app/features/lenses/components/BantMatrix.tsx`

Heat map grid with:
- **Rows**: Budget buckets (7)
- **Columns**: Authority levels (5)
- **Cell color**: Based on opportunity count (0-10+ scale)
- **Click handler**: Opens drill-down modal with sample opportunities

### bant-lens.tsx
**File**: `app/features/lenses/pages/bant-lens.tsx`

Route at `/a/:accountId/:projectId/bant-lens`

**Loader**:
```typescript
export async function loader({ context, params }: LoaderFunctionArgs) {
  const supabase = context.get(userContext).supabase
  const projectId = params.projectId

  const matrix = await generateBantMatrix({ supabase, projectId })
  return { matrix, projectId }
}
```

**Component**:
- Shows empty state if no opportunities
- Renders BantMatrix with data
- Modal for selected cell details

## Routes & Navigation

### Route Definition
**File**: `app/features/lenses/routes.ts`

```typescript
route("bant-lens", "./features/lenses/pages/bant-lens.tsx")
```

### Sidebar Integration
**File**: `app/components/navigation/app-sidebar.config.ts` (lines 99-105)

```typescript
{
  key: "bant-lens",
  title: "BANT Lens",
  description: "Budget × authority matrix",
  icon: DollarSign,
  to: (routes) => routes.bantLens(),
}
```

**Location**: Analysis section (below Product Lens, above Findings)

### Missing: Opportunities Navigation
⚠️ **Gap**: Opportunities are NOT in sidebar navigation

**Current State**:
- Opportunities have full CRUD pages (`/opportunities`, `/opportunities/new`, `/opportunities/:id`)
- But no sidebar link to discover them

**Recommendation**: Add to sidebar under Directory or new "Sales" section:
```typescript
{
  key: "opportunities",
  title: "Opportunities",
  description: "Sales pipeline & deals",
  icon: Briefcase, // or Target
  to: (routes) => routes.opportunities.index(),
}
```

## Testing & Seeding

### Test Data Script
**File**: `app/mastra/tools/create-test-opportunities.ts`

Creates 5 opportunities with:
- Diverse amounts: $8K, $15K, $75K, $500K, $1.2M
- Different stages: qualification, discovery, proposal, negotiation
- Links to existing interviews
- Runs BANT extraction via `buildInitialSalesLensExtraction()`

**Usage**:
```bash
npx tsx app/mastra/tools/create-test-opportunities.ts
```

### Verification Script
**File**: `app/mastra/tools/verify-bant-data.ts`

Checks database state:
- Counts opportunities, summaries, slots, stakeholders
- Shows slot breakdown by type
- Displays URLs for testing

**Usage**:
```bash
npx tsx app/mastra/tools/verify-bant-data.ts
```

## Performance Considerations

### Query Optimization
The matrix query uses a single Supabase call with nested selects:
```sql
SELECT
  opportunities.*,
  sales_lens_summaries(
    sales_lens_slots(slot, numeric_value, confidence),
    sales_lens_stakeholders(influence, labels)
  )
WHERE opportunities.project_id = $1
  AND sales_lens_summaries.framework = 'BANT_GPCT'
```

**Indexes**:
- `idx_opportunities_project_id` on opportunities
- `idx_sales_lens_summaries_opportunity` on sales_lens_summaries
- `idx_sales_lens_slots_summary` on sales_lens_slots

**Expected Performance**: <200ms for projects with <1000 opportunities

### Caching Strategy
Currently no caching. Future optimization:
- Cache matrix data in Redis (invalidate on opportunity update)
- Server-side render with stale-while-revalidate

## Security

### Row Level Security (RLS)
All tables have RLS enabled:

```sql
-- Opportunities
create policy "Account members can select" on opportunities
  for select to authenticated
  using (account_id IN (SELECT get_accounts_with_role()))

-- Sales lens tables inherit from opportunities
create policy "Account members can select" on sales_lens_summaries
  for select to authenticated
  using (account_id IN (SELECT get_accounts_with_role()))
```

**Access Control**: Users can only see opportunities for accounts they belong to

### Data Privacy
- Stakeholder data (names, emails) is PII - ensure GDPR compliance
- Evidence chunks may contain sensitive competitive intel - audit access logs
- BANT confidence scores are internal only - don't expose to external APIs

## Future Enhancements

### Phase 2: Manual Editing
- UI for correcting BANT slot values
- Audit trail for human edits vs AI extraction
- Bulk update capability

### Phase 3: CRM Integration
- Sync opportunities from Salesforce/HubSpot
- Update BANT data back to CRM
- Bidirectional sync with conflict resolution

### Phase 4: Predictive Scoring
- ML model to predict close probability based on BANT completeness
- Recommend next best actions (e.g., "Get budget confirmation from economic buyer")
- Anomaly detection (e.g., high budget but low authority → risky deal)

### Phase 5: Temporal Analysis
- Track how BANT scores change over time
- Measure qualification velocity
- Identify stuck opportunities

## Related Systems

### Product Lens
Similar matrix pattern (Pain × User) but for product decisions:
- **Service**: `generatePainMatrix.server.ts`
- **UI**: `PainMatrix.tsx`
- **Data**: Evidence with `kind=pain` + person facets

**Code Reuse**: Both lenses share matrix rendering patterns

### Segments
Facet-based user grouping using same infrastructure:
- **Service**: `deriveUserGroups.server.ts`
- **Data**: `person_facet` + `facet_kind_global`
- **Filter**: BANT Lens could filter by segment (e.g., "Show only Enterprise persona")

### Evidence System
Source of truth for structured interview data:
- **Processing**: AI extracts evidence during transcript analysis
- **Storage**: Typed chunks with embeddings
- **Search**: Vector similarity for related evidence

## Troubleshooting

### "No BANT data available"
**Cause**: No opportunities have linked interviews with sales lens summaries

**Fix**:
1. Create opportunities at `/opportunities/new`
2. Link interviews to opportunities
3. Run extraction: `buildInitialSalesLensExtraction(supabase, interviewId)`

### "Budget/Authority cells are all Unknown"
**Cause**: Evidence lacks structured budget/authority data

**Fix**:
1. Check if interviews have evidence with `kind=budget`
2. Verify stakeholders have `influence` field populated
3. Improve discovery questions to ask explicitly about budget/authority

### "Duplicate key constraint on sales_lens_summaries"
**Cause**: Trying to create multiple BANT_GPCT summaries for same interview

**Fix**: Each interview can only have one summary per framework. Use upsert or skip if exists:
```typescript
const existing = await supabase
  .from("sales_lens_summaries")
  .select("id")
  .eq("interview_id", interviewId)
  .eq("framework", "BANT_GPCT")
  .single()

if (existing.data) {
  // Update instead of insert
}
```

## References

- [Sales Lens Schema](../supabase/schemas/33_sales_lens.sql)
- [Opportunities Schema](../supabase/schemas/32_opportunities.sql)
- [Evidence Schema](../supabase/schemas/31_evidence.sql)
- [Facets Schema](../supabase/schemas/04_facets.sql)
- [Product Lens Implementation](./product-lens-technical-design.md)
