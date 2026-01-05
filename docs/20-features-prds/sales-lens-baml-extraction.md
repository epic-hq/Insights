# Sales Lens BAML Extraction

## Overview

The Sales Lens feature extracts structured sales qualification data from interview evidence using BAML (Boundary ML) AI extraction. It analyzes conversation evidence to identify budget constraints, decision-making authority, customer needs, timelines, and stakeholder dynamics.

## Supported Frameworks

- **BANT_GPCT**: Budget, Authority, Need, Timeline + Goals, Plans, Challenges, Timeline
- **MEDDIC**: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion
- **SPICED**: Situation, Pain, Impact, Critical Event, Decision
- **MAP**: Metrics, Action Plan, People

Currently, only **BANT_GPCT** is fully implemented with BAML extraction.

## Architecture

### Extraction Flow

1. **Evidence Loading** (`app/lib/sales-lens/baml-extraction.server.ts`)
   - Loads ALL evidence from the interview (no semantic pre-filtering)
   - Formats evidence as JSON for BAML
   - Includes: verbatim quotes, gist summaries, pain/gain/think/feel tags

2. **BAML Extraction** (`baml_src/sales_lens_extraction.baml`)
   - Uses GPT-4o to analyze evidence
   - Extracts structured BANT data with confidence scores
   - Returns: budget info, authority structure, needs analysis, timeline, next steps, stakeholders, deal qualification

3. **Schema Transformation** (`app/lib/sales-lens/baml-extraction.server.ts`)
   - Converts BAML output to database schema format
   - Maps stakeholders to existing people records
   - Creates evidence references for traceability
   - Validates all fields match database constraints

4. **Storage** (`app/lib/sales-lens/storage.server.ts`)
   - Saves to `sales_lens_summaries`, `sales_lens_slots`, `sales_lens_stakeholders`
   - Stores hygiene events (warnings, blockers, red flags)
   - Links evidence pieces with timestamps

### Key Components

**BAML Schema** (`baml_src/sales_lens_extraction.baml`)
```
class BudgetInfo {
  has_budget_discussion bool
  amount_mentioned string?
  budget_status string?
  pricing_sensitivity string  // high, medium, low
  payment_terms string?
  confidence float
  supporting_quote string?
  evidence_ids string[]
}

class AuthorityInfo {
  decision_maker_identified bool
  decision_maker_name string?
  decision_maker_role string?
  approval_process string?
  stakeholders_involved string[]
  blockers string[]
  political_dynamics string?
  confidence float
  evidence_ids string[]
}

// ... and more
```

**Extraction Function** (`app/lib/sales-lens/baml-extraction.server.ts`)
```typescript
export async function buildSalesLensFromEvidence(
  db: DbClient,
  interviewId: string
): Promise<SalesConversationExtraction>
```

**Storage Schema** (`app/lib/sales-lens/schema.ts`)
```typescript
export const salesConversationExtractionSchema = z.object({
  meetingId: z.string().uuid(),
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  frameworks: z.array(salesFrameworkSchema),
  entities: z.object({
    stakeholders: z.array(stakeholderSchema),
    objections: z.array(objectionSchema),
  }),
  nextStep: nextStepSchema,
  // ...
})
```

## Database Tables

### sales_lens_summaries
Stores high-level framework metadata per interview.

Key fields:
- `framework`: BANT_GPCT, MEDDIC, etc.
- `interview_id`: Source interview
- `computed_at`: Extraction timestamp
- `metadata`: JSON with slot counts, quality scores
- `hygiene_summary`: Framework-level warnings/issues

### sales_lens_slots
Individual data points within a framework (budget, authority, need, timeline, next steps).

Key fields:
- `slot`: Field name (e.g., "budget", "authority", "timeline")
- `summary`: Human-readable summary
- `text_value`: Primary text content
- `date_value`: Dates in YYYY-MM-DD format
- `confidence`: 0-1 confidence score
- `evidence_refs`: JSONB array linking to evidence pieces
- `hygiene`: Slot-specific warnings (e.g., blockers)

### sales_lens_stakeholders
People identified in the buying process with their roles and influence.

Key fields:
- `display_name`: Person's name as mentioned
- `person_id`: Link to `people` table (if matched)
- `candidate_person_key`: Fallback name if not matched
- `role`: Job title
- `influence`: low, medium, high
- `labels`: Array of buying roles (economic_buyer, champion, blocker, etc.)
- `evidence_refs`: Supporting evidence

### sales_lens_hygiene_events
Warnings, blockers, and red flags identified during extraction.

Key fields:
- `code`: Issue code (e.g., "warning_flag", "blocker")
- `severity`: info, warning, critical
- `message`: Description
- `slot_id`: Optional link to specific slot

## UI Components

### Sales Lenses Page
**Route**: `app/routes/_protected.projects.$projectId.sales-lenses.tsx`

Displays latest extraction for each framework with:
- BANT slot values with confidence scores
- Evidence traceability - clickable links to source evidence
- Stakeholder matrix with roles and influence
- Hygiene warnings (blockers, red flags)
- Refresh button to re-run extraction

**Key Features**:
- Evidence links show transcript snippets and timestamps
- Stakeholder cards show linked person records
- Confidence badges indicate extraction quality
- Framework-specific rendering

## Running Extraction

### Manual Trigger
Click "Apply Lenses" button in the UI (interview detail page or sales lenses page).

### API Endpoint
```typescript
POST /api/generate-sales-lens
{
  "interviewId": "uuid"
}
```

### Trigger.dev Task
```typescript
import { generateSalesLensTask } from "~/trigger/sales/generateSalesLens"

await generateSalesLensTask.trigger({
  interviewId: "uuid",
  computedBy: userId || null
})
```

### Fallback Behavior
If BAML extraction fails (schema validation, missing data, API errors), the system falls back to heuristic extraction:
- Matches stakeholder names to interview participants
- Extracts basic timeline from conversation
- Lower confidence scores
- Limited next steps and qualification signals

## Evidence Traceability

Every slot and stakeholder includes `evidence_refs` linking back to the source evidence:

```typescript
{
  evidenceId: string      // UUID of evidence record
  startMs: number?        // Timestamp in transcript
  endMs: number?          // End timestamp
  transcriptSnippet: string?  // Quote preview
}
```

**UI Display**:
- Slots show "Supporting Evidence" section with clickable snippets
- Stakeholders show evidence timestamps as badges
- Links navigate to evidence detail page with highlighted quotes

## Configuration

### BAML Client
Generated from `baml_src/*.baml` files:
```bash
npx baml-cli generate
```

Output: `baml_client/` (TypeScript bindings)

### Model Selection
Configured in `baml_src/clients.baml`:
```
client CustomGPT4o {
  provider openai
  options {
    model gpt-4o
    api_key env.OPENAI_API_KEY
  }
}
```

## Troubleshooting

### BAML Extraction Failing
1. Check Trigger.dev logs for validation errors
2. Verify evidence exists for interview: `SELECT COUNT(*) FROM evidence WHERE interview_id = ?`
3. Check BAML client is up to date: `npx baml-cli generate`
4. Review schema validation errors in logs

### No Evidence Links Showing
1. Verify `evidence_refs` populated: `SELECT evidence_refs FROM sales_lens_slots WHERE id = ?`
2. Check UI passes `evidenceRefs` to slot component
3. Confirm evidence IDs are valid UUIDs

### Stakeholders Not Displaying
1. Check stakeholder records exist: `SELECT * FROM sales_lens_stakeholders WHERE summary_id = ?`
2. Verify either `person_id` OR `candidate_person_key` is set (required by schema)
3. Check UI loader includes `sales_lens_stakeholders` in select query

### Dates Not Formatting
Dates must match `YYYY-MM-DD` regex. BAML may return dates like "Q1 2026" - these are stored as `null` dateValue and kept in `textValue` or `summary`.

## Future Enhancements

- [ ] Add MEDDIC, SPICED, MAP extraction logic
- [ ] Multi-framework comparison view
- [ ] CRM sync (commit button currently disabled)
- [ ] Opportunity auto-creation from qualified lenses
- [ ] Timeline visualization of stakeholder interactions
- [ ] Evidence clustering by theme before extraction
- [ ] Custom framework definitions
