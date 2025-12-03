# Conversation Lenses Architecture

## Overview

**Conversation Lenses** is a template-based system for analyzing interviews through different analytical frameworks. Instead of being limited to sales-specific analysis, users can apply multiple "lenses" to the same interview to extract different insights.

## Key Concepts

### What is a Lens?

A **Lens** (or **Template**) is a reusable analytical framework that defines:
- **Sections**: Logical groupings of related fields (e.g., "Problem Validation", "BANT Qualification")
- **Fields**: Specific data points to extract (e.g., "Budget", "Timeline", "Pain Points")
- **Entities**: Related data like stakeholders, objections, features mentioned
- **Recommendations**: Next steps, follow-ups, or action items

### Why Lenses?

1. **Flexibility**: Apply the right framework for your conversation type (Discovery, Testing, Sales, etc.)
2. **Reusability**: Same conversation can be analyzed through multiple lenses
3. **Evidence-based**: Each field links back to specific evidence with timestamps
4. **Context-aware**: Recommendations tailored to user goals and ICP
5. **Confidence scoring**: Transparent about extraction quality

## Architecture

### Database Tables

#### `conversation_lens_templates`
Stores the template definitions that can be applied to interviews.

```sql
CREATE TABLE conversation_lens_templates (
    template_key text PRIMARY KEY,          -- e.g., 'customer-discovery'
    template_name text NOT NULL,            -- e.g., 'Customer Discovery'
    summary text,                           -- One-line description
    primary_objective text,                 -- What this lens achieves
    template_definition jsonb NOT NULL,     -- Structure (sections, fields)
    is_active boolean DEFAULT true,
    category text,                          -- e.g., 'research', 'sales'
    display_order integer DEFAULT 100,
    created_at timestamptz,
    updated_at timestamptz
);
```

**Template Definition Structure:**
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

#### `conversation_lens_analyses`
Stores the actual analysis results when a lens is applied to an interview.

```sql
CREATE TABLE conversation_lens_analyses (
    id uuid PRIMARY KEY,
    interview_id uuid NOT NULL,             -- Which interview
    template_key text NOT NULL,             -- Which lens was applied
    account_id uuid NOT NULL,
    project_id uuid,
    analysis_data jsonb NOT NULL,           -- Extracted data
    confidence_score float,                 -- Overall confidence (0-1)
    auto_detected boolean DEFAULT false,    -- Auto vs manual selection
    user_goals text[],                      -- User's stated objectives
    icp_context jsonb,                      -- Ideal customer profile
    custom_instructions text,               -- User-provided guidance
    status text DEFAULT 'pending',
    processed_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
);
```

**Analysis Data Structure:**
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
          "anchors": [
            {
              "type": "media",
              "start_ms": 45000,
              "end_ms": 67000
            }
          ]
        }
      ]
    }
  ],
  "entities": {
    "stakeholders": [...],
    "objections": [...]
  },
  "recommendations": [
    {
      "type": "next_step",
      "description": "Follow up on pricing concerns",
      "priority": "high",
      "owner_person_id": "uuid",
      "evidence_ids": ["uuid"]
    }
  ]
}
```

## Initial Lens Templates

### 1. Customer Discovery
**Purpose**: Validate problem-solution fit and gather insights for product development

**Sections**:
- **Problem Validation**: Problem statement, frequency, current solutions, pain severity
- **Solution Validation**: Solution reaction, value prop resonance, concerns/objections
- **Market Insights**: Competitive alternatives, switching costs, willingness to pay

**Use Cases**:
- Early-stage product validation
- Feature prioritization research
- Market opportunity assessment

---

### 2. User Testing
**Purpose**: Evaluate usability, identify friction points, and gather feature feedback

**Sections**:
- **Usability**: Task completion, friction points, unexpected behaviors
- **Feature Feedback**: Features used/requested, feature clarity
- **Satisfaction**: Overall impression, vs. expectations, likelihood to recommend

**Use Cases**:
- Product usability testing
- Beta feedback sessions
- Feature validation

---

### 3. Sales BANT
**Purpose**: Qualify opportunities using Budget, Authority, Need, and Timeline

**Sections**:
- **BANT Qualification**: Budget, Authority, Need, Timeline
- **Opportunity Assessment**: Deal size, competition, success criteria
- **Next Steps**: Agreed next steps, blockers/risks

**Use Cases**:
- Sales qualification calls
- Demo follow-ups
- Discovery calls with prospects

---

### 4. Empathy Map / JTBD
**Purpose**: Understand user motivations, jobs-to-be-done, and emotional drivers

**Sections**:
- **Empathy Map**: Says, Thinks, Does, Feels, Pains, Gains
- **Jobs to be Done**: Functional jobs, Social jobs, Emotional jobs

**Use Cases**:
- Deep user research
- Persona development
- Journey mapping

---

## Migration from Sales Lenses

### Current State (Sales Lenses)
```
sales_lens_summaries
├── framework (enum: BANT_GPCT, SPICED, MEDDIC, MAP)
├── sales_lens_slots
├── sales_lens_stakeholders
└── sales_lens_hygiene_events
```

**Issues**:
- Hardcoded to sales frameworks only
- No support for other conversation types
- Framework tied to enum (inflexible)
- Separate tables for each component (complex joins)

### New State (Conversation Lenses)
```
conversation_lens_templates (reusable definitions)
└── conversation_lens_analyses (applied analyses)
    └── analysis_data (JSONB with sections/fields/entities)
```

**Benefits**:
- Generic template system
- JSONB flexibility for any framework
- Single analysis table (simpler queries)
- Template library approach
- Multiple lenses per interview

### Migration Strategy

**Phase 1**: Create new infrastructure ✅
- `20251202140000_conversation_lenses.sql` migration
- New tables: `conversation_lens_templates`, `conversation_lens_analyses`
- Seed initial 4 templates

**Phase 2**: BAML Functions (Next)
- `ApplyConversationLens` - Extract data using template + evidence
- `DetectConversationLens` - Auto-suggest appropriate lens
- Update pipeline to use evidence as input (not raw transcript)

**Phase 3**: UI Components (Next)
- `LensView` - Renders lens sections/fields
- `LensField` - Individual field with evidence links
- `LensSelector` - Dropdown to apply/switch lenses

**Phase 4**: Data Migration (Future)
- Migrate existing `sales_lens_summaries` to `conversation_lens_analyses`
- Map BANT/SPICED/MEDDIC to sales-bant template
- Transform slots → analysis_data sections
- Deprecate old tables once stable

## Conversations vs Interviews Clarification

### Question: Why do we have both `conversations` and `interviews` tables?

**Answer**: We **don't** have both anymore. Here's the history:

1. **interviews table** (base schema, still active):
   - Primary table for all conversation records
   - Used across the entire application
   - Contains: transcript, participants, metadata, evidence extraction results

2. **conversation_analyses table** (created 20251110, dropped 20251120):
   - Temporary table for standalone conversation analysis feature
   - Was meant for analyzing conversations WITHOUT creating full interview records
   - **Dropped** because it duplicated functionality
   - Migration: `20251120130000_drop_conversation_analyses.sql`

**Current State**: Only `interviews` table exists. It serves as the basis for:
- Interview records
- Evidence extraction
- Lens analyses (via `conversation_lens_analyses.interview_id`)
- Person lenses / empathy maps
- Sales opportunity tracking

**Going Forward**: All conversation analysis (via lenses) will reference the `interviews` table.

## Evidence-Based Lens Analysis

### Why Use Evidence as Input?

Instead of passing the entire transcript to BAML for lens analysis, we use **pre-extracted evidence records**:

**Benefits**:
1. **Faster**: Smaller input payload (already summarized)
2. **Cheaper**: Fewer tokens processed by AI
3. **Higher Quality**: Evidence already has gist, verbatim, topic, support
4. **Better Links**: Evidence IDs already exist for deep-linking
5. **Incremental**: Can re-analyze lenses without re-processing transcript

**BAML Input Structure**:
```typescript
class EvidenceForLens {
  evidence_id string
  gist string
  verbatim string
  topic string?
  support string?  // "supports" | "opposes" | "neutral"
  facets string[]  // e.g., ["pricing", "onboarding"]
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
```

## Next Steps

1. **Create BAML Functions**:
   - `baml_src/conversation_lenses.baml`
   - Define `ConversationLensAnalysis` class
   - Implement `ApplyConversationLens` function
   - Implement `DetectConversationLens` function

2. **Update TypeScript Types**:
   - Generate types from BAML
   - Create Zod schemas for validation
   - Update `app/types/index.ts`

3. **Build UI Components**:
   - `app/features/lenses/components/LensView.tsx`
   - `app/features/lenses/components/LensField.tsx`
   - `app/features/lenses/components/LensSelector.tsx`

4. **Wire into Pipeline**:
   - Update interview processing to trigger lens analysis
   - Create Trigger.dev task for lens application
   - Add lens detection step

5. **Test & Iterate**:
   - Test with existing interviews
   - Validate evidence linking
   - Refine templates based on results

## Migration File

Created: `supabase/migrations/20251202140000_conversation_lenses.sql`

**Status**: Ready to apply (requires local Supabase or remote push)

**What it does**:
- Creates `conversation_lens_templates` table
- Creates `conversation_lens_analyses` table
- Seeds 4 initial templates (Customer Discovery, User Testing, Sales BANT, Empathy Map/JTBD)
- Sets up RLS policies
- Adds indexes for performance
- Preserves existing `sales_lens_*` tables (no data loss)

**To apply**:
```bash
# Local (requires Docker running)
npx supabase db reset

# Remote
npx supabase db push
```
