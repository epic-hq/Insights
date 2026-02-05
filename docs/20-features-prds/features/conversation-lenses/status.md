# Conversation Lenses Implementation Status

**Last Updated**: 2026-02-05
**Status**: 🟢 Analysis Page Live - Overview, By Person, By Lens tabs with cross-lens synthesis

---

## Architecture Overview

**Vision**: Evidence-first, lens-driven insights where the same evidence can be viewed through different frameworks (Product, Sales, Research, Support) tailored to specific decision-making contexts.

**Core Principle**: Evidence → Lenses → Insights → Actions

See [_lens-based-architecture-v2.md](../_lens-based-architecture-v2.md) for full architecture.

---

## ✅ What's Implemented

### 1. Sales Lens (BANT Framework)
**Status**: ✅ Fully Implemented (behind feature flag)

**Location**:
- Component: `app/features/lenses/components/ConversationLenses.tsx` (SalesLensesSection)
- Route: `app/routes/_protected.projects.$projectId.sales-lenses.tsx`
- Database: `sales_lens_summaries`, `sales_lens_slots`, `sales_lens_stakeholders`, `sales_lens_hygiene_events`

**Features**:
- ✅ BANT framework extraction (Budget, Authority, Need, Timeline)
- ✅ Stakeholder mapping
- ✅ Deal qualification scoring
- ✅ Hygiene checks (missing info, gaps)
- ✅ Evidence linking with timestamps
- ✅ Inline editing of slot values
- ✅ Integrated into interview detail page (when `ffSalesCRM` flag enabled)

**Usage**:
```tsx
// In interview detail page (line 1782)
{salesCrmEnabled ? (
  <SalesLensesSection
    lens={salesLens}
    customLenses={customLensOverrides}
    customLensDefaults={customLensDefaults}
    onUpdateLens={handleCustomLensUpdate}
    onUpdateSlot={handleSlotUpdate}
    updatingLensId={activeLensUpdateId}
    personLenses={personLenses}
    projectPath={projectPath}
  />
) : null}
```

**Feature Flag**: `ffSalesCRM` (PostHog)

### 2. Person Lenses (Empathy Map)
**Status**: ✅ Implemented within ConversationLenses component

**Features**:
- ✅ Pains & Goals extraction
- ✅ Empathy Map (Says, Does, Thinks, Feels)
- ✅ Evidence linking with clickable timestamps
- ✅ Person-specific insights

**Location**: Embedded in `SalesLensesSection`, rendered per person

### 3. Core Infrastructure
**Status**: ✅ Complete

- ✅ Evidence extraction with `start_ms`/`end_ms` timestamps
- ✅ MediaAnchor schema standardized
- ✅ Interview processing v2 workflow
- ✅ Evidence → People → Facets pipeline
- ✅ Clickable timestamps for media playback
- ✅ `interviews.conversation_analysis` for lens data storage

---

## 🟡 Partially Implemented

### 1. Product Lens (Pain × User Type Matrix)
**Status**: 🟡 Page exists but not populated/linked

**Location**: `app/features/lenses/pages/product-lens.tsx`

**What's Missing**:
- ❌ No route to access it from navigation
- ❌ Not populated with actual interview data
- ❌ Pain matrix generation not integrated
- ❌ No UI selector to switch between lenses
- ❌ Frequency/Intensity/WTP scoring not implemented

**Database**: `docs/product-lens-implementation.md` suggests structure but not in schema

**Expected Output**: Pain × User Type Matrix
```
Pain/Need                    | Enterprise PM | SMB Designer | Developer
─────────────────────────────|───────────────|──────────────|──────────
Can't organize research      | 🔥🔥🔥 85%    | 🔥 45%       | — 10%
  • Priority: Critical       | WTP: High     | WTP: Medium  | WTP: Low
  • Evidence: 12 pieces      | Freq: 8/10    | Freq: 3/8    | Freq: 1/6
```

### 2. BANT Lens (Alternative to Sales Lens)
**Status**: 🟡 Page exists but separate from Sales Lens

**Location**: `app/features/lenses/pages/bant-lens.tsx`

**What's Missing**:
- ❌ Not clear if this is the same as Sales Lens or different
- ❌ No navigation to access it
- ❌ Duplication with Sales Lens functionality?

**Recommendation**: Consolidate with Sales Lens or clarify distinction

---

## ❌ Not Implemented

### 1. Research Lens (Goal → DQ → RQ Hierarchy)
**Status**: ❌ Not Implemented

**Purpose**: Answer structured research questions with confidence scores

**Expected Output**: Hierarchical Answers
```
Goal: Determine monetization model
├─ DQ: What will users pay for?
│  ├─ Strategic Insight: "Freemium with premium interview features"
│  ├─ Confidence: High (82%)
│  └─ Supporting RQs:
│     ├─ RQ: What features are must-haves?
│     └─ RQ: What's willingness to pay?
```

**Database**: Uses existing `goals`, `decision_questions`, `research_questions` tables

**Status**: Tables exist, but no lens UI to synthesize answers

### 2. Support Lens (Issue × Segment Matrix)
**Status**: ❌ Not Implemented

**Purpose**: Identify common support issues by user segment

**Expected Output**: Issue × Segment Matrix + FAQ candidates

### 3. Custom Lens Framework
**Status**: ❌ Not Implemented

**Purpose**: Allow users to define custom lens frameworks

**Mentioned In**: `docs/_lens-based-architecture-v2.md` line 59

### 4. Analysis Page (Lens Selector + Aggregation)
**Status**: ✅ Implemented

The Analysis page (`/lenses`) replaces the old Lens Library with three tabs:

1. **Overview Tab** — AI-synthesized executive briefing across all lenses (cross-lens synthesis)
2. **By Person Tab** — Per-person consolidated lens results with drill-down sheets
3. **By Lens Tab** — Per-template aggregate view showing all analyses for a given lens

**Route**: `app/features/lenses/pages/analysis.tsx`

**Components**:
- `AnalysisOverviewTab.tsx` — Executive summary, key findings, person snapshots, recommended actions
- `AnalysisByPersonTab.tsx` — People grid with lens result counts
- `AnalysisByLensTab.tsx` — Lens template cards with interview analysis counts
- `PersonAnalysisSheet.tsx` — Side sheet with full per-person lens details
- `ManageLensesDialog.tsx` — Template management (gear icon, replaces old Library page)

**Data Loading**: `loadAnalysisData.server.ts` — Server-side loader aggregating lens analyses, templates, and cross-lens synthesis

**Cross-Lens Synthesis**: Trigger.dev task `lens.synthesize-cross-lens` combines ALL lens analyses into a unified executive briefing stored in `conversation_lens_summaries` with `template_key = '__cross_lens__'`

**BAML Contract**: `baml_src/synthesize_cross_lens.baml` — Produces `CrossLensSynthesisResult` with executive summary, key findings, person snapshots, recommended actions, patterns, and risks

### 5. Multi-Interview Lens Aggregation
**Status**: ✅ Implemented (via Analysis page)

Project-level aggregation surfaces in the Analysis page's By Lens tab. Each lens template shows the count of analyses across all interviews, with drill-down to individual results.

---

## 🔧 Implementation Gaps

### Resolved

1. **~~No Lens Selector UI~~** ✅ — Analysis page provides Overview/By Person/By Lens tabs
2. **~~Multi-Interview Aggregation~~** ✅ — Analysis page aggregates across all interviews
3. **~~Cross-Lens Synthesis~~** ✅ — `lens.synthesize-cross-lens` Trigger.dev task

### Remaining Gaps

1. **Product Lens Not Wired Up**
   - Page exists but no data flow
   - Pain matrix generation not integrated

2. **Research Lens Missing Entirely**
   - Critical for research users
   - Tables exist but no synthesis logic

3. **Lens Generation Not Fully Automated**
   - Auto-applies after interview finalization
   - Cross-lens synthesis triggered manually from Analysis page completes

### Data Flow Gaps

1. **Evidence → Lens Transformation**
   - Sales lens: ✅ Working (extracts BANT from evidence)
   - Product lens: ❌ No pain matrix generation
   - Research lens: ❌ No RQ synthesis

2. **Lens Storage**
   - Sales lens: ✅ Dedicated tables
   - Product lens: ❌ No schema
   - Research lens: ✅ Tables exist, no population

3. **Real-time Updates**
   - Evidence updates don't trigger lens regeneration
   - Manual refresh required

---

## 📋 Recommended Implementation Order

### Phase 1: Complete Product Lens (High Impact)
**Effort**: 2-3 days

1. ✅ Evidence extraction already working
2. ❌ Create pain matrix generation service
   - Cluster evidence by pain theme
   - Map to user types (roles/segments/personas)
   - Calculate frequency, intensity, WTP scores
3. ❌ Wire up to product-lens.tsx page
4. ❌ Add route and navigation
5. ❌ Test with existing interviews

**Files to Create/Modify**:
- `app/features/lenses/services/generatePainMatrix.server.ts` (already exists! ✅)
- `app/features/lenses/pages/product-lens.tsx` (populate with data)
- `app/routes/_protected.projects.$projectId.product-lens.tsx` (create route)

### Phase 2: Add Lens Selector UI (Critical UX)
**Effort**: 1 day

1. Add lens tabs/selector to interview detail page
2. Add project-level lens views (aggregate across interviews)
3. Add lens selector to project dashboard

**Files to Create/Modify**:
- `app/features/interviews/pages/detail.tsx` (add tabs)
- `app/features/projects/components/LensSelector.tsx` (new)

### Phase 3: Research Lens (For Researcher Persona)
**Effort**: 3-4 days

1. RQ synthesis from evidence
2. DQ insights from RQ findings
3. Goal-level recommendations
4. Confidence scoring
5. UI for hierarchical view

**Files to Create/Modify**:
- `app/features/lenses/services/generateResearchLens.server.ts` (new)
- `app/features/lenses/pages/research-lens.tsx` (new)
- `app/lib/database/research-answers.server.ts` (enhance existing)

### Phase 4: Automated Lens Generation
**Effort**: 1-2 days

1. Trigger lens generation after interview analysis
2. Background job for lens updates
3. Cache invalidation strategy

**Files to Modify**:
- `src/trigger/interview/v2/finalizeInterview.ts` (add lens generation step)
- `app/features/lenses/services/*.server.ts` (make idempotent)

### Phase 5: Multi-Interview Aggregation
**Effort**: 2-3 days

1. Project-level pain matrix (aggregate all interviews)
2. Project-level BANT summary (aggregate opportunities)
3. Cross-interview evidence clustering

---

## 🗂️ Database Schema Status

### ✅ Existing Tables

```sql
-- Sales Lens
sales_lens_summaries
sales_lens_slots
sales_lens_stakeholders
sales_lens_hygiene_events

-- Research Lens (structure exists, not populated)
goals
decision_questions
research_questions
project_answers
```

### ❌ Missing Tables

```sql
-- Product Lens
CREATE TABLE product_lens_pain_matrix (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  interview_id uuid REFERENCES interviews,
  pain_theme text,
  user_type text,
  frequency float,
  intensity text,
  willingness_to_pay text,
  evidence_count int,
  evidence_ids uuid[],
  created_at timestamptz
);

-- Support Lens
CREATE TABLE support_lens_issue_matrix (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  issue_theme text,
  segment text,
  frequency int,
  severity text,
  evidence_ids uuid[],
  created_at timestamptz
);
```

---

## 📊 Current Usage

### Interview Detail Page Structure

```
┌─────────────────────────────────────────────┐
│ Interview Header (title, date, person)      │
├─────────────────────────────────────────────┤
│ [IF ffSalesCRM enabled]                      │
│   Sales Lenses Section                       │
│   - BANT Framework                           │
│   - Stakeholders                             │
│   - Person Lenses (Empathy Map)              │
│   - Hygiene Checks                           │
├─────────────────────────────────────────────┤
│ Evidence Timeline (chronological)            │
├─────────────────────────────────────────────┤
│ Recording (media player)                     │
├─────────────────────────────────────────────┤
│ Transcript (collapsible)                     │
└─────────────────────────────────────────────┘
```

**Missing**: Tabs/selector to switch between lens views

---

## 🎯 Success Criteria

### Product Lens
- [ ] Pain × User Type matrix displayed
- [ ] Evidence linked to each cell
- [ ] Frequency/Intensity/WTP scores calculated
- [ ] Feature prioritization recommendations
- [ ] Accessible from project dashboard and interview detail

### Research Lens
- [ ] Goal → DQ → RQ hierarchy displayed
- [ ] Confidence scores for each level
- [ ] Evidence provenance clear
- [ ] Answer quality assessment
- [ ] Export to research report format

### UX
- [ ] Clear lens selector UI
- [ ] Lens views update when evidence changes
- [ ] Project-level lens aggregation
- [ ] Lens-specific actions (e.g., "Add to feature backlog")

---

## 🚧 Technical Debt

1. **Sales lens duplication**
   - `sales-lenses.tsx` route vs `SalesLensesSection` in interview detail
   - Consolidate or clarify purpose

2. **Feature flag confusion**
   - `ffSalesCRM` hides entire lens infrastructure
   - Should be per-lens flags or user preferences

3. **Lens data staleness**
   - No automatic regeneration on evidence updates
   - Manual refresh required

4. **Pain matrix service exists but unused**
   - `generatePainMatrix.server.ts` exists
   - Not integrated into product lens page

---

## 📚 Related Documentation

- [Lens Architecture V2](../_lens-based-architecture-v2.md) - Full vision
- [Product Lens Implementation](../product-lens-implementation.md)
- [Sales Lens User Guide](../sales-lens-user-guide.md)
- [BANT Lens Technical Design](../features/bant-lens-technical-design.md)
- [Lens Testing Guide](../lens-architecture-testing-guide.md)

---

## 🔄 Next Steps

1. **Immediate (1-2 days)**:
   - Add lens selector UI to interview detail page
   - Remove CopilotKit/Mastra from task board (already decided against)
   - Test existing Sales Lens with recent anchor fixes

2. **Short-term (1 week)**:
   - Complete Product Lens implementation
   - Wire up pain matrix generation
   - Add project-level lens views

3. **Medium-term (2-3 weeks)**:
   - Implement Research Lens
   - Automated lens generation pipeline
   - Multi-interview aggregation

4. **Long-term (1+ month)**:
   - Support Lens implementation
   - Custom lens framework
   - Lens-specific AI agents
