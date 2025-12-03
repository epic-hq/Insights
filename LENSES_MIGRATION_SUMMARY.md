# Conversation Lenses Migration - Summary

## ✅ Completed Tasks

### 1. Database Migration Created and Applied

**File**: `supabase/migrations/20251202140000_conversation_lenses.sql`

**What was created**:
- ✅ `conversation_lens_templates` table - Stores reusable lens definitions
- ✅ `conversation_lens_analyses` table - Stores analysis results when lens is applied
- ✅ Seeded 4 initial templates:
  - **Customer Discovery** - Problem/solution validation for product development
  - **User Testing** - Usability evaluation and feature feedback
  - **Sales BANT** - Qualify opportunities (Budget, Authority, Need, Timeline)
  - **Empathy Map / JTBD** - User motivations and jobs-to-be-done
- ✅ Row-level security policies configured
- ✅ Indexes for performance
- ✅ Applied to local database
- ✅ Pushed to remote database

### 2. Documentation Created

**Files**:
- ✅ `CONVERSATION_LENSES.md` - Comprehensive architecture documentation
  - Explains lenses concept and benefits
  - Database schema details
  - Template definitions for all 4 initial lenses
  - Migration strategy from sales lenses
  - Clarification on conversations vs interviews tables
  - Evidence-based analysis approach
  - Next steps roadmap

### 3. Conversations vs Interviews Clarification

**Key Finding**: Only `interviews` table exists and should be used.

**History**:
- `conversation_analyses` table was created temporarily (20251110)
- It was **dropped** in migration 20251120130000 because it duplicated functionality
- **Going forward**: All conversation analysis references `interviews` table via `conversation_lens_analyses.interview_id`

## 🔧 Migration Strategy

### Old Structure (Sales-Only)
```
sales_lens_summaries
├── framework (enum: BANT_GPCT, SPICED, MEDDIC, MAP)
├── sales_lens_slots (separate table)
├── sales_lens_stakeholders (separate table)
└── sales_lens_hygiene_events (separate table)
```

**Limitations**: Hardcoded sales frameworks, inflexible, complex joins

### New Structure (Generic Lenses)
```
conversation_lens_templates (reusable definitions)
└── conversation_lens_analyses (applied analyses)
    └── analysis_data JSONB (sections/fields/entities)
```

**Benefits**:
- Template library approach
- Support any conversation type
- JSONB flexibility
- Simpler queries
- Multiple lenses per interview

### Data Preservation
- ✅ Existing `sales_lens_*` tables remain intact (no data loss)
- ✅ Future migration will transform sales lens data to new structure
- ✅ Gradual phase-out planned

## 📊 Database Schema Overview

### `conversation_lens_templates`
```sql
template_key           text PRIMARY KEY         -- 'customer-discovery'
template_name          text NOT NULL            -- 'Customer Discovery'
summary                text                     -- Brief description
primary_objective      text                     -- What this lens achieves
template_definition    jsonb NOT NULL           -- Sections/fields structure
is_active              boolean DEFAULT true
category               text                     -- 'research', 'sales', 'product'
display_order          integer DEFAULT 100
created_at/updated_at  timestamptz
```

**Template Definition Example**:
```json
{
  "sections": [
    {
      "section_key": "problem_validation",
      "section_name": "Problem Validation",
      "fields": [
        {
          "field_key": "problem_statement",
          "field_name": "Primary Problem",
          "field_type": "text",
          "description": "What is the main problem?"
        }
      ]
    }
  ],
  "entities": ["stakeholders", "objections"],
  "recommendations_enabled": true
}
```

### `conversation_lens_analyses`
```sql
id                    uuid PRIMARY KEY
interview_id          uuid NOT NULL              -- Which interview
template_key          text NOT NULL              -- Which lens applied
account_id            uuid NOT NULL
project_id            uuid
analysis_data         jsonb NOT NULL             -- Extracted data
confidence_score      float (0-1)                -- Overall confidence
auto_detected         boolean DEFAULT false      -- Auto vs manual
user_goals            text[]                     -- User's objectives
icp_context           jsonb                      -- Ideal customer profile
custom_instructions   text                       -- User guidance
status                text DEFAULT 'pending'     -- processing state
processed_at          timestamptz
created_at/updated_at timestamptz
```

**Analysis Data Example**:
```json
{
  "sections": [
    {
      "section_key": "problem_validation",
      "fields": [
        {
          "field_key": "problem_statement",
          "value": "Users struggle with manual data entry",
          "confidence": 0.85,
          "evidence_ids": ["uuid1", "uuid2"],
          "anchors": [{"type": "media", "start_ms": 45000, "end_ms": 67000}]
        }
      ]
    }
  ],
  "entities": {
    "stakeholders": [...],
    "objections": [...]
  },
  "recommendations": [...]
}
```

## 📋 Next Steps (Pending Implementation)

### Phase 2: BAML Functions
```typescript
// To be created in: baml_src/conversation_lenses.baml

class EvidenceForLens {
  evidence_id string
  gist string
  verbatim string
  topic string?
  support string?
  facets string[]
  anchors MediaAnchor[]
  speaker_person_id string?
}

function ApplyConversationLens(
  template_definition: string,
  evidence_items: EvidenceForLens[],
  interview_context: string,
  user_goals: string[],
  icp_description: string,
  custom_instructions: string?
) -> ConversationLensAnalysis

function DetectConversationLens(
  interview_context: string,
  evidence_summary: string,
  project_type: string?
) -> DetectedLens[]
```

### Phase 3: UI Components
- `app/features/lenses/components/LensView.tsx` - Renders lens sections
- `app/features/lenses/components/LensField.tsx` - Individual field with evidence links
- `app/features/lenses/components/LensSelector.tsx` - Dropdown to apply/switch lenses

### Phase 4: Pipeline Integration
- Update interview processing to trigger lens analysis
- Create Trigger.dev task for lens application
- Add lens detection step
- Wire into existing interview detail page

### Phase 5: Data Migration
- Migrate existing `sales_lens_summaries` to `conversation_lens_analyses`
- Map BANT/SPICED/MEDDIC frameworks to `sales-bant` template
- Transform slots → analysis_data JSONB structure
- Eventually deprecate old tables

## 🎯 Key Design Decisions

### 1. Evidence-Based Analysis
**Decision**: Use pre-extracted evidence records as BAML input instead of raw transcript

**Rationale**:
- Faster processing (smaller payload)
- Cheaper (fewer tokens)
- Higher quality (evidence already structured)
- Better linking (evidence IDs already exist)
- Incremental re-analysis without re-processing transcript

### 2. JSONB for Flexibility
**Decision**: Store analysis results in JSONB instead of rigid columns

**Rationale**:
- Support any template structure
- Easy to evolve without migrations
- Efficient PostgreSQL JSONB queries
- Simpler schema management

### 3. Template Library Approach
**Decision**: User can apply multiple lenses to same interview

**Rationale**:
- Different stakeholders need different views
- Sales team uses BANT, Product uses Customer Discovery
- Same interview, multiple insights
- No forced single framework

## 🚀 How to Use (Once Implemented)

### 1. Auto-Detection
```typescript
// System detects appropriate lens based on interview context
const detected = await DetectConversationLens({
  interview_context: "Discovery call with enterprise prospect",
  evidence_summary: "Budget discussed, authority unclear",
  project_type: "sales"
})
// Returns: [{ template_key: "sales-bant", confidence: 0.92 }]
```

### 2. Manual Application
```typescript
// User manually selects lens from dropdown
const analysis = await ApplyConversationLens({
  template_key: "customer-discovery",
  interview_id: "uuid",
  user_goals: ["Validate problem", "Assess market size"],
  icp_context: { industry: "SaaS", company_size: "50-200" }
})
```

### 3. Viewing Results
```tsx
<LensView
  analysis={analysis}
  template={template}
  onEvidenceClick={(evidenceId, timestamp) => {
    navigate(`/evidence/${evidenceId}?t=${timestamp}`)
  }}
/>
```

## ✅ Migration Status

- [x] Database schema created
- [x] Initial templates seeded (Customer Discovery, User Testing, Sales BANT, Empathy Map/JTBD)
- [x] Applied to local database
- [x] Pushed to remote database
- [x] Documentation written
- [ ] BAML functions created
- [ ] TypeScript types generated
- [ ] UI components built
- [ ] Pipeline integration
- [ ] Data migration from sales lenses

## 📌 Important Notes

1. **Backward Compatibility**: Existing `sales_lens_*` tables remain unchanged
2. **No Data Loss**: All historical sales lens data preserved
3. **Gradual Rollout**: New lenses will be adopted incrementally
4. **Template Extensibility**: Easy to add new lens types (Marketing, Employee Review, Hiring, etc.)
5. **Multi-Lens Support**: Same interview can have Customer Discovery + Sales BANT + Empathy Map analyses

## 🔗 Related Files

- `supabase/migrations/20251202140000_conversation_lenses.sql` - Migration
- `CONVERSATION_LENSES.md` - Architecture documentation
- `app/utils/salesLens.server.ts` - Current sales lens logic (to be phased out)
- `app/features/lenses/components/ConversationLenses.tsx` - Current UI (to be refactored)
- `baml_src/conversation_analysis.baml` - Existing conversation analysis (reference)

---

**Created**: 2025-12-02
**Status**: Phase 1 Complete ✅ (Database infrastructure ready)
**Next**: Phase 2 - BAML Functions
