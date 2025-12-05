# Conversation Lenses MVP - Reduced Scope Plan

## System Lenses (v1)

| # | Template Key | Name | Purpose | BAML Status | Priority |
|---|--------------|------|---------|-------------|----------|
| 1 | `project-research` | Project Research | Answer project goals, decision questions, unknowns | ✅ `goal_lens_extraction.baml` exists | **P0** |
| 2 | `sales-bant` | Sales BANT | Budget, Authority, Need, Timeline qualification | ✅ `sales_lens_extraction.baml` exists | **P0** |
| 3 | `empathy-map-jtbd` | Empathy Map / JTBD | Says/Thinks/Does/Feels + Jobs-to-be-Done | ✅ Seeded in DB | **P0** |
| 4 | `customer-discovery` | Customer Discovery | Problem/solution validation, market insights | ✅ Seeded in DB | **P1** |
| 5 | `user-testing` | User Testing | Usability findings, friction points | ✅ `research_lens_extraction.baml` exists | **P1** |
| 6 | `product-insights` | Product Insights | Feature requests, product gaps, competitive intel | ✅ `product_lens_extraction.baml` exists | **P1** |

### Project Research Lens (P0 - Critical)

This lens ties directly to project setup:
- **Goal Answers**: Direct answers to `project.project_goals[]`
- **Decision Insights**: Recommendations for `project.decision_questions[]`
- **Unknown Resolutions**: Status of `project.unknowns[]`
- **Target Fit**: Assessment against `project.target_orgs[]` and `project.target_roles[]`
- **Goal Completion Score**: 0.0-1.0 how well interview addressed goals

**Already implemented in `goal_lens_extraction.baml`** - just needs wiring.

---

## Scope Reductions for MVP

### REMOVED from v1
| Feature | Reason |
|---------|--------|
| ~~Auto-detect which lens to apply~~ | Apply ALL lenses to ALL interviews instead |
| ~~NLP lens authoring~~ | Custom templates can wait for v2 |
| ~~Feed/subscription system~~ | Focus on generating data first |
| ~~Hashtag system~~ | v2 |
| ~~Slack/email notifications~~ | v2 |
| ~~Lens selector UI~~ | Show tabs for all applied lenses instead |
| ~~Custom template CRUD~~ | System templates only in v1 |

### SIMPLIFIED
| Original | MVP Approach |
|----------|--------------|
| Select which lens to apply | Auto-apply ALL system lenses on processing |
| Dual-write migration | Write ONLY to `conversation_lens_analyses` for new lenses |
| Complex lens selector | Simple tabs showing applied lenses |
| Visibility controls | Voice memos/notes default to private; others to account |

---

## MVP Architecture

```
┌─────────────────────────────────────────────────────┐
│           Interview Processing Pipeline              │
│  (v2 orchestrator → finalizeInterview)              │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              applyAllLensesTask                     │
│  Triggered after finalize, applies ALL 6 lenses    │
│  in parallel                                        │
└────────────────────────┬────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Project      │ │ Sales BANT   │ │ Empathy Map  │
│ Research     │ │              │ │ JTBD         │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  conversation_lens_analyses   │
        │  (one row per interview+lens) │
        └───────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Database & Generic Engine (3-4 days)

#### 1.1 Update Template Seeds
**File**: `supabase/migrations/202512XX_lens_system_templates.sql`

```sql
-- Add project-research template
INSERT INTO conversation_lens_templates (
  template_key, template_name, summary, primary_objective,
  category, display_order, template_definition, is_active
) VALUES (
  'project-research',
  'Project Research',
  'Answer project goals, decision questions, and resolve unknowns',
  'Map interview findings to specific project research objectives',
  'research',
  5, -- First in order
  '{
    "sections": [
      {
        "section_key": "goal_answers",
        "section_name": "Research Goal Answers",
        "fields": [
          {"field_key": "goal_statement", "field_name": "Goal", "field_type": "text"},
          {"field_key": "answer_summary", "field_name": "Answer", "field_type": "text"},
          {"field_key": "confidence", "field_name": "Confidence", "field_type": "text"}
        ]
      },
      {
        "section_key": "decision_insights",
        "section_name": "Decision Insights",
        "fields": [
          {"field_key": "decision_question", "field_name": "Question", "field_type": "text"},
          {"field_key": "recommendation", "field_name": "Recommendation", "field_type": "text"},
          {"field_key": "rationale", "field_name": "Rationale", "field_type": "text"}
        ]
      },
      {
        "section_key": "unknown_resolutions",
        "section_name": "Unknowns Resolved",
        "fields": [
          {"field_key": "unknown_statement", "field_name": "Unknown", "field_type": "text"},
          {"field_key": "status", "field_name": "Status", "field_type": "text"},
          {"field_key": "findings", "field_name": "Findings", "field_type": "text"}
        ]
      }
    ],
    "entities": [],
    "recommendations_enabled": true
  }'::jsonb,
  true
);

-- Add product-insights template
INSERT INTO conversation_lens_templates (
  template_key, template_name, summary, primary_objective,
  category, display_order, template_definition, is_active
) VALUES (
  'product-insights',
  'Product Insights',
  'Extract JTBD, feature requests, product gaps, and competitive intelligence',
  'Identify product opportunities and user needs',
  'product',
  25,
  '{
    "sections": [
      {
        "section_key": "jobs_to_be_done",
        "section_name": "Jobs to be Done",
        "fields": [
          {"field_key": "job_description", "field_name": "Job", "field_type": "text"},
          {"field_key": "desired_outcome", "field_name": "Desired Outcome", "field_type": "text"},
          {"field_key": "importance", "field_name": "Importance", "field_type": "text"}
        ]
      },
      {
        "section_key": "feature_requests",
        "section_name": "Feature Requests",
        "fields": [
          {"field_key": "feature_name", "field_name": "Feature", "field_type": "text"},
          {"field_key": "use_case", "field_name": "Use Case", "field_type": "text"},
          {"field_key": "priority", "field_name": "Priority", "field_type": "text"}
        ]
      },
      {
        "section_key": "product_gaps",
        "section_name": "Product Gaps",
        "fields": [
          {"field_key": "gap_description", "field_name": "Gap", "field_type": "text"},
          {"field_key": "impact", "field_name": "Impact", "field_type": "text"},
          {"field_key": "workaround", "field_name": "Workaround", "field_type": "text"}
        ]
      }
    ],
    "entities": ["competitive_insights"],
    "recommendations_enabled": true
  }'::jsonb,
  true
);

-- Mark existing templates as system templates
UPDATE conversation_lens_templates
SET is_active = true
WHERE template_key IN ('customer-discovery', 'user-testing', 'sales-bant', 'empathy-map-jtbd');
```

#### 1.2 Add visibility column to interviews
```sql
-- For voice memos and notes privacy
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS lens_visibility text DEFAULT 'account'
CHECK (lens_visibility IN ('private', 'account'));

-- Auto-set voice memos and notes to private
CREATE OR REPLACE FUNCTION set_default_lens_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.interview_type IN ('voice_memo', 'note') THEN
    NEW.lens_visibility := 'private';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER interview_lens_visibility_trigger
BEFORE INSERT ON interviews
FOR EACH ROW EXECUTE FUNCTION set_default_lens_visibility();
```

### Phase 2: Generic Lens BAML & Tasks (2-3 days)

#### 2.1 Create unified BAML function
**File**: `baml_src/apply_conversation_lens.baml`

This wraps existing lens-specific functions with a unified interface:

```baml
// Unified entry point that delegates to specific lens extractors
function ApplyConversationLensGeneric(
  template_key: string,
  evidence_json: string,
  interview_context: string,
  project_context: string?  // For project-research lens
) -> ConversationLensResult {
  // ... delegates to ExtractGoalLens, ExtractSalesLensBant, etc.
}
```

#### 2.2 Create applyAllLenses task
**File**: `src/trigger/lens/applyAllLenses.ts`

```typescript
import { task } from "@trigger.dev/sdk"

const SYSTEM_LENSES = [
  'project-research',
  'sales-bant',
  'empathy-map-jtbd',
  'customer-discovery',
  'user-testing',
  'product-insights',
]

export const applyAllLensesTask = task({
  id: "lens.apply-all-lenses",
  retry: { maxAttempts: 2 },
  run: async (payload: { interviewId: string; accountId: string; projectId?: string }) => {
    const client = createSupabaseAdminClient()

    // Load interview and evidence once
    const { data: interview } = await client
      .from("interviews")
      .select("*, projects(*)")
      .eq("id", payload.interviewId)
      .single()

    // Skip if private (voice memo/note)
    if (interview.lens_visibility === 'private') {
      return { skipped: true, reason: 'private interview' }
    }

    const { data: evidence } = await client
      .from("evidence")
      .select("*")
      .eq("interview_id", payload.interviewId)
      .order("start_ms")

    const evidenceJson = JSON.stringify(evidence)
    const interviewContext = buildInterviewContext(interview)

    // Build project context for project-research lens
    const projectContext = interview.projects ? {
      goals: interview.projects.project_goals,
      decisionQuestions: interview.projects.decision_questions,
      unknowns: interview.projects.unknowns,
      targetOrgs: interview.projects.target_orgs,
      targetRoles: interview.projects.target_roles,
    } : null

    // Apply each lens and store results
    const results = []
    for (const templateKey of SYSTEM_LENSES) {
      try {
        const result = await applyLens(templateKey, evidenceJson, interviewContext, projectContext)

        await client.from("conversation_lens_analyses").upsert({
          interview_id: payload.interviewId,
          template_key: templateKey,
          account_id: payload.accountId,
          project_id: payload.projectId,
          analysis_data: result,
          confidence_score: result.overall_confidence,
          auto_detected: true,
          status: 'completed',
          processed_at: new Date().toISOString(),
        }, { onConflict: 'interview_id,template_key' })

        results.push({ templateKey, success: true })
      } catch (error) {
        results.push({ templateKey, success: false, error: error.message })
      }
    }

    return { results }
  }
})
```

#### 2.3 Hook into finalize pipeline
**File**: Modify `src/trigger/interview/v2/finalizeInterview.ts`

```typescript
// At end of finalizeInterviewTaskV2, trigger lens application
await applyAllLensesTask.trigger({
  interviewId: payload.interviewId,
  accountId: metadata.accountId,
  projectId: metadata.projectId,
})
```

### Phase 3: UI Integration (2-3 days)

#### 3.1 Create GenericLensView component
**File**: `app/features/lenses/components/GenericLensView.tsx`

Renders any lens result based on template definition - sections, fields, entities.

#### 3.2 Add lens tabs to interview detail
**File**: Modify `app/features/interviews/pages/detail.tsx`

```tsx
// Replace single SalesLensesSection with tabbed view
<LensTabs interviewId={interview.id}>
  <LensTab key="project-research" label="Research Goals">
    <GenericLensView templateKey="project-research" analysisData={analyses['project-research']} />
  </LensTab>
  <LensTab key="sales-bant" label="Sales BANT">
    <GenericLensView templateKey="sales-bant" analysisData={analyses['sales-bant']} />
  </LensTab>
  {/* ... other tabs */}
</LensTabs>
```

#### 3.3 Create loader for lens analyses
**File**: `app/features/lenses/lib/loadLensAnalyses.server.ts`

```typescript
export async function loadLensAnalyses(db: SupabaseClient, interviewId: string) {
  const { data: analyses } = await db
    .from("conversation_lens_analyses")
    .select("*, conversation_lens_templates(*)")
    .eq("interview_id", interviewId)
    .eq("status", "completed")

  // Return as map: { "sales-bant": {...}, "project-research": {...} }
  return Object.fromEntries(
    analyses.map(a => [a.template_key, a])
  )
}
```

---

## Migration Assurances: Sales Lens → Generic

### Current State
- `generateSalesLensTask` writes to `sales_lens_summaries`, `sales_lens_slots`, `sales_lens_stakeholders`
- UI reads from these tables via `loadInterviewSalesLens()`

### Migration Path

**Step 1: Dual-Write (This PR)**
```typescript
// In generateSalesLensTask, ALSO write to new table
await client.from("conversation_lens_analyses").upsert({
  interview_id: payload.interviewId,
  template_key: 'sales-bant',
  account_id: interview.account_id,
  analysis_data: transformSalesLensToGeneric(extraction),
  status: 'completed',
  // ...
})
```

**Step 2: Dual-Read (Next PR)**
```typescript
// In loadLensAnalyses, check new table first
const newAnalysis = await db.from("conversation_lens_analyses")
  .select("*").eq("interview_id", id).eq("template_key", "sales-bant").single()

if (newAnalysis) return transformToLegacyFormat(newAnalysis)

// Fallback to old tables
return loadInterviewSalesLens(db, id)
```

**Step 3: Migrate Existing Data**
```sql
-- Migration script to backfill conversation_lens_analyses from sales_lens_summaries
INSERT INTO conversation_lens_analyses (interview_id, template_key, account_id, ...)
SELECT
  s.interview_id,
  'sales-bant',
  s.account_id,
  build_analysis_data(s.*, slots.*, stakeholders.*)
FROM sales_lens_summaries s
LEFT JOIN sales_lens_slots slots ON ...
LEFT JOIN sales_lens_stakeholders stakeholders ON ...
WHERE NOT EXISTS (
  SELECT 1 FROM conversation_lens_analyses
  WHERE interview_id = s.interview_id AND template_key = 'sales-bant'
);
```

**Step 4: Remove Old Code (Future)**
- Delete `sales_lens_*` table reads
- Delete `loadInterviewSalesLens()`
- Keep tables for backup/rollback

### Compatibility Guarantees
1. **Data format**: `analysis_data` JSONB stores same info as old slots/stakeholders
2. **Evidence linking**: `evidence_ids` in analysis maps to existing `evidence.id`
3. **Timestamps**: `anchors` array with `start_ms`/`end_ms` preserved
4. **Confidence scores**: Mapped to field-level and overall confidence

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `supabase/migrations/202512XX_lens_system_templates.sql` | Add project-research, product-insights templates |
| Create | `baml_src/apply_conversation_lens.baml` | Unified lens application wrapper |
| Create | `src/trigger/lens/applyAllLenses.ts` | Auto-apply all lenses task |
| Create | `src/trigger/lens/applyLens.ts` | Single lens application (calls BAML) |
| Create | `app/features/lenses/components/GenericLensView.tsx` | Template-driven renderer |
| Create | `app/features/lenses/components/LensTabs.tsx` | Tab container for multiple lenses |
| Create | `app/features/lenses/lib/loadLensAnalyses.server.ts` | Load analyses from new table |
| Modify | `src/trigger/interview/v2/finalizeInterview.ts` | Trigger lens application |
| Modify | `src/trigger/sales/generateSalesLens.ts` | Add dual-write to new table |
| Modify | `app/features/interviews/pages/detail.tsx` | Add lens tabs |

---

## Timeline

| Phase | Days | Deliverable |
|-------|------|-------------|
| Phase 1 | 3-4 | Database ready, templates seeded |
| Phase 2 | 2-3 | Lens tasks working, pipeline integrated |
| Phase 3 | 2-3 | UI showing all lenses in tabs |
| **Total** | **7-10** | **Full MVP** |

---

## What Ships

1. **All 6 system lenses auto-applied** to every interview on processing
2. **Project Research lens** answering project goals/decisions/unknowns
3. **Tabbed lens view** on interview detail page
4. **Voice memos/notes** default to private (no lens application)
5. **Sales lens dual-write** ensuring future migration path

## What's Deferred to v2

- Custom template authoring
- NLP-to-template
- Feed/subscription system
- Hashtags and alerts
- Lens auto-detection (choosing which lenses)
- Public/subscribable visibility
